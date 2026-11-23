import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { TextObject } from '../types';
import { useTextEditStore } from '../store/useTextEditStore';
import { missingFontCharacters } from '../lib/textFonts';
import { coverStyle, inlineTextStyle } from '../lib/inlineText';
import { useTextFonts } from './useTextFonts';
import { preservesOcrPixels } from '../lib/ocrAppearance';

export interface CaretPoint {
  x: number;
  y: number;
}

function focusAtPoint(element: HTMLElement, point?: CaretPoint) {
  element.focus({ preventScroll: true });
  const selection = window.getSelection();
  const documentWithCaret = document as Document & {
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  const range = point ? documentWithCaret.caretRangeFromPoint?.(point.x, point.y) : undefined;
  if (range && element.contains(range.startContainer)) {
    selection?.removeAllRanges();
    selection?.addRange(range);
  } else {
    const end = document.createRange();
    end.selectNodeContents(element);
    end.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(end);
  }
}

export function InPlaceTextEditor({
  object,
  zoom,
  caretPoint,
  onCommit,
  onCancel,
}: {
  object: TextObject;
  zoom: number;
  caretPoint?: CaretPoint;
  onCommit: (text: string) => void;
  onCancel: () => void;
}) {
  const editor = useRef<HTMLDivElement>(null);
  const finished = useRef(false);
  const [text, setText] = useState(object.text);
  const current = useMemo(() => ({ ...object, text }), [object, text]);
  const fonts = useMemo(() => [current], [current]);
  useTextFonts(fonts);
  const missing = missingFontCharacters(current);
  const warning = current.fallback
    ? `Original font ${current.sourceFontName ?? current.fontFamily} unavailable. Import the matching font in Home.`
    : missing
      ? `Missing glyphs (${missing.slice(0, 20)}). Import the full matching font in Home.`
      : '';
  useLayoutEffect(() => {
    if (!editor.current) return;
    editor.current.textContent = object.text;
    focusAtPoint(editor.current, caretPoint);
  }, [object, caretPoint]);
  useEffect(() => {
    useTextEditStore.getState().setDraft(current);
  }, [current]);
  return (
    <>
      {object.cover && !preservesOcrPixels(current) && (
        <span className="inline-source-cover" style={{ ...coverStyle(object, zoom), zIndex: 3 }} />
      )}
      <div
        ref={editor}
        aria-label="Edit PDF text"
        role="textbox"
        aria-multiline="true"
        contentEditable="plaintext-only"
        suppressContentEditableWarning
        spellCheck={false}
        className="inplace-editor"
        style={{ ...inlineTextStyle(current, zoom), color: preservesOcrPixels(current) ? 'transparent' : current.color, zIndex: 4 }}
        onInput={(event) => setText(event.currentTarget.innerText.replace(/\r/g, ''))}
        onBlur={(event) => {
          if (finished.current) return;
          finished.current = true;
          onCommit(event.currentTarget.innerText.replace(/\r/g, ''));
        }}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return;
          event.preventDefault();
          event.stopPropagation();
          finished.current = true;
          useTextEditStore.getState().setDraft(undefined);
          onCancel();
        }}
      />
      {warning && (
        <span
          className="font-edit-status"
          role="status"
          style={{ left: (object.x * zoom) / 100, bottom: ((object.y - 24) * zoom) / 100 }}
        >
          {warning}
        </span>
      )}
    </>
  );
}
