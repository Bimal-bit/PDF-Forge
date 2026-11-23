import { ClipboardPaste, Copy, Plus, Search } from 'lucide-react';
import { useState } from 'react';
import type { TextFormat, TextObject } from '../types';
import { copiedTextFormat, textStatistics } from '../lib/homeText';
import { useAppStore } from '../store/useAppStore';
import { useTextEditStore } from '../store/useTextEditStore';
import { useTextSelectionStore } from '../store/useTextSelectionStore';
import { useAddText } from './useAddText';
import { useViewStore } from '../store/useViewStore';

export function HomeSelectionTools() {
  const { mode, busy, setMode, selectAll } = useTextSelectionStore();
  return (
    <div className="format-group home-selection-tools">
      <button
        aria-pressed={mode === 'select'}
        title="Drag across lines to select them. Click again or press Escape to return to caret editing."
        onClick={() => {
          useTextEditStore.getState().setDraft(undefined);
          window.getSelection()?.removeAllRanges();
          setMode(mode === 'select' ? 'edit' : 'select');
        }}
      >
        Select text
      </button>
      <button
        title="Select all document text (Ctrl+A / ⌘A), including offscreen pages"
        disabled={busy}
        onClick={selectAll}
      >
        {busy ? 'Selecting text…' : 'Select all text'}
      </button>
      <span className="ribbon-group-label">Selection</span>
    </div>
  );
}

export function HomeQuickTools() {
  const { ready, addText } = useAddText();
  return (
    <div className="format-group home-quick-tools">
      <button
        className="home-add-text"
        disabled={!ready}
        onClick={addText}
      >
        <Plus size={14} aria-hidden="true" /> Add text
      </button>
      <button
        title="Find in document (Ctrl+F / ⌘F)"
        onClick={() => useViewStore.getState().openSearch()}
      >
        <Search size={14} aria-hidden="true" /> Find
      </button>
      <span className="ribbon-group-label">Start here</span>
    </div>
  );
}

export function FormatPainter({
  selected,
  update,
}: {
  selected?: TextObject;
  update: (format: Partial<TextFormat> & { fallback?: boolean }) => void;
}) {
  const [copied, setCopied] = useState<ReturnType<typeof copiedTextFormat>>();
  const setNotice = useAppStore((state) => state.setNotice);
  return (
    <div className="format-group home-format-painter">
      <button
        disabled={!selected}
        title="Copy this block's font and paragraph formatting"
        onClick={() => {
          if (!selected) return;
          try {
            setCopied(copiedTextFormat(selected));
            setNotice(
              'Formatting copied. Select another text block, then choose Paste formatting.',
            );
          } catch (error) {
            setNotice(error instanceof Error ? error.message : 'Could not copy this formatting.');
          }
        }}
      >
        <Copy size={14} aria-hidden="true" /> Copy formatting
      </button>
      <button
        disabled={!selected || !copied}
        title="Apply copied formatting without changing text or position"
        onClick={() => {
          if (copied) update(copied);
        }}
      >
        <ClipboardPaste size={14} aria-hidden="true" /> Paste formatting
      </button>
      <span className="ribbon-group-label">Format painter</span>
    </div>
  );
}

export function HomeSelection({
  selected,
  texts,
  draft,
  matchCount,
  sourceLayout,
}: {
  selected?: TextObject;
  texts: TextObject[];
  draft?: TextObject;
  matchCount?: number;
  sourceLayout?: boolean;
}) {
  const { selectObject, pageSettings, selectedPage, setSelectedPage } = useAppStore();
  const { group, busy, mode } = useTextSelectionStore();
  const stats = textStatistics(group?.text ?? selected?.text ?? '');
  return (
    <div className="home-selection-bar" aria-label="Home selection details">
      <label>
        Text block
        <select
          aria-label="Text block"
          value={selected?.id ?? ''}
          onChange={(event) => {
            useTextSelectionStore.getState().setMode('edit');
            window.getSelection()?.removeAllRanges();
            const target = texts.find((text) => text.id === event.target.value);
            useTextEditStore.getState().setDraft(undefined);
            selectObject(event.target.value);
            if (target && pageSettings.order[selectedPage - 1] !== target.page) {
              const index = pageSettings.order.indexOf(target.page);
              if (index >= 0) setSelectedPage(index + 1);
            }
          }}
        >
          <option value="" disabled>
            Select text
          </option>
          {draft && !texts.some((text) => text.id === draft.id) && (
            <option value={draft.id}>{draft.text.slice(0, 35) || 'Empty text'}</option>
          )}
          {group &&
            !texts.some((text) => text.id === group.seed.id) &&
            group.seed.id !== draft?.id && (
              <option value={group.seed.id}>Selected document text</option>
            )}
          {texts.map((text) => (
            <option key={text.id} value={text.id}>
              {text.text.slice(0, 35) || 'Empty text'}
            </option>
          ))}
        </select>
      </label>
      {selected ? (
        <>
          <span className="home-selection-badge">
            {group
              ? `${group.ids.length} text runs selected · whole-run formatting`
              : matchCount !== undefined
                ? `${matchCount} matched blocks`
                : 'Block formatting'}
          </span>
          <span className="home-text-statistics" aria-label="Text statistics">
            {stats.words} {stats.words === 1 ? 'word' : 'words'} · {stats.characters}{' '}
            {stats.characters === 1 ? 'character' : 'characters'}
          </span>
          {sourceLayout && (
            <span className="home-layout-hint">
              Paragraph layout applies to inserted text boxes
            </span>
          )}
        </>
      ) : (
        <span className="home-selection-hint">
          {busy
            ? 'Preparing text selection…'
            : mode === 'select'
              ? 'Drag across lines, or choose Select all text. Home formats the selected lines and blocks.'
              : 'Click text on the page to edit it, or add a new text block.'}
        </span>
      )}
    </div>
  );
}
