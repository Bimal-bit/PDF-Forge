import { useState } from 'react';
import { EditorDialog } from './EditorDialog';
import type { InsertionContext } from './useInsertion';
import type { ManagedObject } from '../lib/objectTools';
import {
  arrangeBoxes,
  boxPosition,
  visualObjectBox,
  visualPageSize,
  type ArrangeAction,
  type VisualBox,
} from '../lib/arrangeObjects';
import { objectLabel } from '../lib/insertion';
import { useAppStore } from '../store/useAppStore';
import { FormatNumberInput } from './FormatNumberInput';
import { finishInsertion } from './insertionEffects';

const alignment: { action: ArrangeAction; label: string }[] = [
  { action: 'left', label: 'Align left' },
  { action: 'center', label: 'Align center' },
  { action: 'right', label: 'Align right' },
  { action: 'top', label: 'Align top' },
  { action: 'middle', label: 'Align middle' },
  { action: 'bottom', label: 'Align bottom' },
];

export function ArrangeObjectsDialog({
  context,
  targets,
  onClose,
}: {
  context: InsertionContext;
  targets: ManagedObject[];
  onClose: () => void;
}) {
  const [snapshot] = useState(() => useAppStore.getState());
  const original = targets.map((object) => visualObjectBox(object, context.bounds!));
  const [boxes, setBoxes] = useState(original);
  const [ids, setIds] = useState<string[]>(() =>
    targets.some((object) => object.id === snapshot.selectedObjectId)
      ? [snapshot.selectedObjectId!]
      : targets[0]
        ? [targets[0].id]
        : [],
  );
  const [relative, setRelative] = useState<'page' | 'selection'>('page');
  const page = visualPageSize(context.bounds!);
  const maxInset = Math.max(0, Math.floor(Math.min(page.width, page.height) / 2) - 1);
  const [inset, setInset] = useState(Math.min(36, maxInset));
  const [error, setError] = useState('');
  const selected = boxes.filter((box) => ids.includes(box.id));
  const preview = (action: ArrangeAction) => {
    try {
      const arranged = arrangeBoxes(selected, context.bounds!, action, relative, inset);
      setBoxes(boxes.map((box) => arranged.find((entry) => entry.id === box.id) ?? box));
      setError('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not arrange this selection.');
    }
  };
  const changes = selected
    .map((box) => boxPosition(box, context.bounds!))
    .filter((point) => {
      const object = targets.find((entry) => entry.id === point.id)!;
      return Math.abs(point.x - object.x) > 0.001 || Math.abs(point.y - object.y) > 0.001;
    });
  const changeSelection = (next: string[]) => {
    setIds(next);
    setBoxes(original);
    setError('');
  };
  return (
    <EditorDialog title="Align & distribute" onClose={onClose}>
      <p>
        Choose objects, arrange the preview, then apply. Directions follow the visible page
        rotation.
      </p>
      <div className="arrange-layout">
        <div className="arrange-object-list">
          <label className="arrange-check">
            <input
              type="checkbox"
              aria-label="Select all layout objects"
              checked={Boolean(targets.length && ids.length === targets.length)}
              onChange={(event) =>
                changeSelection(event.target.checked ? targets.map((object) => object.id) : [])
              }
            />
            All objects on page {context.selectedPage}
          </label>
          {targets.map((object, index) => (
            <label className="arrange-check" key={object.id}>
              <input
                type="checkbox"
                aria-label={`Arrange object ${index + 1}`}
                checked={ids.includes(object.id)}
                onChange={(event) =>
                  changeSelection(
                    event.target.checked
                      ? [...ids, object.id]
                      : ids.filter((id) => id !== object.id),
                  )
                }
              />
              <span>
                {index + 1}. {objectLabel(object)}
              </span>
            </label>
          ))}
          {!targets.length && (
            <p className="editing-help">
              Insert text, images, shapes, tables, links, equations, or new fields to arrange them.
            </p>
          )}
        </div>
        <ArrangePreview boxes={boxes} ids={ids} width={page.width} height={page.height} />
      </div>
      <div className="advanced-grid">
        <label>
          Align relative to
          <select
            aria-label="Arrange relative to"
            value={relative}
            onChange={(event) => setRelative(event.target.value as typeof relative)}
          >
            <option value="page">Page</option>
            <option value="selection">Selection bounds</option>
          </select>
        </label>
        <label>
          Page inset (pt)
          <FormatNumberInput
            label="Arrange page inset"
            min={0}
            max={maxInset}
            value={inset}
            disabled={relative === 'selection'}
            onChange={setInset}
          />
        </label>
      </div>
      <div className="arrange-actions">
        {alignment.map(({ action, label }) => (
          <button
            key={action}
            disabled={!ids.length || (relative === 'selection' && ids.length < 2)}
            onClick={() => preview(action)}
          >
            {label}
          </button>
        ))}
        <button disabled={ids.length < 3} onClick={() => preview('horizontal')}>
          Distribute horizontally
        </button>
        <button disabled={ids.length < 3} onClick={() => preview('vertical')}>
          Distribute vertically
        </button>
        <button disabled={!ids.length} onClick={() => preview('group')}>
          Center group on page
        </button>
      </div>
      <p className="editing-help">
        {ids.length} selected. Distribution uses equal gaps. Copies of a PDF page share their source
        objects.
      </p>
      {error && (
        <p role="alert" className="editing-warning">
          {error}
        </p>
      )}
      <div className="arrange-footer">
        <button
          onClick={() => {
            setBoxes(original);
            setError('');
          }}
        >
          Reset preview
        </button>
        <button
          disabled={!changes.length}
          onClick={() => {
            try {
              const current = useAppStore.getState();
              if (
                !context.current() ||
                current.objects !== snapshot.objects ||
                current.pageSettings.order !== snapshot.pageSettings.order
              )
                throw new Error(
                  'The document or page changed. Reopen Align & distribute to use its current objects.',
                );
              current.positionObjects(changes);
              current.selectObject(changes[0].id);
              finishInsertion();
              onClose();
            } catch (failure) {
              setError(
                failure instanceof Error ? failure.message : 'Could not apply the arrangement.',
              );
            }
          }}
        >
          Apply arrangement
        </button>
      </div>
    </EditorDialog>
  );
}

function ArrangePreview({
  boxes,
  ids,
  width,
  height,
}: {
  boxes: VisualBox[];
  ids: string[];
  width: number;
  height: number;
}) {
  const labelSize = Math.max(width / 20, height / 16);
  return (
    <svg
      className="arrange-preview"
      role="img"
      aria-label="Arrangement preview"
      viewBox={`0 0 ${width} ${height}`}
    >
      <rect x="0" y="0" width={width} height={height} fill="white" />
      {boxes.map((box, index) => (
        <g key={box.id}>
          <rect
            x={box.left}
            y={box.top}
            width={box.width}
            height={box.height}
            fill={ids.includes(box.id) ? '#e9e5fa' : '#eeeeed'}
            stroke={ids.includes(box.id) ? '#4f3fd1' : '#aaa8a3'}
            strokeWidth={2}
          />
          <circle
            cx={box.left + labelSize * 0.6}
            cy={box.top + labelSize * 0.6}
            r={labelSize * 0.65}
            fill={ids.includes(box.id) ? '#4f3fd1' : '#696762'}
          />
          <text
            x={box.left + labelSize * 0.6}
            y={box.top + labelSize * 0.6}
            dy=".35em"
            textAnchor="middle"
            fill="white"
            fontSize={labelSize}
          >
            {index + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}
