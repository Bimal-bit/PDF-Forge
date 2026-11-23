import { PDFDocument } from 'pdf-lib';
import { toPdfDocument } from './file';
import { prepareInsertedImage } from './insertImage';
import type { OpenDocument } from '../types';

export const documentAccept =
  'application/pdf,.pdf,image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp';
export function localImageType(file: File): string | undefined {
  if (['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) return file.type;
  if (file.type && file.type !== 'application/octet-stream') return;
  const extension = file.name.split('.').pop()?.toLowerCase();
  return extension === 'png'
    ? 'image/png'
    : extension === 'jpg' || extension === 'jpeg'
      ? 'image/jpeg'
      : extension === 'webp'
        ? 'image/webp'
        : undefined;
}

/** Convert supported local images to a proportional PDF before entering the editor. */
export async function openLocalDocument(file: File): Promise<OpenDocument> {
  const type = localImageType(file);
  if (!type) return toPdfDocument(file);
  const image = await prepareInsertedImage(
    type === file.type ? file : new File([file], file.name, { type }),
  );
  const pdf = await PDFDocument.create();
  const png = await pdf.embedPng(image.dataUrl);
  const scale = Math.min(1, 1440 / Math.max(image.width, image.height));
  const width = image.width * scale;
  const height = image.height * scale;
  pdf.addPage([width, height]).drawImage(png, { x: 0, y: 0, width, height });
  const bytes = await pdf.save();
  return {
    id: crypto.randomUUID(),
    name: `${file.name.replace(/\.[^.]+$/, '')}.pdf`,
    size: bytes.byteLength,
    modifiedAt: Date.now(),
    data: bytes.slice().buffer as ArrayBuffer,
  };
}

export async function blankDocument(): Promise<OpenDocument> {
  const pdf = await PDFDocument.create();
  pdf.addPage([595.28, 841.89]);
  const bytes = await pdf.save();
  return {
    id: crypto.randomUUID(),
    name: 'Untitled.pdf',
    size: bytes.byteLength,
    modifiedAt: Date.now(),
    data: bytes.slice().buffer as ArrayBuffer,
  };
}
