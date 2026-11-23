import { useMemo, useState } from 'react';
import { EditorDialog } from './EditorDialog';
import { useAppStore } from '../store/useAppStore';
import { layoutTextFrames, textChain } from '../lib/textFlow';
import type { TextObject } from '../types';
import { FormatNumberInput } from './FormatNumberInput';
import { nativeSourceText } from '../lib/textFormatting';
import { useInsertion } from './useInsertion';
import { insertionSize } from '../lib/insertion';
import { revealTextObject } from './revealTextObject';

export function TextLayoutTools() {
  const {
    objects,
    selectedObjectId,
    selectedPage,
    pageSettings,
    document,
    selectObject,
    updateObject,
    updateTextObject,
    linkTextObjects,
    unlinkTextObject,
    setNotice,
  } = useAppStore();
  const [open, setOpen] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [preset, setPreset] = useState('compact');
  const insertion = useInsertion('bottom');
  const texts = objects.filter(
    (object): object is TextObject =>
      object.type === 'text' && pageSettings.order.includes(object.page),
  );
  const selected = texts.find((object) => object.id === selectedObjectId) ?? texts.at(-1);
  const native = Boolean(selected && nativeSourceText(selected, objects));
  const targets = texts.filter(
    (object) =>
      object.id !== selected?.id &&
      !nativeSourceText(object, objects) &&
      !objects.some((entry) => entry.type === 'text' && entry.nextTextId === object.id) &&
      !textChain(objects, object.id).some((entry) => entry.id === selected?.id),
  );
  const target = targets.find((object) => object.id === targetId) ?? targets[0];
  const layouts = useMemo(
    () => layoutTextFrames(objects, pageSettings.order),
    [objects, pageSettings.order],
  );
  const overflow = selected ? layouts.get(selected.id)?.overflow : '';
  const sourceParagraph = Boolean(selected?.cover && !native && !layouts.has(selected.id));
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
            disabled={!insertion.bounds}
            onClick={() => {
              try {
                const bounds = insertion.bounds!;
                const size = insertionSize(
                  bounds,
                  preset === 'compact' ? 200 : bounds.width,
                  preset === 'compact' ? 160 : bounds.height,
                );
                const columns = preset === 'two' ? 2 : preset === 'three' ? 3 : 1;
                insertion.commit({
                  id: crypto.randomUUID(),
                  type: 'text',
                  page: pageSettings.order[selectedPage - 1] ?? selectedPage,
                  text: '',
                  ...insertion.point(size.width, size.height),
                  ...size,
                  columns,
                  columnGap: Math.min(18, Math.max(0, size.width / columns - 24)),
                  fontSize: 12,
                  color: '#292724',
                });
              } catch (failure) {
                setNotice(
                  failure instanceof Error ? failure.message : 'Could not insert a text frame.',
                );
              }
            }}
          >
            Add text box
          </button>
          <label>
            New frame preset
            <select
              aria-label="New frame preset"
              value={preset}
              onChange={(event) => setPreset(event.target.value)}
            >
              <option value="compact">Compact box</option>
              <option value="page">Page frame</option>
              <option value="two">Two-column page frame</option>
              <option value="three">Three-column page frame</option>
            </select>
          </label>
          <label>
            Text box
            <select
              aria-label="Layout text box"
              value={selected?.id ?? ''}
              onChange={(event) => {
                const target = texts.find((object) => object.id === event.target.value);
                selectObject(event.target.value);
                if (target) {
                  const displayPage =
                    pageSettings.order[selectedPage - 1] === target.page
                      ? selectedPage
                      : pageSettings.order.indexOf(target.page) + 1;
                  useAppStore.getState().setSelectedPage(displayPage);
                  revealTextObject(target.id, displayPage);
                }
              }}
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
                    <FormatNumberInput
                      key={`${selected.id}-${property}`}
                      label={`Text frame ${property}`}
                      min={property === 'width' || property === 'height' ? 20 : -14400}
                      max={14400}
                      disabled={
                        (native && (property === 'width' || property === 'height')) ||
                        (sourceParagraph && property === 'height')
                      }
                      value={selected[property] ?? (property === 'height' ? 160 : 300)}
                      onChange={(value) => update({ [property]: value })}
                    />
                  </label>
                ))}
              </div>
              <div className="advanced-grid">
                <label>
                  Columns
                  <select
                    aria-label="Text columns"
                    disabled={native}
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
                  <FormatNumberInput
                    key={selected.id}
                    label="Column gap"
                    min={0}
                    max={100}
                    disabled={native || (selected.columns ?? 1) === 1}
                    value={selected.columnGap ?? 18}
                    onChange={(value) => update({ columnGap: value })}
                  />
                </label>
                <label>
                  Drop cap
                  <select
                    aria-label="Drop cap"
                    disabled={native}
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
                      disabled={native}
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
                    disabled={!target || native}
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
              {native && (
                <p className="editing-help">
                  Source runs retain their original placement and font resources. Create a text box
                  for columns and linked text flow. X and Y can reposition this replacement.
                </p>
              )}
              {sourceParagraph && (
                <p className="editing-help">
                  Matched source paragraphs grow with their content. Height applies after choosing
                  columns, a drop cap, or a linked continuation.
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
