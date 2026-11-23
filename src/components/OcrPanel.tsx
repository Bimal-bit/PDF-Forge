import { useRef, useState, useEffect, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { useAppStore } from '../store/useAppStore';
import { exportPdf } from '../lib/export';
import { recognizeDocument, type OcrProgress, type OcrOptions } from '../lib/ocr';
import { editableOcrObjects, type OcrLine } from '../lib/ocrText';
import { unicodeFont } from '../lib/fonts';
import { downloadBlob } from '../lib/downloads';
import { EditorDialog } from './EditorDialog';
import { useViewStore } from '../store/useViewStore';
import { OcrFontReview } from './OcrFontReview';
import '../ocr.css';

export function OcrPanel({ onClose }: { onClose: () => void }) {
  const state = useAppStore();
  const [language, setLanguage] = useState('eng');
  const [mode, setMode] = useState(useViewStore.getState().ocrEditable ? 'editable' : 'searchable');
  const [scope, setScope] = useState('all');
  const [target, setTarget] = useState<'images' | 'pages'>('images');
  const [layout, setLayout] = useState<OcrOptions['layout']>('auto');
  const [enhance, setEnhance] = useState(true);
  const [progress, setProgress] = useState<OcrProgress>();
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<{ bytes: Uint8Array; lines: OcrLine[] }>();
  const [reviewPage, setReviewPage] = useState(1);
  const [fontJobs, setFontJobs] = useState<Record<string, boolean>>({});
  const fontBusy = Object.values(fontJobs).some(Boolean);
  const fontJob = useCallback(
    (id: string, value: boolean) => setFontJobs((jobs) => ({ ...jobs, [id]: value })),
    [],
  );
  const controller = useRef<AbortController>();
  const snapshot = useRef(state);
  const live = useRef(true);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      controller.current?.abort();
    };
  }, []);
  const check = () => {
    if (!live.current) throw new DOMException('OCR cancelled', 'AbortError');
    const current = useAppStore.getState();
    const previous = snapshot.current;
    if (
      current.document !== previous.document ||
      current.objects !== previous.objects ||
      current.pageSettings !== previous.pageSettings
    )
      throw new Error(
        'The document changed during OCR. No OCR results were applied; recognize it again.',
      );
  };
  const apply = async (result: { bytes: Uint8Array; lines: OcrLine[] }, editable: boolean) => {
    check();
    const previous = snapshot.current;
    const pdf = await PDFDocument.load(result.bytes.slice());
    const font = editable ? await unicodeFont(pdf) : undefined;
    const objects = font
      ? editableOcrObjects(result.lines, (text) => font.widthOfTextAtSize(text, 1))
      : [];
    check();
    state.applyOcrDocument(
      {
        ...previous.document!,
        id: crypto.randomUUID(),
        data: result.bytes.slice().buffer as ArrayBuffer,
        size: result.bytes.byteLength,
      },
      objects,
      pdf.getPageCount(),
      previous.selectedPage,
    );
    state.setNotice(
      editable
        ? `${objects.length} editable text boxes created. Tap a text box or use the Inspector to edit it. Undo restores the previous document.`
        : 'OCR completed. Recognized text is searchable in this document.',
    );
    onClose();
  };
  const run = async () => {
    const current = useAppStore.getState();
    if (!current.document || !current.pageSettings.order.length) return;
    snapshot.current = current;
    const operation = new AbortController();
    controller.current = operation;
    setBusy(true);
    setProgress(undefined);
    setReview(undefined);
    try {
      const bytes = await exportPdf(current.document, current.objects, current.pageSettings);
      operation.signal.throwIfAborted();
      const input = { ...current.document, data: bytes.slice().buffer as ArrayBuffer };
      const result = await recognizeDocument(
        input,
        language,
        (value) => {
          if (live.current) setProgress(value);
        },
        operation.signal,
        {
          editable: mode === 'editable',
          pages: scope === 'current' ? [current.selectedPage] : undefined,
          target,
          layout,
          enhance,
        },
      );
      operation.signal.throwIfAborted();
      check();
      if (!result.lines.some((line) => line.text.trim())) {
        state.setNotice(
          'No text was detected. Try Whole pages or another text layout. Improve faint text can help low-contrast scans; blurry images may need a clearer source.',
        );
        return;
      }
      if (mode === 'editable') {
        setReview(result);
        setReviewPage(result.lines[0].page);
      } else await apply(result, false);
    } catch (error) {
      if (live.current)
        state.setNotice(
          operation.signal.aborted
            ? 'OCR cancelled. Your document is unchanged.'
            : error instanceof Error
              ? error.message
              : 'OCR failed.',
        );
    } finally {
      if (live.current) setBusy(false);
      controller.current = undefined;
    }
  };
  const save = async () => {
    if (!review) return;
    setBusy(true);
    try {
      await apply(review, true);
    } catch (error) {
      state.setNotice(error instanceof Error ? error.message : 'Could not apply OCR text.');
    } finally {
      if (live.current) setBusy(false);
    }
  };
  const pages = [...new Set(review?.lines.map((line) => line.page))];
  return (
    <EditorDialog title="Offline OCR" onClose={onClose}>
      <p className="ocr-intro">
        Detect English or Spanish text inside PDF images and scanned pages, entirely on your device.
        Images are recognized separately at higher resolution.
      </p>
      {!review ? (
        <>
          <div className="ocr-options">
            <label>
              Recognition language
              <select
                aria-label="OCR language"
                value={language}
                disabled={busy}
                onChange={(event) => setLanguage(event.target.value)}
              >
                <option value="eng">English</option>
                <option value="spa">Spanish</option>
                <option value="eng+spa">English and Spanish</option>
              </select>
            </label>
            <label>
              Pages
              <select
                aria-label="OCR pages"
                value={scope}
                disabled={busy}
                onChange={(event) => setScope(event.target.value)}
              >
                <option value="all">All pages</option>
                <option value="current">Current page ({state.selectedPage})</option>
              </select>
            </label>
          </div>
          <details className="ocr-advanced">
            <summary>Recognition options</summary>
            <div className="ocr-options">
              <label>
                Text to recognize
                <select
                  aria-label="OCR target"
                  value={target}
                  disabled={busy}
                  onChange={(event) => setTarget(event.target.value as 'images' | 'pages')}
                >
                  <option value="images">Images inside PDF · keep existing PDF text</option>
                  <option value="pages">Whole pages · for unusual image layouts</option>
                </select>
              </label>
              <label>
                Text layout
                <select
                  aria-label="OCR layout"
                  value={layout}
                  disabled={busy}
                  onChange={(event) => setLayout(event.target.value as OcrOptions['layout'])}
                >
                  <option value="auto">Automatic · retry weak detection</option>
                  <option value="sparse">Scattered text / screenshot</option>
                  <option value="block">Paragraph / text block</option>
                  <option value="line">Single line</option>
                </select>
              </label>
            </div>
            <label className="ocr-enhance">
              <input
                type="checkbox"
                aria-label="Improve faint text"
                checked={enhance}
                disabled={busy}
                onChange={(event) => setEnhance(event.target.checked)}
              />
              Improve faint text and dark backgrounds for recognition
            </label>
          </details>
          <label>
            Result
            <select
              aria-label="OCR result"
              value={mode}
              disabled={busy}
              onChange={(event) => setMode(event.target.value)}
            >
              <option value="searchable">Searchable PDF · preserve scan appearance</option>
              <option value="editable">Editable text boxes · review before applying</option>
            </select>
          </label>
          <p className="ocr-boundary">
            Editable mode keeps original image pixels until you change text or formatting. Changed
            lines retain their detected position, size and sampled colors, using an approximate
            matching font. Home can change the font manually.
          </p>
          <div className="ocr-actions">
            <button
              disabled={!state.document || !state.pageSettings.order.length || busy}
              onClick={() => void run()}
            >
              Recognize document
            </button>
            {busy && <button onClick={() => controller.current?.abort()}>Cancel OCR</button>}
          </div>
        </>
      ) : (
        <>
          <div className="ocr-review-heading">
            <h3>Review detected text</h3>
            <span>{review.lines.length} lines</span>
          </div>
          <p className="ocr-boundary">
            Correct mistakes below. Unchanged lines keep their original appearance. Only edited
            lines are repainted. Empty lines are skipped; apply to edit and format in Home.
          </p>
          <label>
            Review page
            <select
              aria-label="OCR review page"
              value={reviewPage}
              onChange={(event) => setReviewPage(Number(event.target.value))}
            >
              {pages.map((page) => (
                <option key={page} value={page}>
                  Page {page}
                </option>
              ))}
            </select>
          </label>
          <div className="ocr-lines">
            {review.lines
              .filter((line) => line.page === reviewPage)
              .map((line, index) => (
                <div className="ocr-line" key={line.id}>
                  <label>
                    Line {index + 1}{' '}
                    <span>
                      {Math.round(line.confidence)}% confidence
                      {line.confidence < 75 ? ' · check carefully' : ''}
                      {line.fontFamily
                        ? ` · ${line.fontFamily}${line.bold ? ' Bold' : ''}${line.italic ? ' Italic' : ''} · ${line.fontSize?.toFixed(1)} pt (approx.)`
                        : ''}
                    </span>
                    <textarea
                      aria-label={`OCR line ${index + 1}`}
                      value={line.text}
                      maxLength={4000}
                      disabled={busy}
                      rows={2}
                      onChange={(event) =>
                        setReview({
                          ...review,
                          lines: review.lines.map((entry) =>
                            entry.id === line.id
                              ? { ...entry, text: event.target.value.replace(/\r?\n/g, ' ') }
                              : entry,
                          ),
                        })
                      }
                    />
                  </label>
                  <OcrFontReview
                    line={line}
                    index={index}
                    disabled={busy}
                    onBusy={fontJob}
                    onChange={(patch) =>
                      setReview((current) =>
                        current
                          ? {
                              ...current,
                              lines: current.lines.map((entry) =>
                                entry.id === line.id ? { ...entry, ...patch } : entry,
                              ),
                            }
                          : current,
                      )
                    }
                  />
                </div>
              ))}
          </div>
          <div className="ocr-actions">
            <button
              disabled={busy || fontBusy || !review.lines.some((line) => line.text.trim())}
              onClick={() => void save()}
            >
              Apply editable text
            </button>
            <button
              disabled={busy}
              onClick={() =>
                downloadBlob(
                  new Blob([review.lines.map((line) => line.text).join('\n')], {
                    type: 'text/plain;charset=utf-8',
                  }),
                  'recognized-text.txt',
                )
              }
            >
              Download text
            </button>
            <button
              disabled={busy}
              onClick={() => {
                setReview(undefined);
                setProgress(undefined);
              }}
            >
              Recognize again
            </button>
          </div>
        </>
      )}
      {busy && progress && (
        <div role="status">
          <progress
            aria-label="OCR progress"
            value={(progress.page - 1 + progress.progress) / progress.pages}
            max="1"
          />
          <p>
            Page {progress.page} of {progress.pages} — {progress.status}
          </p>
        </div>
      )}
    </EditorDialog>
  );
}
