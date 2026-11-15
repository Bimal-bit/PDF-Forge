import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type {
  EditingLibraryEntry,
  SavedSnippet,
  StyleKind,
  TextFormat,
  TextObject,
} from '../types';
import {
  deleteLibraryEntry,
  listLibraryEntries,
  saveLibraryEntry,
  textFormat,
} from '../lib/editingLibrary';
import { useAppStore } from '../store/useAppStore';
import '../editing-library.css';

export function EditingLibrary({
  selected,
  onApply,
}: {
  selected?: TextObject;
  onApply: (format: Partial<TextFormat> & { fallback?: boolean }) => void;
}) {
  const { document, pageSettings, selectedPage, addObject } = useAppStore();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<EditingLibraryEntry[]>([]);
  const [tab, setTab] = useState<'style' | 'snippet'>('style');
  const [name, setName] = useState('');
  const [styleKind, setStyleKind] = useState<StyleKind>('paragraph');
  const [text, setText] = useState('');
  const [position, setPosition] = useState({ x: 72, y: 72, width: 300 });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (!open) return;
    let live = true;
    dialog.current?.showModal();
    setLoading(true);
    setMessage('');
    void listLibraryEntries()
      .then((saved) => {
        if (live) setEntries(saved);
      })
      .catch(() => {
        if (live) setMessage('The local library could not be loaded. Reopen it to retry.');
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [open]);

  const save = async () => {
    if (!name.trim() || (tab === 'style' ? !selected : !text.trim())) return;
    const entry: EditingLibraryEntry =
      tab === 'style'
        ? {
            id: crypto.randomUUID(),
            kind: 'style',
            name: name.trim(),
            styleKind,
            format: textFormat(selected, styleKind),
          }
        : {
            id: crypto.randomUUID(),
            kind: 'snippet',
            name: name.trim(),
            text,
            format: textFormat(selected),
          };
    setBusy(true);
    try {
      await saveLibraryEntry(entry);
      setEntries((current) => [...current, entry].sort((a, b) => a.name.localeCompare(b.name)));
      setName('');
      setMessage(`${entry.name} saved in this browser.`);
    } catch {
      setMessage('The entry could not be saved. Your input is ready to retry.');
    } finally {
      setBusy(false);
    }
  };
  const remove = async (entry: EditingLibraryEntry) => {
    setBusy(true);
    try {
      await deleteLibraryEntry(entry.id);
      setEntries((current) => current.filter((saved) => saved.id !== entry.id));
      setMessage(`${entry.name} deleted from the library.`);
    } catch {
      setMessage('The entry could not be deleted. Try again.');
    } finally {
      setBusy(false);
    }
  };
  const insert = (entry: SavedSnippet) => {
    if (!document) return;
    addObject({
      ...entry.format,
      ...position,
      id: crypto.randomUUID(),
      type: 'text',
      page: pageSettings.order[selectedPage - 1] ?? selectedPage,
      text: entry.text,
      fallback: false,
    });
    setMessage(`${entry.name} inserted on page ${selectedPage}.`);
  };

  return (
    <>
      <button onClick={() => setOpen(true)}>Styles &amp; snippets</button>
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            className="editing-library"
            aria-labelledby="library-title"
            onClose={() => setOpen(false)}
          >
            <div className="library-heading">
              <h2 id="library-title">Styles &amp; snippets</h2>
              <button aria-label="Close editing library" onClick={() => dialog.current?.close()}>
                Close
              </button>
            </div>
            <div className="library-tabs" role="group" aria-label="Library category">
              <button
                aria-pressed={tab === 'style'}
                onClick={() => {
                  setTab('style');
                  setName('');
                  setMessage('');
                }}
              >
                Styles
              </button>
              <button
                aria-pressed={tab === 'snippet'}
                onClick={() => {
                  setTab('snippet');
                  setName('');
                  setMessage('');
                }}
              >
                Snippets
              </button>
            </div>
            <p className="library-help">Saved in this browser and available across files.</p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <label>
                Name
                <input
                  aria-label="Library entry name"
                  value={name}
                  maxLength={100}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </label>
              {tab === 'style' ? (
                <>
                  <label>
                    Preset type
                    <select
                      aria-label="Preset type"
                      value={styleKind}
                      onChange={(event) => setStyleKind(event.target.value as StyleKind)}
                    >
                      <option value="paragraph">Paragraph</option>
                      <option value="character">Character</option>
                    </select>
                  </label>
                  <p className="library-help">
                    {selected
                      ? `Save formatting from “${selected.text.slice(0, 45)}”.`
                      : 'Select or create a text block to save its formatting.'}{' '}
                    Character presets apply font formatting to whole blocks.
                  </p>
                </>
              ) : (
                <>
                  <label>
                    Snippet text
                    <textarea
                      aria-label="Snippet text"
                      value={text}
                      onChange={(event) => setText(event.target.value)}
                      required
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!selected}
                    onClick={() => setText(selected?.text ?? '')}
                  >
                    Use selected text
                  </button>
                </>
              )}
              <button
                type="submit"
                disabled={
                  busy || loading || !name.trim() || (tab === 'style' ? !selected : !text.trim())
                }
              >
                {tab === 'style' ? 'Save selected style' : 'Save snippet'}
              </button>
            </form>
            {tab === 'snippet' && (
              <fieldset className="snippet-position">
                <legend>Insert position in PDF points from the bottom left</legend>
                {(['x', 'y', 'width'] as const).map((key) => (
                  <label key={key}>
                    {key === 'width' ? 'Width' : key.toUpperCase()}
                    <input
                      aria-label={`Snippet ${key}`}
                      type="number"
                      min={key === 'width' ? 20 : 0}
                      max={14400}
                      value={position[key]}
                      onChange={(event) =>
                        setPosition({
                          ...position,
                          [key]: Math.max(
                            key === 'width' ? 20 : 0,
                            Math.min(14400, Number(event.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </fieldset>
            )}
            <p className="library-message" role="status">
              {loading ? 'Loading local library…' : message}
            </p>
            <ul
              className="library-entries"
              aria-label={tab === 'style' ? 'Saved styles' : 'Saved snippets'}
            >
              {entries
                .filter((entry) => entry.kind === tab)
                .map((entry) => (
                  <li key={entry.id}>
                    <div>
                      <strong>{entry.name}</strong>
                      <p>
                        {entry.kind === 'style'
                          ? `${entry.styleKind === 'paragraph' ? 'Paragraph' : 'Character'} · ${entry.format.fontFamily} · ${entry.format.fontSize} pt`
                          : entry.text}
                      </p>
                    </div>
                    <div className="library-entry-actions">
                      <button
                        disabled={busy || (entry.kind === 'style' ? !selected : !document)}
                        aria-label={`${entry.kind === 'style' ? 'Apply' : 'Insert'} ${entry.name}`}
                        onClick={() => {
                          if (entry.kind === 'snippet') insert(entry);
                          else {
                            onApply({ ...entry.format, fallback: false });
                            setMessage(`${entry.name} applied to selected text.`);
                          }
                        }}
                      >
                        {entry.kind === 'style' ? 'Apply' : 'Insert'}
                      </button>
                      <button
                        disabled={busy}
                        aria-label={`Delete ${entry.name}`}
                        onClick={() => void remove(entry)}
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
            {!loading && !entries.some((entry) => entry.kind === tab) && (
              <p>No saved {tab === 'style' ? 'styles' : 'snippets'} yet.</p>
            )}
          </dialog>,
          globalThis.document.querySelector('.app')!,
        )}
    </>
  );
}
