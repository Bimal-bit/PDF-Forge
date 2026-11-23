import { useState } from 'react';
import type { AnnotationObject } from '../types';
import { measurementLabel, validateAnnotation } from '../lib/annotations';
import { EditorDialog } from './EditorDialog';
import { FormatNumberInput } from './FormatNumberInput';
import type { InsertionContext } from './useInsertion';

export function ReviewAnnotationEditor({
  target,
  context,
  onClose,
}: {
  target: AnnotationObject;
  context: InsertionContext;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(target);
  const [error, setError] = useState('');
  return (
    <EditorDialog title="Edit review mark" onClose={onClose}>
      <p>
        Page {context.selectedPage} · {draft.type}. Save applies the whole edit in one Undo step.
      </p>
      {(draft.type === 'note' || draft.type === 'highlight') && (
        <>
          <label>
            Comment
            <textarea
              aria-label="Review comment"
              maxLength={5000}
              value={draft.comment}
              onChange={(event) => setDraft({ ...draft, comment: event.target.value })}
            />
          </label>
          <label>
            Author
            <input
              aria-label="Review author"
              maxLength={100}
              value={draft.author}
              onChange={(event) => setDraft({ ...draft, author: event.target.value })}
            />
          </label>
          <label className="advanced-checkbox">
            <input
              aria-label="Comment resolved"
              type="checkbox"
              checked={Boolean(draft.resolved)}
              onChange={(event) => setDraft({ ...draft, resolved: event.target.checked })}
            />
            Resolved
          </label>
        </>
      )}
      <div className="advanced-grid">
        {(['x', 'y'] as const).map((property) => (
          <label key={property}>
            {property.toUpperCase()} (pt)
            <FormatNumberInput
              label={`Review mark ${property}`}
              value={draft[property]}
              min={-14400}
              max={14400}
              onChange={(value) => setDraft({ ...draft, [property]: value })}
            />
          </label>
        ))}
        {(draft.type === 'highlight' || draft.type === 'measure') &&
          (['width', 'height'] as const).map((property) => (
            <label key={property}>
              {draft.type === 'measure'
                ? `Endpoint delta ${property === 'width' ? 'X' : 'Y'}`
                : property}{' '}
              (pt)
              <FormatNumberInput
                label={`Review mark ${property}`}
                value={draft[property]}
                min={draft.type === 'measure' ? -14400 : 1}
                max={14400}
                onChange={(value) => setDraft({ ...draft, [property]: value })}
              />
            </label>
          ))}
        {draft.type === 'highlight' && (
          <label>
            Highlight color
            <input
              aria-label="Review highlight color"
              type="color"
              value={
                draft.color.length === 4
                  ? `#${draft.color
                      .slice(1)
                      .split('')
                      .map((part) => part + part)
                      .join('')}`
                  : draft.color
              }
              onChange={(event) => setDraft({ ...draft, color: event.target.value })}
            />
          </label>
        )}
        {draft.type === 'stamp' && (
          <label>
            Stamp
            <select
              aria-label="Review stamp label"
              value={draft.label}
              onChange={(event) =>
                setDraft({ ...draft, label: event.target.value as typeof draft.label })
              }
            >
              <option>APPROVED</option>
              <option>DRAFT</option>
              <option>CONFIDENTIAL</option>
            </select>
          </label>
        )}
        {draft.type === 'measure' && (
          <label>
            Units
            <select
              aria-label="Review measure units"
              value={draft.units}
              onChange={(event) =>
                setDraft({ ...draft, units: event.target.value as typeof draft.units })
              }
            >
              <option value="pt">Points</option>
              <option value="in">Inches</option>
              <option value="cm">Centimeters</option>
            </select>
          </label>
        )}
      </div>
      {draft.type === 'measure' && (
        <p role="status">
          Length: {measurementLabel(draft)}. Uses PDF points; no drawing-scale calibration.
        </p>
      )}
      {error && (
        <p role="alert" className="editing-warning">
          {error}
        </p>
      )}
      <div className="review-editor-footer">
        <button onClick={onClose}>Cancel</button>
        <button
          onClick={() => {
            try {
              const value =
                draft.type === 'note' || draft.type === 'highlight'
                  ? { ...draft, author: draft.author.trim() || 'Local editor' }
                  : draft;
              validateAnnotation(value, context.bounds);
              if (JSON.stringify(value) !== JSON.stringify(target)) context.commit(value, target);
              onClose();
            } catch (failure) {
              setError(failure instanceof Error ? failure.message : 'Could not save this mark.');
            }
          }}
        >
          Save review mark
        </button>
      </div>
      <p className="editing-help">
        Coordinates use PDF points from the bottom left. Measurement deltas may be negative. All
        mark bounds must fit the current crop box.
      </p>
    </EditorDialog>
  );
}
