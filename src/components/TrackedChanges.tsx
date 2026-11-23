import { useState } from 'react';
import { EditorDialog } from './EditorDialog';
import { useAppStore } from '../store/useAppStore';
import type { TextChange } from '../types';
import { goToReviewObject } from './reviewNavigation';
import { finishInsertion } from './insertionEffects';

export function TrackedChanges() {
  const state = useAppStore();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<TextChange['status'] | 'all'>('pending');
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');
  const sourcePage = state.pageSettings.order[state.selectedPage - 1];
  const changes = state.textChanges.filter((change) => {
    const object = state.objects.find((entry) => entry.id === change.objectId);
    return (
      (filter === 'all' || change.status === filter) &&
      (scope === 'all' || object?.page === sourcePage) &&
      `${change.authors.join(' ')} ${change.before} ${change.after}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase())
    );
  });
  const pending = changes.filter(
    (change) =>
      change.status === 'pending' &&
      state.objects.some((object) => object.id === change.objectId && object.type === 'text'),
  );
  const decide = (ids: string[], accept: boolean) => {
    state.reviewTextChanges(ids, accept);
    finishInsertion();
  };
  return (
    <>
      <button disabled={!state.document} onClick={() => setOpen(true)}>
        Tracked changes
      </button>
      {open && (
        <EditorDialog title="Tracked changes" onClose={() => setOpen(false)}>
          <label className="advanced-checkbox">
            <input
              aria-label="Track text changes"
              type="checkbox"
              checked={state.trackChanges}
              onChange={(event) => state.setReviewOptions({ trackChanges: event.target.checked })}
            />
            Track text changes
          </label>
          <label>
            Author
            <input
              aria-label="Change author"
              maxLength={100}
              value={state.changeAuthor}
              onChange={(event) => state.setReviewOptions({ changeAuthor: event.target.value })}
            />
          </label>
          <p className="editing-help">
            Edits to a text block stay in one pending change until reviewed. Pending records follow
            further edits until accepted or rejected. Review records recover locally; PDF export
            uses the current text. This author is also used for new comments and highlights.
          </p>
          <div className="advanced-grid">
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
            <label>
              Pages
              <select
                aria-label="Tracked change pages"
                value={scope}
                onChange={(event) => setScope(event.target.value)}
              >
                <option value="all">All pages</option>
                <option value="current">Current page</option>
              </select>
            </label>
            <label>
              Search
              <input
                aria-label="Search tracked changes"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Author, before, or after text"
              />
            </label>
          </div>
          <p role="status">
            {changes.length} matching changes; {pending.length} pending decisions.
          </p>
          <div className="review-bulk-actions">
            <button
              aria-label="Accept visible changes"
              disabled={!pending.length}
              onClick={() =>
                decide(
                  pending.map((change) => change.id),
                  true,
                )
              }
            >
              Accept visible ({pending.length})
            </button>
            <button
              aria-label="Reject visible changes"
              disabled={!pending.length}
              onClick={() =>
                decide(
                  pending.map((change) => change.id),
                  false,
                )
              }
            >
              Reject visible ({pending.length})
            </button>
          </div>
          <p className="editing-help">
            Bulk actions affect pending changes matching these filters and create one Undo step.
            Removed-page records remain in All pages; they are excluded from Current page.
          </p>
          <ul className="text-change-list" aria-label="Text changes">
            {changes.map((change) => {
              const object = state.objects.find((entry) => entry.id === change.objectId);
              const index = object ? state.pageSettings.order.indexOf(object.page) : -1;
              const date = new Date(change.lastAt),
                validDate = Number.isFinite(date.getTime());
              return (
                <li key={change.id}>
                  <p>
                    <strong>{change.authors.join(', ')}</strong> | {change.status} |{' '}
                    {index >= 0 ? `Page ${index + 1}` : 'Unavailable page'} |{' '}
                    <time dateTime={validDate ? date.toISOString() : undefined}>
                      {validDate ? date.toLocaleString() : 'Unknown date'}
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
                    {index >= 0 && object && (
                      <button
                        onClick={() => {
                          goToReviewObject(object);
                          setOpen(false);
                        }}
                      >
                        Go to changed text
                      </button>
                    )}
                    {change.status === 'pending' && (
                      <>
                        <button
                          disabled={object?.type !== 'text'}
                          onClick={() => decide([change.id], true)}
                        >
                          Accept change
                        </button>
                        <button
                          disabled={object?.type !== 'text'}
                          onClick={() => decide([change.id], false)}
                        >
                          Reject change
                        </button>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {!changes.length && (
            <p>No {filter === 'all' ? '' : `${filter} `}text changes match these filters.</p>
          )}
        </EditorDialog>
      )}
    </>
  );
}
