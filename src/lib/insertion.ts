import { PDFDocument } from 'pdf-lib';
import type { EditorObject, OpenDocument } from '../types';
import { measureFlowText } from './textFlow';

export interface InsertBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}
export type InsertPosition = 'top' | 'middle' | 'bottom';
const documents = new WeakMap<OpenDocument, Promise<PDFDocument>>();

export async function insertionBounds(document: OpenDocument, page: number): Promise<InsertBounds> {
  let loading = documents.get(document);
  if (!loading) {
    loading = PDFDocument.load(document.data.slice(0));
    documents.set(document, loading);
  }
  const source = (await loading).getPage(page - 1);
  const crop = source.getCropBox(),
    media = source.getMediaBox();
  const x = Math.max(crop.x, media.x),
    y = Math.max(crop.y, media.y);
  const width = Math.min(crop.x + crop.width, media.x + media.width) - x,
    height = Math.min(crop.y + crop.height, media.y + media.height) - y;
  return width > 0 && height > 0
    ? { x, y, width, height, rotation: source.getRotation().angle }
    : { ...media, rotation: source.getRotation().angle };
}

export function insertionSize(
  bounds: InsertBounds,
  width: number,
  height: number,
  keepRatio = false,
) {
  const margin = Math.min(36, bounds.width * 0.1, bounds.height * 0.1);
  const availableWidth = bounds.width - margin * 2,
    availableHeight = bounds.height - margin * 2;
  if (availableWidth < 20 || availableHeight < 20)
    throw new Error('This page is too small for the selected object.');
  const ratio = Math.min(1, availableWidth / width, availableHeight / height);
  return keepRatio
    ? { width: width * ratio, height: height * ratio }
    : { width: Math.min(width, availableWidth), height: Math.min(height, availableHeight) };
}

export function insertionPoint(
  bounds: InsertBounds,
  width: number,
  height: number,
  position: InsertPosition,
  count = 0,
) {
  const margin = Math.min(36, bounds.width * 0.1, bounds.height * 0.1);
  const rotated = ((bounds.rotation % 360) + 360) % 360;
  const sideways = rotated === 90 || rotated === 270;
  const pageWidth = sideways ? bounds.height : bounds.width,
    pageHeight = sideways ? bounds.width : bounds.height;
  const visualWidth = sideways ? height : width,
    visualHeight = sideways ? width : height;
  if (visualWidth > pageWidth || visualHeight > pageHeight)
    throw new Error('The object does not fit on this page. Reduce its size.');
  const shift = (count % 6) * 16;
  const horizontal = position === 'middle' ? (pageWidth - visualWidth) / 2 : margin;
  const vertical =
    position === 'top'
      ? margin
      : position === 'middle'
        ? (pageHeight - visualHeight) / 2
        : pageHeight - margin - visualHeight;
  const left = Math.max(0, Math.min(pageWidth - visualWidth, horizontal + shift));
  const top = Math.max(
    0,
    Math.min(pageHeight - visualHeight, vertical + (position === 'bottom' ? -shift : shift)),
  );
  if (rotated === 90) return { x: bounds.x + top, y: bounds.y + left };
  if (rotated === 180) return { x: bounds.x + bounds.width - left - width, y: bounds.y + top };
  if (rotated === 270)
    return {
      x: bounds.x + bounds.width - top - width,
      y: bounds.y + bounds.height - left - height,
    };
  return { x: bounds.x + left, y: bounds.y + bounds.height - top - height };
}

export function normalizeLinkUrl(input: string): string {
  const value = input.trim();
  let url: URL;
  try {
    url = new URL(/^www\./i.test(value) ? `https://${value}` : value);
  } catch {
    throw new Error('Enter a complete https://, http://, mailto:, or tel: link.');
  }
  if (!['https:', 'http:', 'mailto:', 'tel:'].includes(url.protocol))
    throw new Error('Use an https://, http://, mailto:, or tel: link.');
  if (url.protocol === 'mailto:' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(url.pathname))
    throw new Error('Enter a valid email address after mailto:.');
  if (url.protocol === 'tel:' && !/\d/.test(url.pathname))
    throw new Error('Enter a telephone number after tel:.');
  return url.href;
}

export function safeLinkHref(input: string): string | undefined {
  try {
    return normalizeLinkUrl(input);
  } catch {
    return undefined;
  }
}

export function resizeTable(cells: string[][], rows: number, columns: number): string[][] {
  return Array.from({ length: rows }, (_, row) =>
    Array.from({ length: columns }, (_, column) => cells[row]?.[column] ?? ''),
  );
}

export function localDateText(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function linkWidth(label: string, fontSize = 12) {
  return measureFlowText(
    {
      id: '',
      type: 'text',
      page: 1,
      x: 0,
      y: 0,
      text: label,
      fontSize,
      color: '#0759ae',
      fontFamily: 'Helvetica',
    },
    label,
  );
}

export function objectLabel(object?: EditorObject): string {
  if (!object) return 'Choose a tool to add content';
  if (object.type === 'text') return object.text.slice(0, 45) || 'Text box';
  if (object.type === 'form') return object.label;
  return object.type === 'table'
    ? `${object.cells.length} × ${object.cells[0]?.length ?? 0} table`
    : object.type === 'link'
      ? object.label
      : object.type === 'shape'
        ? object.label || object.shapeKind || 'Shape'
        : object.type === 'image'
          ? 'Image'
          : object.type;
}

export function assertInsertFits(
  bounds: InsertBounds,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (
    ![x, y, width, height].every(Number.isFinite) ||
    x < bounds.x ||
    y < bounds.y ||
    x + width > bounds.x + bounds.width + 0.01 ||
    y + height > bounds.y + bounds.height + 0.01
  )
    throw new Error('Keep the entire object inside the page. Adjust its position or size.');
}
