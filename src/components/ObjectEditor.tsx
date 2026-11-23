import { FormProperties } from './FormProperties';
import { useAppStore } from '../store/useAppStore';
import { objectLabel } from '../lib/insertion';
import { revealTextObject } from './revealTextObject';
import { useTextSelectionStore } from '../store/useTextSelectionStore';

export function ObjectEditor({ objects }: { objects: import('../types').EditorObject[] }) {
  const {
    updateTextObject,
    updateObject,
    removeObject,
    selectObject,
    selectedObjectId,
    pageSettings,
    selectedPage,
    setSelectedPage,
  } = useAppStore();
  return (
    <aside className="object-editor-panel" aria-label="Export objects">
      <p className="panel-label">OBJECTS & COMMENTS</p>
      {objects.map((object) => (
        <div
          className={`object-editor${selectedObjectId === object.id ? ' selected' : ''}`}
          key={object.id}
        >
          <div className="object-card-heading">
            <button
              aria-label={`Select ${objectLabel(object)} on page ${pageSettings.order.indexOf(object.page) + 1}`}
              onClick={() => {
                const page =
                  pageSettings.order[selectedPage - 1] === object.page
                    ? selectedPage
                    : pageSettings.order.indexOf(object.page) + 1;
                useTextSelectionStore.getState().setMode('edit');
                window.getSelection()?.removeAllRanges();
                selectObject(object.id);
                setSelectedPage(page);
                revealTextObject(object.id, page);
              }}
            >
              {objectLabel(object)}
            </button>
            <span>
              Page{' '}
              {pageSettings.order
                .map((source, index) => (source === object.page ? index + 1 : undefined))
                .filter(Boolean)
                .join(', ')}
            </span>
          </div>
          {object.type === 'equation' && (
            <>
              <code className="equation-source-label">{object.latex}</code>
            </>
          )}
          {object.type === 'text' &&
            (object.nextTextId ||
              objects.some((entry) => entry.type === 'text' && entry.nextTextId === object.id)) && (
              <span className="field-kind">Linked story contribution</span>
            )}
          {object.type === 'text' && (
            <>
              <label>
                Text
                <textarea
                  aria-label="Overlay text"
                  value={object.text}
                  onChange={(event) => updateTextObject(object.id, event.target.value)}
                />
              </label>
              {object.fallback && (
                <span className="fallback-warning">
                  Fallback font: {object.fontFamily ?? 'Helvetica'}
                </span>
              )}
            </>
          )}
          {object.type === 'form' && (
            <>
              <label>
                Field label
                <input
                  aria-label="Form field label"
                  value={object.label}
                  onChange={(event) => updateObject(object.id, { label: event.target.value })}
                />
              </label>
              {object.kind === 'checkbox' ? (
                <label className="check-control">
                  <input
                    aria-label="Checkbox value"
                    type="checkbox"
                    checked={object.checked}
                    onChange={(event) => updateObject(object.id, { checked: event.target.checked })}
                  />{' '}
                  Checked
                </label>
              ) : !['radio', 'dropdown', 'list', 'date'].includes(object.kind) ? (
                <label>
                  {object.kind === 'signature' ? 'Signer name' : 'Field value'}
                  <input
                    aria-label={object.kind === 'signature' ? 'Signer name' : 'Field value'}
                    value={object.value}
                    onChange={(event) => updateObject(object.id, { value: event.target.value })}
                  />
                </label>
              ) : null}
              <FormProperties object={object} />
              <span className="field-kind">
                {object.kind === 'signature'
                  ? 'Visible signature, not certificate signing'
                  : `PDF ${object.kind} field`}
              </span>
            </>
          )}
          {object.type === 'link' && (
            <label>
              Link URL
              <input
                aria-label="Link URL"
                value={object.url}
                onChange={(event) => updateObject(object.id, { url: event.target.value })}
              />
            </label>
          )}
          {(object.type === 'highlight' || object.type === 'note') && (
            <>
              <label>
                Comment
                <textarea
                  aria-label="Annotation comment"
                  value={object.comment}
                  onChange={(event) => updateObject(object.id, { comment: event.target.value })}
                />
              </label>
              <label>
                Author
                <input
                  aria-label="Annotation author"
                  value={object.author}
                  onChange={(event) => updateObject(object.id, { author: event.target.value })}
                />
              </label>
            </>
          )}
          {object.type === 'stamp' && (
            <label>
              Stamp
              <select
                aria-label="Stamp label"
                value={object.label}
                onChange={(event) =>
                  updateObject(object.id, {
                    label: event.target.value as 'APPROVED' | 'DRAFT' | 'CONFIDENTIAL',
                  })
                }
              >
                <option>APPROVED</option>
                <option>DRAFT</option>
                <option>CONFIDENTIAL</option>
              </select>
            </label>
          )}
          {object.type === 'measure' && (
            <label>
              Units
              <select
                aria-label="Measure units"
                value={object.units}
                onChange={(event) =>
                  updateObject(object.id, { units: event.target.value as 'pt' | 'in' | 'cm' })
                }
              >
                <option value="pt">Points</option>
                <option value="in">Inches</option>
                <option value="cm">Centimeters</option>
              </select>
            </label>
          )}
          <button onClick={() => removeObject(object.id)}>Remove</button>
        </div>
      ))}
    </aside>
  );
}
