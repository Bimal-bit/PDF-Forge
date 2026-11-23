import { createWorker, OEM, PSM, type Worker, type Page as OcrPage } from 'tesseract.js';
import {
  PDFDocument,
  pushGraphicsState,
  popGraphicsState,
  concatTransformationMatrix,
} from 'pdf-lib';
import { openPdf } from './pdf';
import { unicodeFont } from './fonts';
import type { OpenDocument } from '../types';
import type { OcrLine } from './ocrText';
import { enhanceOcrImage, imageOcrRegions, recognitionScale, type OcrRegion } from './ocrRegions';
import { matchOcrAppearance } from './ocrAppearance';

export interface OcrOptions {
  editable?: boolean;
  pages?: number[];
  target?: 'images' | 'pages';
  layout?: 'auto' | 'sparse' | 'block' | 'line';
  enhance?: boolean;
  area?: { x: number; y: number; width: number; height: number };
}

export interface OcrProgress {
  page: number;
  pages: number;
  progress: number;
  status: string;
}
export async function recognizePdf(
  document: OpenDocument,
  language: string,
  onProgress: (value: OcrProgress) => void,
  signal: AbortSignal,
): Promise<Uint8Array> {
  return (await recognizeDocument(document, language, onProgress, signal)).bytes;
}

export async function recognizeDocument(
  document: OpenDocument,
  language: string,
  onProgress: (value: OcrProgress) => void,
  signal: AbortSignal,
  options: OcrOptions = {},
): Promise<{ bytes: Uint8Array; lines: OcrLine[] }> {
  const result = await PDFDocument.load(document.data.slice(0));
  const font = options.editable ? undefined : await unicodeFont(result);
  const pdf = await openPdf(document);
  const lines: OcrLine[] = [];
  const pages = options.pages ?? Array.from({ length: pdf.numPages }, (_, index) => index + 1);
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
      workerPath: '/ocr/worker.min.js',
      corePath: '/ocr/core',
      langPath: '/ocr/lang',
      workerBlobURL: false,
      logger: (entry) =>
        onProgress({
          page: pageNumber,
          pages: pages.length,
          progress: entry.progress,
          status: entry.status,
        }),
    });
    void loading
      .then((created) => {
        if (signal.aborted) void created.terminate().catch(() => undefined);
      })
      .catch(() => undefined);
    worker = await Promise.race([loading, aborted]);
    for (const [index, source] of pages.entries()) {
      pageNumber = index + 1;
      signal.throwIfAborted();
      const page = await pdf.getPage(source);
      signal.throwIfAborted();
      const bounds = page.getViewport({ scale: 1, rotation: 0 });
      let regions: OcrRegion[] =
        options.target === 'pages'
          ? [{ left: 0, top: 0, width: bounds.width, height: bounds.height }]
          : await imageOcrRegions(page);
      if (options.area) {
        const area = options.area;
        const first = bounds.convertToViewportPoint(area.x, area.y + area.height),
          last = bounds.convertToViewportPoint(area.x + area.width, area.y);
        const left = Math.max(0, Math.min(first[0], last[0])),
          top = Math.max(0, Math.min(first[1], last[1]));
        const width = Math.min(bounds.width, Math.max(first[0], last[0])) - left,
          height = Math.min(bounds.height, Math.max(first[1], last[1])) - top;
        if (width <= 0 || height <= 0)
          throw new Error('The source text sample is outside this page.');
        regions = [{ left, top, width, height }];
      }
      for (const region of regions) {
        const scale = recognitionScale(region);
        const viewport = page.getViewport({ scale, rotation: 0 });
        const canvas = globalThis.document.createElement('canvas');
        canvas.width = Math.ceil(region.width * scale);
        canvas.height = Math.ceil(region.height * scale);
        try {
          signal.throwIfAborted();
          const rendering = page.render({
            canvas,
            viewport,
            transform: [1, 0, 0, 1, -region.left * scale, -region.top * scale],
            background: '#ffffff',
          });
          const cancelRender = () => rendering.cancel();
          signal.addEventListener('abort', cancelRender, { once: true });
          try {
            await rendering.promise;
          } finally {
            signal.removeEventListener('abort', cancelRender);
          }
          signal.throwIfAborted();
          let image: HTMLCanvasElement | undefined;
          let recognized: OcrPage;
          try {
            image = options.enhance === false ? undefined : enhanceOcrImage(canvas);
            const layout = {
              auto: PSM.AUTO,
              sparse: PSM.SPARSE_TEXT,
              block: PSM.SINGLE_BLOCK,
              line: PSM.SINGLE_LINE,
            }[options.layout ?? 'auto'];
            const attempts =
              options.layout && options.layout !== 'auto'
                ? [layout]
                : [PSM.SPARSE_TEXT, PSM.SINGLE_BLOCK];
            let best: OcrPage | undefined;
            for (const mode of attempts) {
              signal.throwIfAborted();
              await worker.setParameters({ tessedit_pageseg_mode: mode, user_defined_dpi: '300' });
              const candidate = (
                await Promise.race([
                  worker.recognize(image ?? canvas, {}, { text: true, blocks: true }),
                  aborted,
                ])
              ).data;
              if (
                !best ||
                (candidate.text.trim().length && candidate.confidence > best.confidence) ||
                !best.text.trim()
              )
                best = candidate;
              if (best.text.trim() && best.confidence >= 75) break;
            }
            recognized = best!;
          } finally {
            if (image) image.width = image.height = 0;
          }
          const output = result.getPage(source - 1);
          for (const block of recognized.blocks ?? [])
            for (const paragraph of block.paragraphs)
              for (const line of paragraph.lines) {
                if (!line.text.trim()) continue;
                const [x, y] = viewport.convertToPdfPoint(
                  line.bbox.x0 + region.left * scale,
                  line.bbox.y1 + region.top * scale,
                );
                const baseline = viewport.convertToPdfPoint(
                  line.baseline.x0 + region.left * scale,
                  line.baseline.y0 + region.top * scale,
                )[1];
                if (options.editable)
                  onProgress({
                    page: pageNumber,
                    pages: pages.length,
                    progress: 1,
                    status: 'Matching image lettering',
                  });
                lines.push({
                  id: crypto.randomUUID(),
                  page: source,
                  text: line.text.trim(),
                  originalText: line.text.trim(),
                  confidence: line.confidence,
                  x,
                  y,
                  width: (line.bbox.x1 - line.bbox.x0) / scale,
                  height: (line.bbox.y1 - line.bbox.y0) / scale,
                  baseline,
                  ...(options.editable
                    ? await matchOcrAppearance(canvas, line, scale, signal)
                    : {}),
                });
                if (!font) continue;
                for (const word of line.words) {
                  const text = word.text.trim();
                  if (!text) continue;
                  const size = Math.max(4, (word.bbox.y1 - word.bbox.y0) / scale);
                  const width = Math.max(1, (word.bbox.x1 - word.bbox.x0) / scale);
                  const ratio = width / Math.max(1, font.widthOfTextAtSize(text, size));
                  const [wordX, wordY] = viewport.convertToPdfPoint(
                    word.bbox.x0 + region.left * scale,
                    word.bbox.y1 + region.top * scale,
                  );
                  output.pushOperators(
                    pushGraphicsState(),
                    concatTransformationMatrix(ratio, 0, 0, 1, wordX, wordY),
                  );
                  output.drawText(text, { x: 0, y: 0, size, font, opacity: 0 });
                  output.pushOperators(popGraphicsState());
                }
              }
          onProgress({
            page: pageNumber,
            pages: pages.length,
            progress: 1,
            status: 'Page recognized',
          });
        } finally {
          canvas.width = 0;
          canvas.height = 0;
        }
      }
    }
    signal.throwIfAborted();
    return {
      bytes: options.editable ? new Uint8Array(document.data.slice(0)) : await result.save(),
      lines,
    };
  } finally {
    if (abort) signal.removeEventListener('abort', abort);
    try {
      await worker?.terminate();
    } finally {
      await pdf.loadingTask.destroy();
    }
  }
}
