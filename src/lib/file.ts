import { EncryptedPDFError, PDFDocument } from 'pdf-lib';
import type { OpenDocument } from '../types';

export async function toPdfDocument(file: File): Promise<OpenDocument> {
  if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
    throw new Error('Choose a PDF file.');
  }
  const data = await file.arrayBuffer();
  const header = new TextDecoder().decode(data.slice(0, 5));
  if (header !== '%PDF-') throw new Error('This file is not a valid PDF.');
  try {
    const pdf = await PDFDocument.load(data.slice(0), { updateMetadata: false });
    if (!pdf.getPageCount()) throw new Error('The PDF has no pages.');
    pdf.getPages();
  } catch (error) {
    if (error instanceof EncryptedPDFError) throw new Error('This PDF is password-protected. Unlock it before opening it.');
    throw new Error('This file is not a valid PDF.');
  }
  return { id: crypto.randomUUID(), name: file.name, size: file.size, modifiedAt: Date.now(), data };
}

export function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
