import { useState } from 'react';
import { Eraser, Replace } from 'lucide-react';
import type { TextObject } from '../types';
import type { TextSelectionGroup } from '../store/useTextSelectionStore';
import { useAppStore } from '../store/useAppStore';
import { EditorDialog } from './EditorDialog';
import { applyTextScope, captureTextScope, type TextToolScope } from './textToolScope';
import { cleanText, replaceLiteral, type CleanupMode } from '../lib/textTools';
import '../home-text-tools.css';

export function HomeTextTools({
  selected,
  group,
}: {
  selected?: TextObject;
  group?: TextSelectionGroup;
}) {
  const [dialog, setDialog] = useState<{ scope: TextToolScope; mode: 'replace' | 'cleanup' }>();
  const setNotice = useAppStore((state) => state.setNotice);
  const open = (mode: 'replace' | 'cleanup') => {
    if (!selected) return;
    try {
      setDialog({ scope: captureTextScope(selected, group), mode });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Select text before using this tool.');
    }
  };
  return (
    <>
      <div className="format-group home-text-tools">
        <button disabled={!selected} onClick={() => open('replace')}>
          <Replace size={14} />
          Replace text
        </button>
        <button disabled={!selected} onClick={() => open('cleanup')}>
          <Eraser size={14} />
          Clean up text
        </button>
        <span className="ribbon-group-label">Text tools</span>
      </div>
      {dialog && <TextToolsDialog {...dialog} onClose={() => setDialog(undefined)} />}
    </>
  );
}

function TextToolsDialog({
  scope,
  mode,
  onClose,
}: {
  scope: TextToolScope;
  mode: 'replace' | 'cleanup';
  onClose: () => void;
}) {
  const [find, setFind] = useState('');
  const [replacement, setReplacement] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [cleanup, setCleanup] = useState<CleanupMode>('spaces');
  const [error, setError] = useState('');
  const transform = (text: string) =>
    mode === 'replace'
      ? replaceLiteral(text, find, replacement, matchCase).text
      : cleanText(text, cleanup);
  const previews = scope.targets.map((object) => ({
    before: object.text,
    after: transform(object.text),
  }));
  const changed = previews.filter((preview) => preview.before !== preview.after).length;
  const matches =
    mode === 'replace'
      ? scope.targets.reduce(
          (sum, object) => sum + replaceLiteral(object.text, find, replacement, matchCase).count,
          0,
        )
      : 0;
  return (
    <EditorDialog
      title={mode === 'replace' ? 'Replace selected text' : 'Clean up selected text'}
      onClose={onClose}
    >
      <p>
        {scope.targets.length} text {scope.targets.length === 1 ? 'block' : 'blocks'} selected.
        Changes apply to complete blocks or source runs. Formatting and position are retained.
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const count = applyTextScope(scope, transform);
            useAppStore
              .getState()
              .setNotice(`Updated ${count} text ${count === 1 ? 'block' : 'blocks'}.`);
            onClose();
          } catch (failure) {
            setError(failure instanceof Error ? failure.message : 'Could not update this text.');
          }
        }}
      >
        {mode === 'replace' ? (
          <>
            <label>
              Find text
              <input
                aria-label="Find text to replace"
                value={find}
                maxLength={2000}
                onChange={(event) => setFind(event.target.value)}
                autoFocus
              />
            </label>
            <label>
              Replace with
              <input
                aria-label="Replacement text"
                value={replacement}
                maxLength={2000}
                onChange={(event) => setReplacement(event.target.value)}
              />
            </label>
            <label className="text-tools-check">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(event) => setMatchCase(event.target.checked)}
              />
              Match case
            </label>
            <p className="editing-help" aria-live="polite">
              {matches} {matches === 1 ? 'match' : 'matches'} in the selected blocks. Each block is
              searched separately using literal text.
            </p>
          </>
        ) : (
          <label>
            Cleanup
            <select
              aria-label="Text cleanup"
              value={cleanup}
              onChange={(event) => setCleanup(event.target.value as CleanupMode)}
            >
              <option value="spaces">Collapse repeated spaces and tabs</option>
              <option value="trim">Trim each line</option>
              <option value="empty-lines">Remove empty lines</option>
            </select>
          </label>
        )}
        <div className="text-tools-preview" aria-label="Text change preview">
          {previews.slice(0, 20).map((preview, index) => (
            <section key={index}>
              <span>
                Block {index + 1}
                {preview.before === preview.after ? ' · unchanged' : ''}
              </span>
              <div>
                <div className="text-tools-value">
                  <span>Before</span>
                  <pre aria-label={`Before block ${index + 1}`}>
                    {preview.before.slice(0, 4000) || '(empty)'}
                  </pre>
                </div>
                <div className="text-tools-value">
                  <span>After</span>
                  <pre aria-label={`After block ${index + 1}`}>
                    {preview.after.slice(0, 4000) || '(empty)'}
                  </pre>
                </div>
              </div>
            </section>
          ))}
        </div>
        {previews.length > 20 && (
          <p className="editing-help">
            Preview shows the first 20 blocks. All {previews.length} selected blocks will be
            processed.
          </p>
        )}
        {error && (
          <p role="alert" className="editing-warning">
            {error}
          </p>
        )}
        <div className="text-tools-actions">
          <span>
            {changed} {changed === 1 ? 'block' : 'blocks'} will change · one Undo step
          </span>
          <button type="submit" disabled={!changed}>
            {mode === 'replace' ? 'Replace all in selection' : 'Apply cleanup'}
          </button>
        </div>
      </form>
    </EditorDialog>
  );
}
