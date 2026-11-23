import { useState } from 'react';
import { objectSize, positionedCopy, type ManagedObject } from '../lib/objectTools';
import { assertInsertFits, objectLabel } from '../lib/insertion';
import { currentTableMetrics, prepareTableMetrics, tableLayout } from '../lib/tableLayout';
import { prepareTextFont } from '../lib/textFonts';
import { useAppStore } from '../store/useAppStore';
import type { InsertionContext } from './useInsertion';
import { EditorDialog } from './EditorDialog';
import { InsertPlacementFields } from './InsertPlacementFields';
import { FormatNumberInput } from './FormatNumberInput';
import { useDialogLifetime } from './useDialogLifetime';
import { finishInsertion } from './insertionEffects';

export function InsertObjectDialog({
  target,
  context,
  onClose,
}: {
  target: ManagedObject;
  context: InsertionContext;
  onClose: () => void;
}) {
  const [point, setPoint] = useState({ x: target.x, y: target.y });
  const [size, setSize] = useState(() => objectSize(target));
  const [keepRatio, setKeepRatio] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const live = useDialogLifetime();
  const resizable =
    target.type === 'image' ||
    target.type === 'shape' ||
    target.type === 'table' ||
    target.type === 'form';
  const ratio = resizable ? target.width / target.height : 1;
  const minWidth =
    target.type === 'form' && target.kind === 'radio' ? 72 : target.type === 'table' ? 20 : 10;
  const operate = async (duplicate: boolean) => {
    setBusy(true);
    setError('');
    try {
      if (target.type === 'text') await prepareTextFont(target);
      if ((target.type === 'link' || target.type === 'table') && target.fontFamily)
        await prepareTableMetrics();
      if (!live.current) return;
      const state = useAppStore.getState();
      if (!context.current() || state.objects.find((object) => object.id === target.id) !== target)
        throw new Error(
          'This object or page changed. Reopen Object tools to use the current version.',
        );
      const draft: ManagedObject = resizable
        ? { ...target, ...point, ...size }
        : { ...target, ...point };
      const actual = objectSize(draft);
      assertInsertFits(context.bounds!, draft.x, draft.y, actual.width, actual.height);
      if (draft.type === 'table') tableLayout(draft, currentTableMetrics(draft));
      context.commit(
        duplicate ? positionedCopy(draft, context.bounds!) : draft,
        duplicate ? undefined : target,
      );
      onClose();
    } catch (failure) {
      if (live.current) {
        setError(failure instanceof Error ? failure.message : 'Could not update this object.');
        setBusy(false);
      }
    }
  };
  return (
    <EditorDialog title="Object tools" onClose={onClose}>
      <p>
        {objectLabel(target)} · Page {context.selectedPage}. Positions use PDF points from the
        page’s bottom left.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void operate(false);
        }}
      >
        <fieldset disabled={busy} className="insert-dialog-body">
          <InsertPlacementFields bounds={context.bounds!} {...point} onChange={setPoint} />
          {resizable && (
            <>
              <div className="insert-object-size">
                <label>
                  Width (pt)
                  <FormatNumberInput
                    label="Object width"
                    value={size.width}
                    min={minWidth}
                    max={context.bounds!.width}
                    onChange={(width) =>
                      setSize({
                        width,
                        height: target.type === 'image' && keepRatio ? width / ratio : size.height,
                      })
                    }
                  />
                </label>
                <label>
                  Height (pt)
                  <FormatNumberInput
                    label="Object height"
                    value={size.height}
                    min={target.type === 'table' ? 20 : 10}
                    max={context.bounds!.height}
                    onChange={(height) =>
                      setSize({
                        height,
                        width: target.type === 'image' && keepRatio ? height * ratio : size.width,
                      })
                    }
                  />
                </label>
              </div>
              {target.type === 'image' && (
                <label className="insert-check">
                  <input
                    type="checkbox"
                    checked={keepRatio}
                    onChange={(event) => setKeepRatio(event.target.checked)}
                  />
                  Keep image proportions
                </label>
              )}
            </>
          )}
          <p className="insert-note">
            Duplicate creates an independent copy nearby. Connect copied shapes in Shapes &amp;
            connectors. Existing connectors follow moved shapes.
          </p>
          <div className="insert-object-actions">
            <button type="button" onClick={() => void operate(true)}>
              Duplicate object
            </button>
            <button
              type="button"
              className="insert-remove-object"
              onClick={() => {
                const state = useAppStore.getState();
                if (
                  !context.current() ||
                  state.objects.find((object) => object.id === target.id) !== target
                ) {
                  setError(
                    'This object changed. Reopen Object tools to remove the current version.',
                  );
                  return;
                }
                state.removeObject(target.id);
                state.selectObject(undefined);
                finishInsertion();
                onClose();
              }}
            >
              Remove object
            </button>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="insert-error">
            {error}
          </p>
        )}
        <div className="insert-dialog-actions">
          <span>Changes can be undone</span>
          <button type="submit" disabled={busy}>
            {busy ? 'Preparing object…' : 'Apply object changes'}
          </button>
        </div>
      </form>
    </EditorDialog>
  );
}
