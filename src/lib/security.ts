import { PDFArray, PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import type { OpenDocument } from '../types';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const secureHeader = 'PDFForge Secure v1\n';

export function redactContentStream(content: string, terms: string[]): { content: string; replacements: number } {
  let replacements = 0;
  const scrub = (value: string, encode: (input: string) => string) => {
    let result = value;
    for (const term of terms.filter(Boolean)) {
      const expression = new RegExp(escapeRegex(term), 'gi');
      result = result.replace(expression, (match) => { replacements += 1; return ' '.repeat(match.length); });
    }
    return encode(result);
  };
  const withHex = content.replace(/<([0-9a-fA-F\s]+)>/g, (whole, payload: string) => {
    const compact = payload.replace(/\s/g, '');
    if (compact.length % 2 || !/^[0-9a-f]+$/i.test(compact)) return whole;
    const bytes = Uint8Array.from(compact.match(/.{1,2}/g)!.map((part) => Number.parseInt(part, 16)));
    const text = String.fromCharCode(...bytes);
    return `<${scrub(text, (value) => Array.from(value, (character) => character.charCodeAt(0).toString(16).padStart(2, '0')).join(''))}>`;
  });
  return { content: withHex.replace(/\((?:\\.|[^\\)])*\)/g, (literal) => `(${scrub(literal.slice(1, -1), (value) => value.replace(/[\\()]/g, '\\$&'))})`), replacements };
}

export async function redactPdf(document: OpenDocument, terms: string[]): Promise<Uint8Array> {
  const source = await PDFDocument.load(document.data.slice(0));
  const clean = await PDFDocument.create();
  const pages = await clean.copyPages(source, source.getPageIndices());
  pages.forEach((page) => clean.addPage(page));
  let replacements = 0;
  for (const page of clean.getPages()) {
    const contents = page.node.Contents();
    if (!contents) continue;
    const streams = contents instanceof PDFArray ? Array.from({ length: contents.size() }, (_, index) => contents.lookup(index, PDFRawStream)) : [contents as PDFRawStream];
    const scrubbed = streams.map((stream) => redactContentStream(decoder.decode(decodePDFRawStream(stream).decode()), terms));
    replacements += scrubbed.reduce((total, entry) => total + entry.replacements, 0);
    const dictionary = streams[0].dict.clone(clean.context); dictionary.delete(PDFName.of('Filter')); dictionary.delete(PDFName.of('DecodeParms'));
    const stream = PDFRawStream.of(dictionary, encoder.encode(scrubbed.map((entry) => entry.content).join('\n')));
    page.node.set(PDFName.of('Contents'), clean.context.register(stream));
    page.node.delete(PDFName.of('Annots'));
  }
  if (!replacements) throw new Error('No matching plain-text content was found to redact.');
  return clean.save();
}

export async function sanitizePdf(document: OpenDocument): Promise<Uint8Array> {
  const source = await PDFDocument.load(document.data.slice(0));
  const clean = await PDFDocument.create();
  const pages = await clean.copyPages(source, source.getPageIndices());
  pages.forEach((page) => { page.node.delete(PDFName.of('Annots')); clean.addPage(page); });
  for (const key of ['AcroForm', 'Names', 'OpenAction', 'AA', 'Metadata']) clean.catalog.delete(PDFName.of(key));
  clean.setTitle('Sanitized document'); clean.setAuthor(''); clean.setSubject(''); clean.setKeywords([]); clean.setProducer('PDFForge');
  return clean.save();
}

export async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map((page) => {
    const contents = page.node.Contents(); if (!contents) return '';
    const streams = contents instanceof PDFArray ? Array.from({ length: contents.size() }, (_, index) => contents.lookup(index, PDFRawStream)) : [contents as PDFRawStream];
    return streams.map((stream) => contentText(decoder.decode(decodePDFRawStream(stream).decode()))).join(' ');
  }).join('\n');
}

export async function verifyRedaction(bytes: Uint8Array, terms: string[]): Promise<boolean> {
  const text = (await extractPdfText(bytes)).toLocaleLowerCase();
  return terms.filter(Boolean).every((term) => !text.includes(term.toLocaleLowerCase()));
}

export async function encryptPdfPackage(pdf: Uint8Array, password: string): Promise<Uint8Array> {
  if (password.length < 8) throw new Error('Use a password with at least 8 characters.');
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 150_000, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const payload = pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer;
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, payload));
  return encoder.encode(secureHeader + JSON.stringify({ salt: base64(salt), iv: base64(iv), data: base64(encrypted) }));
}

export async function decryptPdfPackage(packageBytes: Uint8Array, password: string): Promise<Uint8Array> {
  const source = decoder.decode(packageBytes); if (!source.startsWith(secureHeader)) throw new Error('This is not a PDFForge protected package.');
  const payload = JSON.parse(source.slice(secureHeader.length)) as { salt: string; iv: string; data: string };
  const salt = fromBase64(payload.salt); const saltData = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  const iv = fromBase64(payload.iv); const ivData = iv.buffer.slice(iv.byteOffset, iv.byteOffset + iv.byteLength) as ArrayBuffer;
  const baseKey = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: saltData, iterations: 150_000, hash: 'SHA-256' }, baseKey, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  const encrypted = fromBase64(payload.data); const data = encrypted.buffer.slice(encrypted.byteOffset, encrypted.byteOffset + encrypted.byteLength) as ArrayBuffer;
  return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivData }, key, data));
}

function base64(bytes: Uint8Array): string { let text = ''; bytes.forEach((byte) => { text += String.fromCharCode(byte); }); return btoa(text); }
function fromBase64(value: string): Uint8Array { const text = atob(value); return Uint8Array.from(text, (character) => character.charCodeAt(0)); }
function escapeRegex(value: string): string { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function contentText(content: string): string {
  const hex = [...content.matchAll(/<([0-9a-fA-F\s]+)>/g)].map((match) => { const compact = match[1].replace(/\s/g, ''); return compact.length % 2 ? '' : String.fromCharCode(...(compact.match(/.{1,2}/g) ?? []).map((part) => Number.parseInt(part, 16))); });
  const literal = [...content.matchAll(/\((?:\\.|[^\\)])*\)/g)].map((match) => match[0].slice(1, -1).replace(/\\([\\()])/g, '$1'));
  return [...hex, ...literal].join(' ');
}
