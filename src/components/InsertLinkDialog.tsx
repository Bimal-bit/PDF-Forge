import { assertInsertFits } from '../lib/insertion';
import { useState } from 'react';
import type { LinkObject } from '../types';
import { normalizeLinkUrl } from '../lib/insertion';
import { prepareTableMetrics } from '../lib/tableLayout';
import type { InsertionContext } from './useInsertion';
import { EditorDialog } from './EditorDialog';
import { InsertPlacementFields } from './InsertPlacementFields';
import { useDialogLifetime } from './useDialogLifetime';

export function InsertLinkDialog({
  context,
  target,
  onClose,
}: {
  context: InsertionContext;
  target?: LinkObject;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(target?.url ?? '');
  const [label, setLabel] = useState(target?.label ?? '');
  const [point, setPoint] = useState(() =>
    target ? { x: target.x, y: target.y } : context.point(180, 18),
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const live = useDialogLifetime();
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      const normalized = normalizeLinkUrl(url),
        text = label.trim() || normalized,
        fontSize = target?.fontSize ?? 12;
      const metrics = await prepareTableMetrics();
      if (!live.current) return;
      if (!metrics.supports(text))
        throw new Error('The link label contains characters unavailable in the local font.');
      if (/[\r\n]/.test(text)) throw new Error('Use a single line for the link label.');
      assertInsertFits(
        context.bounds!,
        point.x,
        point.y,
        metrics.measure(text, fontSize),
        fontSize * 1.3,
      );
      context.commit(
        {
          id: target?.id ?? crypto.randomUUID(),
          type: 'link',
          page: context.sourcePage,
          ...point,
          label: text,
          url: normalized,
          fontSize,
          fontFamily: 'Noto Sans',
        },
        target,
      );
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save this link.');
      setBusy(false);
    }
  };
  return (
    <EditorDialog title={target ? 'Edit link' : 'Insert link'} onClose={onClose}>
      <p>
        Add a website, email address, or phone number. The link remains clickable in the exported
        PDF.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy} className="insert-dialog-body">
          <label>
            Link destination
            <input
              aria-label="Link destination"
              type="text"
              required
              maxLength={2000}
              placeholder="https://example.com"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              autoFocus
            />
          </label>
          <label>
            Display text
            <input
              aria-label="Link display text"
              maxLength={500}
              placeholder="Uses the destination when left empty"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
            />
          </label>
          <p className="insert-note">
            Supports https://, http://, mailto:, and tel:. A www. address uses HTTPS.
          </p>
          <InsertPlacementFields bounds={context.bounds!} {...point} onChange={setPoint} />
        </fieldset>
        {error && (
          <p role="alert" className="insert-error">
            {error}
          </p>
        )}
        <div className="insert-dialog-actions">
          <span>Page {context.selectedPage}</span>
          <button type="submit" disabled={busy}>
            {busy ? 'Preparing link…' : target ? 'Save link' : 'Insert link'}
          </button>
        </div>
      </form>
    </EditorDialog>
  );
}
