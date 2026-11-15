import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { OpenDocument, TextObject } from '../types';

function hexColor(value: string) {
  const hex = value.replace('#', '');
  const parsed = Number.parseInt(hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex, 16);
  return rgb(((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255);
}

export async function exportPdf(document: OpenDocument, objects: TextObject[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(document.data.slice(0));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const object of objects) {
    const page = pdf.getPage(object.page - 1);
    if (!page) continue;
    page.drawText(object.text, { x: object.x, y: object.y, size: object.fontSize, font, color: hexColor(object.color) });
  }
  return pdf.save();
}

export function downloadPdf(bytes: Uint8Array, name: string): void {
  const link = document.createElement('a');
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  link.href = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  link.download = name.replace(/\.pdf$/i, '') + '-edited.pdf';
  link.click();
  URL.revokeObjectURL(link.href);
}
