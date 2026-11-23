import { TextCursorInput } from 'lucide-react';
import { useState, type ChangeEvent } from 'react';
import type { FormObject, LinkObject, ShapeObject, TableObject } from '../types';
import { useAppStore } from '../store/useAppStore';
import { insertionSize, localDateText, objectLabel, type InsertPosition } from '../lib/insertion';
import { prepareInsertedImage } from '../lib/insertImage';
import { useInsertion, type InsertionContext } from './useInsertion';
import { InsertTableDialog } from './InsertTableDialog';
import { InsertLinkDialog } from './InsertLinkDialog';
import { InsertCommands } from './InsertCommands';
import { InsertObjectDialog } from './InsertObjectDialog';
import { canManageObject, type ManagedObject } from '../lib/objectTools';
import '../insert.css';

type Dialog =
  | { kind: 'table'; target?: TableObject; context: InsertionContext }
  | { kind: 'link'; target?: LinkObject; context: InsertionContext }
  | { kind: 'object'; target: ManagedObject; context: InsertionContext };

export function InsertToolbar() {
  const { objects, selectedObjectId, selectObject, setNotice } = useAppStore();
  const [position, setPosition] = useState<InsertPosition>('top');
  const [shape, setShape] = useState<NonNullable<ShapeObject['shapeKind']>>('rectangle');
  const [dialog, setDialog] = useState<Dialog>();
  const [imageBusy, setImageBusy] = useState(false);
  const context = useInsertion(position),
    ready = Boolean(context.bounds);
  const currentObjects = objects.filter((object) => object.page === context.sourcePage);
  const selected = currentObjects.find((object) => object.id === selectedObjectId);
  const run = (action: () => void) => {
    try {
      action();
    } catch (failure) {
      setNotice(failure instanceof Error ? failure.message : 'Could not insert that object.');
    }
  };
  const text = (value = 'Text overlay') =>
    run(() => {
      const size = insertionSize(context.bounds!, 300, 36),
        point = context.point(size.width, size.height);
      context.commit({
        id: crypto.randomUUID(),
        type: 'text',
        page: context.sourcePage,
        ...point,
        width: size.width,
        text: value,
        fontSize: 14,
        fontFamily: 'Helvetica',
        color: '#292724',
      });
    });
  const addShape = () =>
    run(() => {
      const size = insertionSize(context.bounds!, 140, 80);
      context.commit({
        id: crypto.randomUUID(),
        type: 'shape',
        page: context.sourcePage,
        ...size,
        ...context.point(size.width, size.height),
        shapeKind: shape,
        color: '#d65737',
      });
    });
  const addField = (kind: FormObject['kind']) =>
    run(() => {
      const compact = kind === 'checkbox';
      const size = insertionSize(
        context.bounds!,
        compact ? 18 : 180,
        compact ? 18 : kind === 'signature' ? 38 : 32,
      );
      const label =
        kind === 'text'
          ? 'Field'
          : kind === 'button'
            ? 'Reset form'
            : kind === 'signature'
              ? 'Signature'
              : kind === 'checkbox'
                ? 'Checkbox'
                : kind;
      context.commit({
        id: crypto.randomUUID(),
        type: 'form',
        page: context.sourcePage,
        ...size,
        ...context.point(size.width, size.height),
        kind,
        label,
        value: kind === 'signature' ? 'Signer name' : '',
        checked: false,
        options: ['Option 1', 'Option 2'],
      });
    });
  const addImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const captured = context;
    setImageBusy(true);
    try {
      const image = await prepareInsertedImage(file),
        width = 180,
        height = (width * image.height) / image.width;
      const size = insertionSize(captured.bounds!, width, height, true);
      captured.commit({
        id: crypto.randomUUID(),
        type: 'image',
        page: captured.sourcePage,
        ...size,
        ...captured.point(size.width, size.height),
        dataUrl: image.dataUrl,
      });
    } catch (failure) {
      setNotice(failure instanceof Error ? failure.message : 'Could not insert this image.');
    } finally {
      setImageBusy(false);
    }
  };
  return (
    <div className="insert-toolbar">
      <InsertCommands
        ready={ready}
        imageBusy={imageBusy}
        shape={shape}
        onShapeChange={setShape}
        onText={() => text()}
        onDate={() => text(localDateText())}
        onImage={(event) => void addImage(event)}
        onDialog={(kind) => setDialog({ kind, context })}
        onShape={addShape}
        onField={addField}
      />
      <div className="insert-context-bar">
        <label>
          <TextCursorInput size={14} />
          Place at
          <select
            aria-label="Insert position"
            value={position}
            onChange={(event) => setPosition(event.target.value as InsertPosition)}
          >
            <option value="top">Top of page</option>
            <option value="middle">Page center</option>
            <option value="bottom">Bottom of page</option>
          </select>
        </label>
        <span className="insert-page-badge">
          Page {context.selectedPage} of {context.total || 1}
        </span>
        <label className="insert-object-picker">
          Object
          <select
            aria-label="Inserted object"
            value={selected?.id ?? ''}
            onChange={(event) => selectObject(event.target.value || undefined)}
          >
            <option value="">Choose an object</option>
            {currentObjects.map((object) => (
              <option key={object.id} value={object.id}>
                {objectLabel(object)}
              </option>
            ))}
          </select>
        </label>
        {selected?.type === 'table' && (
          <button onClick={() => setDialog({ kind: 'table', context, target: selected })}>
            Edit table
          </button>
        )}
        {selected?.type === 'link' && (
          <button onClick={() => setDialog({ kind: 'link', context, target: selected })}>
            Edit link
          </button>
        )}
        {ready && canManageObject(selected, objects) && (
          <button onClick={() => setDialog({ kind: 'object', context, target: selected })}>
            Object tools
          </button>
        )}
        <span className="insert-context-hint">
          Added locally · advanced editors set their own position
        </span>
      </div>
      {dialog?.kind === 'table' && (
        <InsertTableDialog
          context={dialog.context}
          target={dialog.target}
          onClose={() => setDialog(undefined)}
        />
      )}
      {dialog?.kind === 'link' && (
        <InsertLinkDialog
          context={dialog.context}
          target={dialog.target}
          onClose={() => setDialog(undefined)}
        />
      )}
      {dialog?.kind === 'object' && (
        <InsertObjectDialog
          context={dialog.context}
          target={dialog.target}
          onClose={() => setDialog(undefined)}
        />
      )}
    </div>
  );
}
