import { PDFArray, PDFDocument, PDFName, PDFString, StandardFonts, rgb } from 'pdf-lib';
import type { EditorObject, OpenDocument } from '../types';

function hexColor(value: string) {
  const hex = value.replace('#', '');
  const parsed = Number.parseInt(hex.length === 3 ? hex.split('').map((part) => part + part).join('') : hex, 16);
  return rgb(((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255);
}

export async function exportPdf(document: OpenDocument, objects: EditorObject[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(document.data.slice(0));
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (const object of objects) {
    const page = pdf.getPage(object.page - 1);
    if (!page) continue;
    if (object.type === 'text') {
      if (object.cover) page.drawRectangle({ x: object.x - 2, y: object.y - 2, width: object.cover.width, height: object.cover.height, color: rgb(1, 1, 1) });
      page.drawText(object.text, { x: object.x, y: object.y, size: object.fontSize, font, color: hexColor(object.color) });
    }
    if (object.type === 'shape') page.drawRectangle({ x: object.x, y: object.y, width: object.width, height: object.height, borderColor: hexColor(object.color), borderWidth: 2, opacity: .15 });
    if (object.type === 'table') {
      const rowHeight = object.height / object.cells.length; const columnWidth = object.width / object.cells[0].length;
      object.cells.forEach((row, rowIndex) => row.forEach((cell, columnIndex) => { const x = object.x + columnIndex * columnWidth; const y = object.y + object.height - (rowIndex + 1) * rowHeight; page.drawRectangle({ x, y, width: columnWidth, height: rowHeight, borderColor: rgb(.35, .33, .3), borderWidth: 1 }); page.drawText(cell, { x: x + 5, y: y + rowHeight - 15, size: 10, font }); }));
    }
    if (object.type === 'image') { const bytes = await fetch(object.dataUrl).then((response) => response.arrayBuffer()); const image = object.dataUrl.startsWith('data:image/png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes); page.drawImage(image, { x: object.x, y: object.y, width: object.width, height: object.height }); }
    if (object.type === 'link') {
      page.drawText(object.label, { x: object.x, y: object.y, size: object.fontSize, font, color: rgb(0, .28, .68) });
      const annotation = pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [object.x, object.y, object.x + font.widthOfTextAtSize(object.label, object.fontSize), object.y + object.fontSize], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(object.url) } });
      const annotations = page.node.Annots() ?? pdf.context.obj([]) as PDFArray; annotations.push(pdf.context.register(annotation)); page.node.set(PDFName.of('Annots'), annotations);
    }
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
