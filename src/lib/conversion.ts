import { PDFDocument, StandardFonts } from 'pdf-lib';
import { openPdf } from './pdf';
import { unicodeFont } from './fonts';
import { wrapText } from './textLayout';
import { editedPageText } from './pageText';
import type { EditorObject, OpenDocument, PageSettings } from '../types';

export async function editedTextPages(document: OpenDocument, objects: EditorObject[], settings: PageSettings): Promise<string[]> {
  const pdf = await openPdf(document);
  try {
    const order = settings.order.length ? settings.order : Array.from({ length: pdf.numPages }, (_, index) => index + 1);
    const pages: string[] = [];
    for (const source of order) {
      const content = await (await pdf.getPage(source)).getTextContent();
      const overlays = objects.filter((object) => object.page === source);
      pages.push(editedPageText(content.items.filter((item) => 'str' in item), overlays));
    }
    return pages;
  } finally { await pdf.loadingTask.destroy(); }
}

export async function exportDocx(pages: string[], objects: EditorObject[] = []): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun } = await import('docx');
  const textObjects = objects.filter((object) => object.type === 'text');
  const sections = pages.map((text) => ({ children: text.split('\n').map((line) => {
    const object = textObjects.find((entry) => entry.text.includes(line) && line.trim());
    return new Paragraph({ alignment: object?.alignment === 'justify' ? 'both' : object?.alignment, children: [new TextRun({ text: line, bold: object?.bold, italics: object?.italic, strike: object?.strike, underline: object?.underline ? {} : undefined, size: (object?.fontSize ?? 12) * 2, color: object?.color.replace('#', '') })] });
  }) }));
  return Packer.toBlob(new Document({ sections }));
}

export async function exportXlsx(tables: { page: number; rows: string[][] }[]): Promise<Blob> {
  const { zipSync, strToU8 } = await import('fflate');
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!);
  const sheets = tables.length ? tables : [{ page: 1, rows: [] }];
  const xml = (body: string) => strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + body);
  const files: Record<string, Uint8Array> = {};
  files['[Content_Types].xml'] = xml(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((_, index) => `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`);
  files['_rels/.rels'] = xml('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  files['xl/workbook.xml'] = xml(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((table, index) => `<sheet name="Page ${table.page} Table ${index + 1}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join('')}</sheets></workbook>`);
  files['xl/_rels/workbook.xml.rels'] = xml(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`).join('')}</Relationships>`);
  sheets.forEach((table, index) => {
    files[`xl/worksheets/sheet${index + 1}.xml`] = xml(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${table.rows.map((row, rowIndex) => `<row r="${rowIndex + 1}">${row.map((cell, column) => {
      let letters = ''; let number = column + 1;
      while (number) { letters = String.fromCharCode(65 + (number - 1) % 26) + letters; number = Math.floor((number - 1) / 26); }
      return `<c r="${letters}${rowIndex + 1}" t="inlineStr"><is><t xml:space="preserve">${escape(cell)}</t></is></c>`;
    }).join('')}</row>`).join('')}</sheetData></worksheet>`);
  });
  const zipped = zipSync(files);
  return new Blob([zipped.buffer as ArrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export async function textDocument(text: string, name: string): Promise<OpenDocument> {
  const pdf = await PDFDocument.create();
  let font = await pdf.embedFont(StandardFonts.Helvetica);
  try { font.encodeText(text); } catch { font = await unicodeFont(pdf); }
  const size = 12;
  const lines = wrapText(text, 500, (line) => font.widthOfTextAtSize(line, size));
  let page = pdf.addPage([612, 792]); let y = 744;
  for (const line of lines) {
    if (y < 48) { page = pdf.addPage([612, 792]); y = 744; }
    if (line) page.drawText(line, { x: 48, y, size, font });
    y -= 16;
  }
  return openDocument(await pdf.save(), name);
}

export function openDocument(bytes: Uint8Array, name: string): OpenDocument {
  return { id: crypto.randomUUID(), name: name.replace(/\.[^.]+$/, '') + '.pdf', size: bytes.byteLength, modifiedAt: Date.now(), data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
}

export async function importDocument(file: File): Promise<OpenDocument> {
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'webp'].includes(extension ?? '')) {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
    canvas.getContext('2d')!.drawImage(bitmap, 0, 0); bitmap.close();
    const bytes = await fetch(canvas.toDataURL('image/png')).then((response) => response.arrayBuffer());
    const pdf = await PDFDocument.create(); const image = await pdf.embedPng(bytes);
    const scale = Math.min(1, 1200 / Math.max(image.width, image.height));
    pdf.addPage([image.width * scale, image.height * scale]).drawImage(image, { x: 0, y: 0, width: image.width * scale, height: image.height * scale });
    return openDocument(await pdf.save(), file.name);
  }
  if (extension === 'docx') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return textDocument(result.value, file.name);
  }
  let text = await file.text();
  if (extension === 'html' || extension === 'htm') {
    const html = new DOMParser().parseFromString(text, 'text/html');
    html.querySelectorAll('script,style,iframe,object').forEach((element) => element.remove());
    text = html.body.textContent ?? '';
  } else if (extension === 'md' || extension === 'markdown') text = text.replace(/^#{1,6}\s/gm, '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  else if (extension !== 'txt') throw new Error('Choose a PNG, JPEG, WebP, TXT, Markdown, HTML, or DOCX file.');
  return textDocument(text, file.name);
}
