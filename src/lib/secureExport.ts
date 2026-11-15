import { AnnotationMode, Util, type PDFPageProxy } from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import type { EditorObject, OpenDocument, PageSettings } from '../types';
import { exportPdf } from './export';
import { openPdf } from './pdf';

function matchingRuns(items: { str: string }[], terms: string[]): Set<number> {
  const offsets: { start: number; end: number }[] = [];
  let text = '';
  items.forEach((item) => { const start = text.length; text += item.str; offsets.push({ start, end: text.length }); text += ' '; });
  const matches = new Set<number>();
  const lower = text.toLocaleLowerCase();
  for (const term of terms) {
    const query = term.trim().toLocaleLowerCase();
    if (!query) continue;
    let start = lower.indexOf(query);
    while (start >= 0) {
      offsets.forEach((offset, index) => { if (offset.end > start && offset.start < start + query.length) matches.add(index); });
      start = lower.indexOf(query, start + query.length);
    }
  }
  return matches;
}

async function renderSecurePage(page: PDFPageProxy, terms: string[]) {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('This browser cannot render a secure copy.');
  await page.render({ canvas, viewport, annotationMode: AnnotationMode.ENABLE }).promise;
  const content = await page.getTextContent();
  const items = content.items.filter((item) => 'str' in item);
  const matches = matchingRuns(items, terms);
  context.fillStyle = '#000000';
  for (const index of matches) {
    const item = items[index];
    const transform = Util.transform(viewport.transform, item.transform);
    const height = Math.hypot(transform[2], transform[3]);
    const angle = Math.atan2(transform[1], transform[0]);
    const style = content.styles[item.fontName];
    const ascent = height * (style?.ascent ?? 1);
    const width = Math.max(item.width * viewport.scale, height);
    context.save();
    context.translate(transform[4], transform[5]); context.rotate(angle);
    context.fillRect(-5, -Math.max(ascent, height * 1.3) - 5, width + 10, height * 2 + 10);
    context.restore();
  }
  const data = await new Promise<Uint8Array>((resolve, reject) => canvas.toBlob((blob) => {
    if (!blob) return reject(new Error('Secure image rendering failed.'));
    void blob.arrayBuffer().then((buffer) => resolve(new Uint8Array(buffer)), reject);
  }, 'image/png'));
  return { data, width: viewport.width / 2, height: viewport.height / 2, matches: matches.size };
}

/** Rebuild only visible pixels so removed text and document payloads cannot survive. */
export async function secureExport(document: OpenDocument, objects: EditorObject[], settings: PageSettings, terms: string[] = []): Promise<Uint8Array> {
  const current = await exportPdf(document, objects, settings);
  const pdf = await openPdf({ ...document, data: current.buffer.slice(current.byteOffset, current.byteOffset + current.byteLength) as ArrayBuffer });
  const result = await PDFDocument.create();
  let matches = 0;
  try {
    for (let index = 1; index <= pdf.numPages; index += 1) {
      const rendered = await renderSecurePage(await pdf.getPage(index), terms);
      matches += rendered.matches;
      const image = await result.embedPng(rendered.data);
      result.addPage([rendered.width, rendered.height]).drawImage(image, { x: 0, y: 0, width: rendered.width, height: rendered.height });
    }
  } finally { await pdf.loadingTask.destroy(); }
  if (terms.length && !matches) throw new Error('No matching text was found in the current edited document.');
  const bytes = await result.save();
  const verification = await openPdf({ ...document, data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer });
  try {
    for (let index = 1; index <= verification.numPages; index += 1) {
      if ((await (await verification.getPage(index)).getTextContent()).items.length) throw new Error('Secure export verification failed.');
    }
  } finally { await verification.loadingTask.destroy(); }
  return bytes;
}
