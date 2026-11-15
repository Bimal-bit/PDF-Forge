import { createWorker, OEM, type Worker } from 'tesseract.js';
import { PDFDocument, pushGraphicsState, popGraphicsState, concatTransformationMatrix } from 'pdf-lib';
import { openPdf } from './pdf';
import { unicodeFont } from './fonts';
import type { OpenDocument } from '../types';

export interface OcrProgress { page: number; pages: number; progress: number; status: string }
export async function recognizePdf(document: OpenDocument, language: string, onProgress: (value: OcrProgress) => void, signal: AbortSignal): Promise<Uint8Array> {
  const result = await PDFDocument.load(document.data.slice(0));
  const font = await unicodeFont(result);
  const pdf = await openPdf(document);
  let worker: Worker | undefined;
  let pageNumber = 1;
  let abort: (() => void) | undefined;
  const aborted = new Promise<never>((_, reject) => {
    abort = () => reject(new DOMException('OCR cancelled', 'AbortError'));
    signal.addEventListener('abort', abort, { once: true });
  });
  // Observe cancellation even if it arrives before recognition begins.
  void aborted.catch(() => undefined);
  try {
    signal.throwIfAborted();
    const loading = createWorker(language, OEM.LSTM_ONLY, {
      workerPath: '/ocr/worker.min.js', corePath: '/ocr/core', langPath: '/ocr/lang', workerBlobURL: false,
      logger: (entry) => onProgress({ page: pageNumber, pages: pdf.numPages, progress: entry.progress, status: entry.status }),
    });
    void loading.then((created) => { if (signal.aborted) void created.terminate(); }).catch(() => undefined);
    worker = await Promise.race([loading, aborted]);
    for (pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      signal.throwIfAborted();
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 2, rotation: 0 });
      const canvas = globalThis.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      await page.render({ canvas, viewport }).promise;
      const recognized = await Promise.race([worker.recognize(canvas, {}, { text: true, blocks: true }), aborted]);
      const output = result.getPage(pageNumber - 1);
      for (const block of recognized.data.blocks ?? []) for (const paragraph of block.paragraphs) for (const line of paragraph.lines) for (const word of line.words) {
        const text = word.text.trim();
        if (!text) continue;
        const size = Math.max(4, (word.bbox.y1 - word.bbox.y0) / 2);
        const width = Math.max(1, (word.bbox.x1 - word.bbox.x0) / 2);
        const ratio = width / Math.max(1, font.widthOfTextAtSize(text, size));
        output.pushOperators(pushGraphicsState(), concatTransformationMatrix(ratio, 0, 0, 1, word.bbox.x0 / 2, output.getHeight() - word.bbox.y1 / 2));
        output.drawText(text, { x: 0, y: 0, size, font, opacity: 0 });
        output.pushOperators(popGraphicsState());
      }
      canvas.width = 0; canvas.height = 0;
      onProgress({ page: pageNumber, pages: pdf.numPages, progress: 1, status: 'Page recognized' });
    }
    signal.throwIfAborted();
    return result.save();
  } finally {
    if (abort) signal.removeEventListener('abort', abort);
    await worker?.terminate();
    await pdf.loadingTask.destroy();
  }
}
