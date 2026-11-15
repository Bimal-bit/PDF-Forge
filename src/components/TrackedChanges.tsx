import { useState } from 'react';
import { EditorDialog } from './EditorDialog';
import { useAppStore } from '../store/useAppStore';
import type { TextChange } from '../types';

export function TrackedChanges() {
  const {
    document,
    objects,
    pageSettings,
    trackChanges,
    changeAuthor,
    textChanges,
    setReviewOptions,
    reviewTextChange,
    selectObject,
    setSelectedPage,
  } = useAppStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<TextChange['status'] | 'all'>('pending');
  const changes = textChanges.filter((change) => filter === 'all' || change.status === filter);
  return (
    <>
      <button disabled={!document} onClick={() => setOpen(true)}>
        Tracked changes
      </button>
      {open && (
        <EditorDialog title="Tracked changes" onClose={() => setOpen(false)}>
          <label className="advanced-checkbox">
            <input
              aria-label="Track text changes"
              type="checkbox"
              checked={trackChanges}
              onChange={(event) => setReviewOptions({ trackChanges: event.target.checked })}
            />
            Track text changes
          </label>
          <label>
            Author
            <input
              aria-label="Change author"
              maxLength={100}
              value={changeAuthor}
              onChange={(event) => setReviewOptions({ changeAuthor: event.target.value })}
            />
          </label>
          <p className="editing-help">
            Edits to a text block stay in one pending change until reviewed. Pending records follow
            further edits until accepted or rejected. The record lists its authors and
            original/current text. PDF export uses the current text. Review records recover locally
            with the workspace.
          </p>
          <label>
            Show
            <select
              aria-label="Change filter"
              value={filter}
              onChange={(event) => setFilter(event.target.value as typeof filter)}
            >
              <option value="pending">Pending</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
              <option value="all">All changes</option>
            </select>
          </label>
          <ul className="text-change-list" aria-label="Text changes">
            {changes.map((change) => {
              const object = objects.find((entry) => entry.id === change.objectId);
              const index = object ? pageSettings.order.indexOf(object.page) : -1;
              return (
                <li key={change.id}>
                  <p>
                    <strong>{change.authors.join(', ')}</strong> · {change.status} ·{' '}
                    <time dateTime={new Date(change.lastAt).toISOString()}>
                      {new Date(change.lastAt).toLocaleString()}
                    </time>
                  </p>
                  <div className="change-comparison">
                    <div>
                      <span>Before</span>
                      <del>{change.before || '(empty)'}</del>
                    </div>
                    <div>
                      <span>After</span>
                      <ins>{change.after || '(empty)'}</ins>
                    </div>
                  </div>
                  <div className="advanced-grid">
                    {index >= 0 && (
                      <button
                        onClick={() => {
                          selectObject(change.objectId);
                          setSelectedPage(index + 1);
                        }}
                      >
                        Go to changed text
                      </button>
                    )}
                    {change.status === 'pending' && (
                      <>
                        <button onClick={() => reviewTextChange(change.id, true)}>
                          Accept change
                        </button>
                        <button onClick={() => reviewTextChange(change.id, false)}>
                          Reject change
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {!changes.length && <p>No {filter === 'all' ? '' : `${filter} `}text changes.</p>}
        </EditorDialog>
      )}
    </>
  );
}
