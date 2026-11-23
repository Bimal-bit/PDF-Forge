import { PDFDocument } from 'pdf-lib';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { EditorObject, OpenDocument, PageSettings } from '../types';
import { openPdf } from './pdf';
import { visibleSourceItems } from './pageText';
import { editedTextPages } from './conversion';

export interface ExtractedTable { page: number; rows: string[][] }
export interface Comparison { page: number; equal: boolean; added: string[]; removed: string[] }

function quoteCsv(value: string) { return `"${value.split('"').join('""')}"`; }

function itemsToRows(items: TextItem[]): string[][] {
  const positioned = items.filter((item) => item.str.trim()).map((item) => ({ text: item.str.trim(), x: item.transform[4], y: item.transform[5] }));
  const lines: { y: number; values: { text: string; x: number }[] }[] = [];
  for (const item of positioned) {
    const line = lines.find((entry) => Math.abs(entry.y - item.y) < 3);
    if (line) line.values.push(item); else lines.push({ y: item.y, values: [item] });
  }
  return lines.sort((a, b) => b.y - a.y).map((line) => line.values.sort((a, b) => a.x - b.x).map((item) => item.text));
}

export function tableFromTextItems(page: number, items: TextItem[]): ExtractedTable | undefined {
  const rows = itemsToRows(items);
  // A table needs at least two columns on two separate lines. This deliberately
  // declines prose rather than inventing a spreadsheet structure.
  const tabular = rows.filter((row) => row.length >= 2);
  if (tabular.length < 2) return undefined;
  return { page, rows: tabular };
}

export async function extractDocumentText(document: OpenDocument): Promise<string[]> {
  const pdf = await openPdf(document);
  try {
    const pages: string[] = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const content = await (await pdf.getPage(number)).getTextContent();
      pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' ').replace(/\s+/g, ' ').trim());
    }
    return pages;
  } finally { await pdf.loadingTask.destroy(); }
}

export async function extractTables(document: OpenDocument, objects: EditorObject[] = [], settings?: PageSettings): Promise<ExtractedTable[]> {
  const pdf = await openPdf(document);
  try {
    const tables: ExtractedTable[] = [];
    const order = settings?.order.length ? settings.order : Array.from({ length: pdf.numPages }, (_, index) => index + 1);
    for (const [index, source] of order.entries()) {
      const content = await (await pdf.getPage(source)).getTextContent();
      const overlays = objects.filter((object) => object.page === source);
      const table = tableFromTextItems(index + 1, visibleSourceItems(content.items.filter((item): item is TextItem => 'str' in item), overlays));
      if (table) tables.push(table);
      for (const object of overlays) if (object.type === 'table') tables.push({ page: index + 1, rows: object.cells });
    }
    return tables;
  } finally { await pdf.loadingTask.destroy(); }
}

export function tablesToCsv(tables: ExtractedTable[]): string {
  return tables.flatMap((table) => [`# Page ${table.page}`, ...table.rows.map((row) => row.map(quoteCsv).join(',')), '']).join('\n');
}

export function textToHtml(pages: string[], title: string): string {
  const escape = (value: string) => value.split('&').join('&amp;').split('<').join('&lt;').split('>').join('&gt;');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escape(title)}</title><style>body{font:16px system-ui;max-width:52rem;margin:3rem auto;line-height:1.55}.page{white-space:pre-wrap;border-bottom:1px solid #ddd;padding:1rem 0}</style></head><body>${pages.map((page, index) => `<section class="page" data-page="${index + 1}">${escape(page)}</section>`).join('')}</body></html>`;
}

function words(value: string) { return value.toLocaleLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []; }

export function comparePageText(left: string, right: string, page: number): Comparison {
  const leftWords = words(left); const rightWords = words(right);
  const rightPool = new Map<string, number>(); const leftPool = new Map<string, number>();
  rightWords.forEach((word) => rightPool.set(word, (rightPool.get(word) ?? 0) + 1));
  leftWords.forEach((word) => leftPool.set(word, (leftPool.get(word) ?? 0) + 1));
  const removed = leftWords.filter((word) => { const count = rightPool.get(word) ?? 0; if (!count) return true; rightPool.set(word, count - 1); return false; });
  const added = rightWords.filter((word) => { const count = leftPool.get(word) ?? 0; if (!count) return true; leftPool.set(word, count - 1); return false; });
  return { page, equal: leftWords.length === rightWords.length && leftWords.every((word, index) => word === rightWords[index]), added, removed };
}

export async function compareDocuments(left: OpenDocument, right: OpenDocument, objects: EditorObject[] = [], settings?: PageSettings): Promise<Comparison[]> {
  const unedited: PageSettings = { order: [], rotations: {}, header: '', footer: '', watermark: '', batesStart: null };
  const [leftPages, rightPages] = await Promise.all([
    editedTextPages(left, objects, settings ?? unedited),
    editedTextPages(right, [], unedited),
  ]);
  return Array.from({ length: Math.max(leftPages.length, rightPages.length) }, (_, index) => {
    const comparison = comparePageText(leftPages[index] ?? '', rightPages[index] ?? '', index + 1);
    return { ...comparison, equal: comparison.equal && index < leftPages.length && index < rightPages.length };
  });
}

export async function optimizePdf(document: OpenDocument): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(document.data.slice(0));
  return pdf.save({ useObjectStreams: true, addDefaultPage: false, updateFieldAppearances: false });
}

export async function renderPagePng(document: OpenDocument, pageNumber: number): Promise<Blob> {
  const pdf = await openPdf(document);
  const canvas = globalThis.document.createElement('canvas');
  try {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1.5 });
    canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Your browser cannot create an image export.');
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Image export failed.')), 'image/png'));
  } finally { canvas.width = 0; canvas.height = 0; await pdf.loadingTask.destroy(); }
}
