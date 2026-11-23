import { useState } from 'react';
import type { AnnotationObject } from '../types';
import { annotationTitle, isAnnotation } from '../lib/annotations';
import { useAppStore } from '../store/useAppStore';
import { EditorDialog } from './EditorDialog';
import type { InsertionContext } from './useInsertion';
import { goToReviewObject } from './reviewNavigation';

export function ReviewAnnotations({
  context,
  onEdit,
  onClose,
}: {
  context: InsertionContext;
  onEdit: (object: AnnotationObject) => void;
  onClose: () => void;
}) {
  const state = useAppStore();
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState('all');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const annotations = state.objects
    .filter(isAnnotation)
    .filter((object) => {
      const comment = object.type === 'highlight' || object.type === 'note';
      return (
        state.pageSettings.order.includes(object.page) &&
        (scope === 'all' || object.page === context.sourcePage) &&
        (kind === 'all' || object.type === kind) &&
        (status === 'all' || (comment && Boolean(object.resolved) === (status === 'resolved'))) &&
        `${annotationTitle(object)} ${comment ? object.author : ''} ${object.type}`
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase())
      );
    })
    .sort(
      (a, b) => state.pageSettings.order.indexOf(a.page) - state.pageSettings.order.indexOf(b.page),
    );
  return (
    <EditorDialog title="Comments & marks" onClose={onClose}>
      <div className="advanced-grid">
        <label>
          Search
          <input
            aria-label="Search review marks"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Text, author, or mark type"
          />
        </label>
        <label>
          Pages
          <select
            aria-label="Review page filter"
            value={scope}
            onChange={(event) => setScope(event.target.value)}
          >
            <option value="all">All pages</option>
            <option value="current">Current page</option>
          </select>
        </label>
        <label>
          Kind
          <select
            aria-label="Review mark type"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="all">All marks</option>
            <option value="note">Comments</option>
            <option value="highlight">Highlights</option>
            <option value="stamp">Stamps</option>
            <option value="measure">Measurements</option>
          </select>
        </label>
        <label>
          Comment status
          <select
            aria-label="Review comment status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="open">Open comments</option>
            <option value="resolved">Resolved comments</option>
          </select>
        </label>
      </div>
      <p role="status">
        {annotations.length} matching mark{annotations.length === 1 ? '' : 's'}.
      </p>
      <ul className="review-mark-list" aria-label="Review marks">
        {annotations.map((object) => (
          <li key={object.id}>
            <p className="review-entry-meta">
              Page {state.pageSettings.order.indexOf(object.page) + 1} · {object.type}
              {(object.type === 'note' || object.type === 'highlight') &&
                ` · ${object.resolved ? 'Resolved' : 'Open'} · ${object.author || 'Local editor'}`}
            </p>
            <p className="review-entry-content">{annotationTitle(object)}</p>
            <div className="review-entry-actions">
              <button
                onClick={() => {
                  goToReviewObject(object);
                  onClose();
                }}
              >
                Go to mark
              </button>
              <button
                disabled={object.page !== context.sourcePage || !context.bounds}
                title={
                  object.page !== context.sourcePage
                    ? 'Go to this mark, then choose Edit mark in Review.'
                    : undefined
                }
                onClick={() => onEdit(object)}
              >
                Edit mark
              </button>
              {(object.type === 'note' || object.type === 'highlight') && (
                <button
                  onClick={() => state.updateObject(object.id, { resolved: !object.resolved })}
                >
                  {object.resolved ? 'Reopen comment' : 'Resolve comment'}
                </button>
              )}
              <button onClick={() => state.removeObject(object.id)}>Delete mark</button>
            </div>
          </li>
        ))}
      </ul>
      {!annotations.length && (
        <p>No marks match these filters. Add a comment or highlight, or change the filters.</p>
      )}
      <p className="editing-help">
        Marks stay visible when resolved. This list follows the current page plan; duplicated pages
        share their marks. Go to a mark on another page before editing its geometry.
      </p>
    </EditorDialog>
  );
}
