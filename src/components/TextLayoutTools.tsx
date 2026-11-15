import { useMemo, useState } from 'react';
import { EditorDialog } from './EditorDialog';
import { useAppStore } from '../store/useAppStore';
import { layoutTextFrames, textChain } from '../lib/textFlow';
import type { TextObject } from '../types';

export function TextLayoutTools() {
  const {
    objects,
    selectedObjectId,
    selectedPage,
    pageSettings,
    document,
    selectObject,
    addObject,
    updateObject,
    updateTextObject,
    linkTextObjects,
    unlinkTextObject,
    setNotice,
  } = useAppStore();
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState('');
  const texts = objects.filter(
    (object): object is TextObject =>
      object.type === 'text' && pageSettings.order.includes(object.page),
  );
  const selected = texts.find((object) => object.id === selectedObjectId) ?? texts.at(-1);
  const targets = texts.filter(
    (object) =>
      object.id !== selected?.id &&
      !objects.some((entry) => entry.type === 'text' && entry.nextTextId === object.id) &&
      !textChain(objects, object.id).some((entry) => entry.id === selected?.id),
  );
  const target = targets.find((object) => object.id === targetId) ?? targets[0];
  const layouts = useMemo(
    () => layoutTextFrames(objects, pageSettings.order),
    [objects, pageSettings.order],
  );
  const overflow = selected ? layouts.get(selected.id)?.overflow : '';
  const label = (object: TextObject) =>
    `${pageSettings.order.includes(object.page) ? `Page ${pageSettings.order.indexOf(object.page) + 1}` : 'Removed page'} · ${object.text.slice(0, 32) || 'Empty box'}`;
  const continuation = objects.find(
    (object): object is TextObject => object.type === 'text' && object.id === selected?.nextTextId,
  );
  const update = (patch: Partial<TextObject>) => {
    if (selected) updateObject(selected.id, patch);
  };
  return (
    <>
      <button disabled={!document} onClick={() => setOpen(true)}>
        Text flow &amp; columns
      </button>
      {open && (
        <EditorDialog title="Text flow & columns" onClose={() => setOpen(false)}>
          <button
            onClick={() =>
              addObject({
                id: crypto.randomUUID(),
                type: 'text',
                page: pageSettings.order[selectedPage - 1] ?? selectedPage,
                text: '',
                x: 72,
                y: 72,
                width: 200,
                height: 160,
                fontSize: 12,
                color: '#292724',
              })
            }
          >
            Add text box
          </button>
          <label>
            Text box
            <select
              aria-label="Layout text box"
              value={selected?.id ?? ''}
              onChange={(event) => selectObject(event.target.value)}
            >
              <option value="" disabled>
                Choose a text box
              </option>
              {texts.map((object) => (
                <option key={object.id} value={object.id}>
                  {label(object)}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <>
              <label>
                Text contributed to this story
                <textarea
                  aria-label="Text box content"
                  value={selected.text}
                  onChange={(event) => updateTextObject(selected.id, event.target.value)}
                />
              </label>
              <div className="advanced-grid">
                {(['x', 'y', 'width', 'height'] as const).map((property) => (
                  <label key={property}>
                    {property.toUpperCase()}
                    <input
                      aria-label={`Text frame ${property}`}
                      type="number"
                      min={property === 'width' || property === 'height' ? 20 : 0}
                      max={14400}
                      value={selected[property] ?? (property === 'height' ? 160 : 300)}
                      onChange={(event) =>
                        update({
                          [property]: Math.max(
                            property === 'width' || property === 'height' ? 20 : 0,
                            Math.min(14400, Number(event.target.value) || 0),
                          ),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="advanced-grid">
                <label>
                  Columns
                  <select
                    aria-label="Text columns"
                    value={selected.columns ?? 1}
                    onChange={(event) =>
                      update({
                        columns: Number(event.target.value) as 1 | 2 | 3,
                        height: selected.height ?? selected.cover?.height ?? 160,
                      })
                    }
                  >
                    <option value="1">One</option>
                    <option value="2">Two</option>
                    <option value="3">Three</option>
                  </select>
                </label>
                <label>
                  Column gap
                  <input
                    aria-label="Column gap"
                    type="number"
                    min="0"
                    max="100"
                    value={selected.columnGap ?? 18}
                    onChange={(event) =>
                      update({
                        columnGap: Math.max(0, Math.min(100, Number(event.target.value) || 0)),
                      })
                    }
                  />
                </label>
                <label>
                  Drop cap
                  <select
                    aria-label="Drop cap"
                    value={selected.dropCapLines ?? 0}
                    onChange={(event) =>
                      update({
                        dropCapLines: Number(event.target.value) as 0 | 2 | 3,
                        height: selected.height ?? selected.cover?.height ?? 160,
                      })
                    }
                  >
                    <option value="0">None</option>
                    <option value="2">Two lines</option>
                    <option value="3">Three lines</option>
                  </select>
                </label>
              </div>
              {selected.nextTextId ? (
                <>
                  <p>
                    Continues into {continuation ? label(continuation) : 'an unavailable text box'}.
                  </p>
                  <button onClick={() => unlinkTextObject(selected.id)}>Unlink continuation</button>
                </>
              ) : (
                <>
                  <label>
                    Continue into
                    <select
                      aria-label="Continue into text box"
                      value={target?.id ?? ''}
                      onChange={(event) => setTargetId(event.target.value)}
                    >
                      <option value="" disabled>
                        Add another text box to link
                      </option>
                      {targets.map((object) => (
                        <option key={object.id} value={object.id}>
                          {label(object)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    disabled={!target}
                    onClick={() => {
                      if (!target) return;
                      try {
                        linkTextObjects(selected.id, target.id);
                      } catch (error) {
                        setNotice(
                          error instanceof Error
                            ? error.message
                            : 'Could not link these text boxes.',
                        );
                      }
                    }}
                  >
                    Link text boxes
                  </button>
                </>
              )}
              {overflow && (
                <p role="status" className="editing-warning">
                  {overflow.length} characters overflow this story. Enlarge the frames or link
                  another box to fit the text for export.
                </p>
              )}
            </>
          )}
          <p className="editing-help">
            Linked boxes combine their text in chain order. Each box keeps its editable contribution
            when unlinked. Coordinates and sizes use PDF points from the bottom left.
          </p>
        </EditorDialog>
      )}
    </>
  );
}
