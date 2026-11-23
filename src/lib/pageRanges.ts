import { PDFDocument } from 'pdf-lib';
import type { EditorObject, OpenDocument, PageSettings } from '../types';
import { exportPdf } from './export';
import { applyPagePlan } from './pagePlan';

export const MAX_EXTRACT_PAGES = 2000;

/** Page numbers refer to the current display order; deliberate duplicates are retained. */
export function parsePageRanges(input: string, count: number): number[] {
  if (!input.trim()) throw new Error('Enter page numbers or ranges, such as 1, 3-5.');
  if (input.length > 1000) throw new Error('Use at most 1000 characters for a page range.');
  if (!Number.isInteger(count) || count < 1)
    throw new Error('Wait for the document pages to load.');
  const pages: number[] = [];
  for (const part of input.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error('Use comma-separated page numbers or ranges, such as 1, 3-5.');
    const start = Number(match[1]),
      end = Number(match[2] ?? match[1]);
    if (start < 1 || end < 1 || start > count || end > count)
      throw new Error(`Page numbers must be between 1 and ${count}.`);
    const length = Math.abs(end - start) + 1;
    if (pages.length + length > MAX_EXTRACT_PAGES)
      throw new Error(`Extract at most ${MAX_EXTRACT_PAGES} pages at a time.`);
    const step = end >= start ? 1 : -1;
    for (let offset = 0; offset < length; offset += 1) pages.push(start + step * offset);
  }
  return pages;
}

export async function extractDisplayedPages(
  document: OpenDocument,
  objects: EditorObject[],
  settings: PageSettings,
  pages: number[],
) {
  const count = settings.order.length;
  if (
    !pages.length ||
    pages.length > MAX_EXTRACT_PAGES ||
    pages.some((page) => !Number.isInteger(page) || page < 1 || page > count)
  )
    throw new Error('Choose valid pages from the current document.');
  // Export first so display-page numbers, Bates marks, and all current edits are retained.
  const pdf = await PDFDocument.load(await exportPdf(document, objects, settings), {
    updateMetadata: false,
  });
  await applyPagePlan(pdf, pages);
  return pdf.save({ updateFieldAppearances: false });
}
