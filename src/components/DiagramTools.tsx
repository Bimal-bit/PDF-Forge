import { FormatNumberInput } from './FormatNumberInput';
import { finishInsertion } from './insertionEffects';
import { useState } from 'react';
import { EditorDialog } from './EditorDialog';
import { useAppStore } from '../store/useAppStore';
import type { ShapeObject } from '../types';

export function DiagramTools() {
  const {
    document,
    objects,
    selectedObjectId,
    selectedPage,
    pageSettings,
    addObject: addEditorObject,
    selectObject,
    updateObject,
    removeObject,
  } = useAppStore();
  const addObject = (object: Parameters<typeof addEditorObject>[0]) => {
    addEditorObject(object);
    finishInsertion();
  };
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<NonNullable<ShapeObject['shapeKind']>>('rectangle');
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const sourcePage = pageSettings.order[selectedPage - 1] ?? selectedPage;
  const shapes = objects.filter(
    (object): object is ShapeObject => object.type === 'shape' && object.page === sourcePage,
  );
  const selected = shapes.find((object) => object.id === selectedObjectId) ?? shapes.at(-1);
  const from = shapes.find((object) => object.id === fromId) ?? shapes[0];
  const to =
    shapes.find((object) => object.id === toId && object.id !== from?.id) ??
    shapes.find((object) => object.id !== from?.id);
  const name = (object: ShapeObject) =>
    object.label || `${object.shapeKind ?? 'rectangle'} ${shapes.indexOf(object) + 1}`;
  return (
    <>
      <button disabled={!document} onClick={() => setOpen(true)}>
        Shapes &amp; connectors
      </button>
      {open && (
        <EditorDialog title="Shapes & connectors" onClose={() => setOpen(false)}>
          <div className="advanced-grid">
            <label>
              New shape
              <select
                aria-label="New flowchart shape"
                value={kind}
                onChange={(event) => setKind(event.target.value as typeof kind)}
              >
                <option value="rectangle">Process</option>
                <option value="diamond">Decision</option>
                <option value="ellipse">Ellipse</option>
                <option value="terminator">Terminator</option>
              </select>
            </label>
            <button
              onClick={() =>
                addObject({
                  id: crypto.randomUUID(),
                  type: 'shape',
                  page: sourcePage,
                  x: 72,
                  y: 72,
                  width: 140,
                  height: 80,
                  color: '#4f3fd1',
                  shapeKind: kind,
                  label: kind === 'diamond' ? 'Decision' : 'Process',
                })
              }
            >
              Add flowchart shape
            </button>
          </div>
          <label>
            Shape
            <select
              aria-label="Diagram shape"
              value={selected?.id ?? ''}
              onChange={(event) => selectObject(event.target.value)}
            >
              <option value="" disabled>
                Add a shape
              </option>
              {shapes.map((object) => (
                <option key={object.id} value={object.id}>
                  {name(object)}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <>
              <label>
                Label
                <input
                  aria-label="Shape label"
                  maxLength={80}
                  value={selected.label ?? ''}
                  onChange={(event) => updateObject(selected.id, { label: event.target.value })}
                />
              </label>
              <label>
                Color
                <input
                  aria-label="Shape color"
                  type="color"
                  value={selected.color}
                  onChange={(event) => updateObject(selected.id, { color: event.target.value })}
                />
              </label>
              <div className="advanced-grid">
                {(['x', 'y', 'width', 'height'] as const).map((property) => (
                  <label key={property}>
                    {property.toUpperCase()}
                    <FormatNumberInput
                      key={`${selected.id}-${property}`}
                      label={`Shape ${property}`}
                      min={property === 'x' || property === 'y' ? -14400 : 20}
                      max={14400}
                      value={selected[property]}
                      onChange={(value) => updateObject(selected.id, { [property]: value })}
                    />
                  </label>
                ))}
              </div>
              <button onClick={() => removeObject(selected.id)}>Delete selected shape</button>
            </>
          )}
          <div className="advanced-grid">
            <label>
              Connect from
              <select
                aria-label="Connector from"
                value={from?.id ?? ''}
                onChange={(event) => setFromId(event.target.value)}
              >
                {shapes.map((object) => (
                  <option key={object.id} value={object.id}>
                    {name(object)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Connect to
              <select
                aria-label="Connector to"
                value={to?.id ?? ''}
                onChange={(event) => setToId(event.target.value)}
              >
                {shapes
                  .filter((object) => object.id !== from?.id)
                  .map((object) => (
                    <option key={object.id} value={object.id}>
                      {name(object)}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <button
            disabled={!from || !to}
            onClick={() => {
              if (from && to)
                addObject({
                  id: crypto.randomUUID(),
                  type: 'connector',
                  page: sourcePage,
                  fromId: from.id,
                  toId: to.id,
                  color: '#4f3fd1',
                  arrow: true,
                });
            }}
          >
            Connect shapes
          </button>
          {objects
            .filter((object) => object.type === 'connector' && object.page === sourcePage)
            .map((object, index) => (
              <p key={object.id}>
                Connector {index + 1}{' '}
                <button
                  aria-label={`Delete connector ${index + 1}`}
                  onClick={() => removeObject(object.id)}
                >
                  Delete
                </button>
              </p>
            ))}
          <p className="editing-help">
            Drag a shape on the page or use the arrow keys to move it. Hold Shift for 10-point
            steps. Connectors follow both endpoints.
          </p>
        </EditorDialog>
      )}
    </>
  );
}
