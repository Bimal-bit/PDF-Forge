import { useCallback, useEffect, useState } from 'react';
import type { OpenDocument, PageSettings, TextObject } from '../types';
import type { OcrLine } from '../lib/ocrText';
import { useAppStore } from '../store/useAppStore';
import { EditorDialog } from './EditorDialog';
import { OcrFontReview } from './OcrFontReview';
import { ocrAppearanceKey, preservesOcrPixels } from '../lib/ocrAppearance';
import '../ocr.css';

interface Session {
  document: OpenDocument;
  object: TextObject;
  pageSettings: PageSettings;
}

export function OcrObjectFontTools({ selected }: { selected?: TextObject }) {
  const [session, setSession] = useState<Session>();
  if (!selected?.ocr) return null;
  return (
    <>
      <button
        type="button"
        title="Rematch the source image font while keeping your edited wording"
        onClick={() => {
          const state = useAppStore.getState(),
            object = state.objects.find((entry) => entry.id === selected.id);
          if (state.document && object?.type === 'text' && object.ocr)
            setSession({ document: state.document, object, pageSettings: state.pageSettings });
        }}
      >
        Match image font
      </button>
      {session && <ObjectFontDialog session={session} onClose={() => setSession(undefined)} />}
    </>
  );
}

function ObjectFontDialog({ session, onClose }: { session: Session; onClose: () => void }) {
  const [line, setLine] = useState<OcrLine>(),
    [busy, setBusy] = useState(true),
    [fontBusy, setFontBusy] = useState(false),
    [message, setMessage] = useState('Reading the original image lettering…');
  const fontJob = useCallback((_: string, value: boolean) => setFontBusy(value), []);
  useEffect(() => {
    let live = true;
    const controller = new AbortController();
    const object = session.object,
      cover = object.cover;
    void (async () => {
      if (!cover)
        throw new Error(
          'This text has no original image region. Use OCR to recognize the image again.',
        );
      const { recognizeDocument } = await import('../lib/ocr');
      const result = await recognizeDocument(
        session.document,
        'eng+spa',
        (progress) => {
          if (live) setMessage(progress.status);
        },
        controller.signal,
        {
          editable: true,
          pages: [object.page],
          target: 'pages',
          layout: 'line',
          area: {
            x: (cover.x ?? object.x) - 3,
            y: (cover.y ?? object.y) - 3,
            width: cover.width + 2,
            height: cover.height + 2,
          },
        },
      );
      if (!live) return;
      const recognized = result.lines[0];
      if (!recognized)
        throw new Error(
          'The original lettering could not be recognized. Import its matching font in Home.',
        );
      setLine({
        ...recognized,
        text: object.text,
        originalText: recognized.originalText ?? recognized.text,
        color: object.color,
      });
      setMessage(
        'Your edited wording will stay the same. Compare the source lettering, then apply the matched face or import the exact font.',
      );
    })()
      .catch((error: unknown) => {
        if (live) setMessage(error instanceof Error ? error.message : 'Font matching failed.');
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
      controller.abort();
    };
  }, [session]);
  const apply = () => {
    if (!line) return;
    const state = useAppStore.getState();
    if (
      state.document !== session.document ||
      state.pageSettings !== session.pageSettings ||
      state.objects.find((entry) => entry.id === session.object.id) !== session.object
    )
      return setMessage(
        'The text changed while matching. Close this dialog and match the current text again.',
      );
    const object = session.object;
    const sourceLayout = object.sourceLayout
      ? {
          ...object.sourceLayout,
          fontFamily: line.fontFamily ?? 'Helvetica',
          bold: Boolean(line.bold),
          italic: Boolean(line.italic),
          horizontalScale: line.horizontalScale ?? 1,
        }
      : undefined;
    const patch = {
      fontFamily: line.fontFamily,
      fontFace: line.fontFace,
      fontSize: line.fontSize ?? object.fontSize,
      bold: line.bold,
      italic: line.italic,
      sourceLayout,
    };
    const next = { ...object, ...patch };
    state.updateObject(
      object.id,
      preservesOcrPixels(object) && object.ocr
        ? { ...patch, ocr: { ...object.ocr, appearance: ocrAppearanceKey(next) } }
        : patch,
    );
    onClose();
  };
  return (
    <EditorDialog title="Match image font" onClose={onClose}>
      <p className="ocr-boundary" role="status">
        {message}
      </p>
      {line && (
        <>
          <p aria-label="Detected image font">
            {line.fontFamily}
            {line.bold ? ' Bold' : ''}
            {line.italic ? ' Italic' : ''} · {line.fontSize?.toFixed(1)} pt (approx.)
          </p>
          <OcrFontReview
            line={line}
            index={0}
            disabled={busy}
            onChange={(patch) =>
              setLine((current) => (current ? { ...current, ...patch } : current))
            }
            onBusy={fontJob}
          />
        </>
      )}
      <div className="ocr-actions">
        <button disabled={!line || busy || fontBusy} onClick={apply}>
          Apply matched font
        </button>
      </div>
    </EditorDialog>
  );
}
