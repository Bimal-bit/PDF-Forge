import { FormatNumberInput } from './FormatNumberInput';
import { finishInsertion } from './insertionEffects';
import { useMemo, useState } from 'react';
import { EditorDialog } from './EditorDialog';
import { EquationView } from './EquationView';
import { equationLayout } from '../lib/equations';
import { useAppStore } from '../store/useAppStore';
import type { EquationObject } from '../types';

const initial = { latex: '\\frac{a}{b} + x^2', fontSize: 24, color: '#292724', x: 72, y: 300 };

export function EquationTools() {
  const {
    document,
    objects,
    selectedPage,
    pageSettings,
    selectedObjectId,
    addObject: addEditorObject,
    updateObject,
    selectObject,
  } = useAppStore();
  const addObject = (object: Parameters<typeof addEditorObject>[0]) => {
    addEditorObject(object);
    finishInsertion();
  };
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState('');
  const [draft, setDraft] = useState(initial);
  const equations = objects.filter(
    (object): object is EquationObject =>
      object.type === 'equation' && pageSettings.order.includes(object.page),
  );
  const preview = useMemo(() => {
    try {
      return { layout: equationLayout(draft.latex, draft.fontSize), error: '' };
    } catch (error) {
      return {
        layout: undefined,
        error: error instanceof Error ? error.message : 'Invalid equation.',
      };
    }
  }, [draft.latex, draft.fontSize]);
  const begin = (object?: EquationObject) => {
    setEditingId(object?.id ?? '');
    setDraft(
      object
        ? {
            latex: object.latex,
            fontSize: object.fontSize,
            color: object.color,
            x: object.x,
            y: object.y,
          }
        : initial,
    );
  };
  return (
    <>
      <button
        disabled={!document}
        onClick={() => {
          begin(equations.find((object) => object.id === selectedObjectId));
          setOpen(true);
        }}
      >
        Equation editor
      </button>
      {open && (
        <EditorDialog title="Equation editor" onClose={() => setOpen(false)}>
          <label>
            Saved equation
            <select
              aria-label="Equation to edit"
              value={editingId}
              onChange={(event) =>
                begin(equations.find((object) => object.id === event.target.value))
              }
            >
              <option value="">New equation</option>
              {equations.map((object, index) => (
                <option key={object.id} value={object.id}>
                  Equation {index + 1} · {object.latex.slice(0, 40)}
                </option>
              ))}
            </select>
          </label>
          <label>
            LaTeX
            <textarea
              aria-label="Equation LaTeX"
              value={draft.latex}
              maxLength={2000}
              onChange={(event) => setDraft({ ...draft, latex: event.target.value })}
            />
          </label>
          <div className="advanced-grid">
            {(['x', 'y', 'fontSize'] as const).map((property) => (
              <label key={property}>
                {property === 'fontSize' ? 'Font size' : property.toUpperCase()}
                <FormatNumberInput
                  key={`${editingId}-${property}`}
                  label={`Equation ${property}`}
                  min={property === 'fontSize' ? 6 : -14400}
                  max={property === 'fontSize' ? 144 : 14400}
                  value={draft[property]}
                  onChange={(value) => setDraft({ ...draft, [property]: value })}
                />
              </label>
            ))}
            <label>
              Color
              <input
                aria-label="Equation color"
                type="color"
                value={draft.color}
                onChange={(event) => setDraft({ ...draft, color: event.target.value })}
              />
            </label>
          </div>
          {preview.layout && (
            <div className="equation-preview">
              <EquationView layout={preview.layout} color={draft.color} />
            </div>
          )}
          {preview.error && (
            <p role="alert" className="editing-warning">
              {preview.error}
            </p>
          )}
          <div className="advanced-grid">
            <button
              disabled={!preview.layout}
              onClick={() => {
                const id = crypto.randomUUID();
                addObject({
                  id,
                  type: 'equation',
                  page: pageSettings.order[selectedPage - 1] ?? selectedPage,
                  ...draft,
                });
                setEditingId(id);
              }}
            >
              Insert equation
            </button>
            <button
              disabled={!editingId || !preview.layout}
              onClick={() => {
                updateObject(editingId, draft);
                selectObject(editingId);
              }}
            >
              Update selected equation
            </button>
          </div>
          <p className="editing-help">
            Supports fractions, square roots, superscripts, subscripts, Greek letters, sums,
            integrals, common operators, and text. Braces group arguments. Matrices, custom macros,
            and additional LaTeX packages remain pending.
          </p>
        </EditorDialog>
      )}
    </>
  );
}
