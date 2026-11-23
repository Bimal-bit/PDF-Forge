import { useState } from 'react';
import {
  AlignHorizontalJustifyCenter,
  ArrowDown,
  ArrowUp,
  Copy,
  RotateCcw,
  RotateCw,
  Trash2,
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { TextLayoutTools } from './TextLayoutTools';
import { ImageTools } from './ImageTools';
import { useInsertion, type InsertionContext } from './useInsertion';
import { type ManagedObject } from '../lib/objectTools';
import { canArrangeObject } from '../lib/arrangeObjects';
import { objectLabel } from '../lib/insertion';
import { prepareTextFont } from '../lib/textFonts';
import { prepareTableMetrics } from '../lib/tableLayout';
import { ArrangeObjectsDialog } from './ArrangeObjectsDialog';
import { useDialogLifetime } from './useDialogLifetime';
import { revealTextObject } from './revealTextObject';
import '../layout-tools.css';

type LayoutDialog = { kind: 'arrange'; context: InsertionContext; targets: ManagedObject[] };

export function LayoutToolbar() {
  const state = useAppStore();
  const context = useInsertion('middle');
  const [dialog, setDialog] = useState<LayoutDialog>();
  const [busy, setBusy] = useState(false);
  const live = useDialogLifetime();
  const currentObjects = state.objects.filter((object) => object.page === context.sourcePage);
  const eligible = currentObjects.filter((object): object is ManagedObject =>
    canArrangeObject(object, state.objects),
  );
  const selected = currentObjects.find((object) => object.id === state.selectedObjectId);
  const arrange = async () => {
    setBusy(true);
    try {
      await Promise.all(
        eligible.map(async (object) => {
          if (object.type === 'text' && object.height === undefined) await prepareTextFont(object);
          if ((object.type === 'table' || object.type === 'link') && object.fontFamily)
            await prepareTableMetrics();
        }),
      );
      if (!live.current) return;
      if (!context.current() || useAppStore.getState().objects !== state.objects)
        throw new Error('The page changed. Open Align & distribute again.');
      setDialog({ kind: 'arrange', context, targets: eligible });
    } catch (failure) {
      if (live.current)
        state.setNotice(
          failure instanceof Error ? failure.message : 'Could not prepare these objects.',
        );
    } finally {
      if (live.current) setBusy(false);
    }
  };
  const ready = Boolean(context.bounds && state.pageSettings.order.length);
  return (
    <div className="layout-toolbar">
      <div
        className="layout-command-scroll"
        role="region"
        aria-label="Layout commands"
        tabIndex={0}
      >
        <div className="layout-command-group layout-text-group">
          <TextLayoutTools />
          <span className="layout-group-label">Text frames & columns</span>
        </div>
        <div className="layout-command-group">
          <button disabled={!ready || busy} onClick={() => void arrange()}>
            <AlignHorizontalJustifyCenter size={15} />
            {busy ? 'Preparing objects…' : 'Align & distribute'}
          </button>
          <span className="layout-group-label">Arrange objects</span>
        </div>
        <div className="layout-command-group layout-media-group">
          <ImageTools />

          <span className="layout-group-label">Graphics & media</span>
        </div>
        <div className="layout-command-group">
          <button disabled={!ready} onClick={() => state.rotatePage(-1)}>
            <RotateCcw size={14} />
            Rotate left
          </button>
          <button disabled={!ready} onClick={() => state.rotatePage()}>
            <RotateCw size={14} />
            Rotate right
          </button>
          <span className="layout-group-label">Page rotation</span>
        </div>
        <div className="layout-command-group layout-pages-group">
          <button disabled={!ready || state.selectedPage <= 1} onClick={() => state.movePage(-1)}>
            <ArrowUp size={14} />
            Move page up
          </button>
          <button
            disabled={!ready || state.selectedPage >= state.pageSettings.order.length}
            onClick={() => state.movePage(1)}
          >
            <ArrowDown size={14} />
            Move page down
          </button>
          <button disabled={!ready} onClick={state.duplicatePage}>
            <Copy size={14} />
            Duplicate page
          </button>
          <button
            disabled={!ready || state.pageSettings.order.length < 2}
            onClick={state.deletePage}
          >
            <Trash2 size={14} />
            Delete page
          </button>
          <span className="layout-group-label">Page order</span>
        </div>
      </div>
      <div className="layout-context-bar">
        <span>
          Page {state.selectedPage} of {state.pageSettings.order.length || 1}
        </span>
        <span className="layout-rotation-label">
          {context.bounds
            ? `${((context.bounds.rotation % 360) + 360) % 360}° rotation`
            : 'Reading page…'}
        </span>
        <label>
          Object
          <select
            aria-label="Layout object"
            value={selected?.id ?? ''}
            onChange={(event) => {
              state.selectObject(event.target.value || undefined);
              revealTextObject(event.target.value, state.selectedPage);
            }}
          >
            <option value="">Choose an object</option>
            {currentObjects.map((object) => (
              <option value={object.id} key={object.id}>
                {objectLabel(object)}
              </option>
            ))}
          </select>
        </label>
        <span className="layout-context-hint">Positions and dimensions use PDF points</span>
      </div>
      {dialog?.kind === 'arrange' && (
        <ArrangeObjectsDialog
          context={dialog.context}
          targets={dialog.targets}
          onClose={() => setDialog(undefined)}
        />
      )}
    </div>
  );
}
