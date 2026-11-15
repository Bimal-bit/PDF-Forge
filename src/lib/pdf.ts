import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist';
import type { OpenDocument } from '../types';

GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

export function openPdf(document: OpenDocument): Promise<PDFDocumentProxy> {
  // Slice so pdf.js can transfer its private copy to the worker without changing
  // the browser-local data retained for recovery.
  return getDocument({ data: new Uint8Array(document.data.slice(0)) }).promise;
}

export function findMatches(text: string, query: string): number[] {
  const phrase = query.trim().toLocaleLowerCase();
  if (!phrase) return [];
  const haystack = text.toLocaleLowerCase();
  const matches: number[] = [];
  let start = 0;
  while (start < haystack.length) {
    const index = haystack.indexOf(phrase, start);
    if (index === -1) break;
    matches.push(index);
    start = index + Math.max(phrase.length, 1);
  }
  return matches;
}
