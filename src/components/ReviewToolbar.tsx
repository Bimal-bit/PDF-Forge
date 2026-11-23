import { useState } from 'react';
import { Highlighter, MessageSquare, Ruler, Stamp } from 'lucide-react';
import type { AnnotationObject } from '../types';
import { annotationTitle, isAnnotation, validateAnnotation } from '../lib/annotations';
import { insertionSize } from '../lib/insertion';
import { useAppStore } from '../store/useAppStore';
import { useInsertion, type InsertionContext } from './useInsertion';
import { TrackedChanges } from './TrackedChanges';
import { ReviewAnnotations } from './ReviewAnnotations';
import { ReviewAnnotationEditor } from './ReviewAnnotationEditor';
import { ReviewExchange } from './ReviewExchange';
import { revealTextObject } from './revealTextObject';
import '../review.css';

type ReviewDialog =
  { kind: 'list' } | { kind: 'edit'; target: AnnotationObject; context: InsertionContext };

export function ReviewToolbar() {
  const state = useAppStore(),
    context = useInsertion('top');
  const [color, setColor] = useState('#f6d365');
  const [stamp, setStamp] = useState<'APPROVED' | 'DRAFT' | 'CONFIDENTIAL'>('APPROVED');
  const [dialog, setDialog] = useState<ReviewDialog>();
  const marks = state.objects
    .filter(isAnnotation)
    .filter((object) => state.pageSettings.order.includes(object.page));
  const currentMarks = marks.filter((object) => object.page === context.sourcePage);
  const selected = currentMarks.find((object) => object.id === state.selectedObjectId);
  const openComments = marks.filter(
    (object) => (object.type === 'highlight' || object.type === 'note') && !object.resolved,
  ).length;
  const insert = (kind: AnnotationObject['type']) => {
    try {
      const bounds = context.bounds!;
      const base = { id: crypto.randomUUID(), page: context.sourcePage };
      const author = state.changeAuthor.trim() || 'Local editor';
      let object: AnnotationObject;
      if (kind === 'highlight') {
        const size = insertionSize(bounds, 160, 20);
        object = {
          ...base,
          type: kind,
          ...size,
          ...context.point(size.width, size.height),
          color,
          author,
          comment: 'Highlight',
        };
      } else if (kind === 'note')
        object = { ...base, type: kind, ...context.point(22, 22), author, comment: 'New comment' };
      else if (kind === 'stamp')
        object = { ...base, type: kind, ...context.point(110, 32), label: stamp };
      else {
        const size = insertionSize(bounds, 144, 24),
          point = context.point(size.width, 24);
        object = {
          ...base,
          type: 'measure',
          x: point.x,
          y: point.y + 8,
          width: size.width,
          height: 0,
          units: 'in',
        };
      }
      validateAnnotation(object, bounds);
      context.commit(object);
    } catch (error) {
      state.setNotice(error instanceof Error ? error.message : 'Could not add this review mark.');
    }
  };
  return (
    <div className="review-toolbar">
      <div
        className="review-command-scroll"
        role="region"
        aria-label="Review commands"
        tabIndex={0}
      >
        <div className="review-command-group review-markup-group">
          <button
            disabled={!context.bounds}
            title="Add a rectangular highlight; use Edit mark to adjust its bounds."
            onClick={() => insert('highlight')}
          >
            <Highlighter size={14} />
            Highlight
          </button>
          <label className="review-color">
            Color
            <input
              aria-label="New highlight color"
              type="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
            />
          </label>
          <button disabled={!context.bounds} onClick={() => insert('note')}>
            <MessageSquare size={14} />
            Add comment
          </button>
          <span className="review-group-label">Comments & highlights</span>
        </div>
        <div className="review-command-group review-stamp-group">
          <select
            aria-label="New review stamp"
            value={stamp}
            onChange={(event) => setStamp(event.target.value as typeof stamp)}
          >
            <option value="APPROVED">Approved</option>
            <option value="DRAFT">Draft</option>
            <option value="CONFIDENTIAL">Confidential</option>
          </select>
          <button disabled={!context.bounds} onClick={() => insert('stamp')}>
            <Stamp size={14} />
            {stamp === 'APPROVED' ? 'Approved' : stamp === 'DRAFT' ? 'Draft' : 'Confidential'} stamp
          </button>
          <button disabled={!context.bounds} onClick={() => insert('measure')}>
            <Ruler size={14} />
            Measure
          </button>
          <span className="review-group-label">Stamps & measurement</span>
        </div>
        <div className="review-command-group">
          <button disabled={!state.document} onClick={() => setDialog({ kind: 'list' })}>
            Comments & marks
          </button>
          <button
            disabled={!selected || !context.bounds}
            onClick={() => {
              if (selected) setDialog({ kind: 'edit', context, target: selected });
            }}
          >
            Edit mark
          </button>
          <span className="review-group-label">Manage review marks</span>
        </div>
        <div className="review-command-group review-track-group">
          <TrackedChanges />
          <span className="review-group-label">Text revisions</span>
        </div>
        <div className="review-command-group">
          <ReviewExchange />
          <span className="review-group-label">Local annotation exchange</span>
        </div>
      </div>
      <div className="review-context-bar">
        <span>
          Page {state.selectedPage} of {state.pageSettings.order.length || 1}
        </span>
        <span className="review-counts">
          {openComments} open · Tracking {state.trackChanges ? 'on' : 'off'}
        </span>
        <label>
          Mark
          <select
            aria-label="Review mark"
            value={selected?.id ?? ''}
            onChange={(event) => {
              state.selectObject(event.target.value || undefined);
              revealTextObject(event.target.value, state.selectedPage);
            }}
          >
            <option value="">Choose a mark</option>
            {currentMarks.map((object) => (
              <option key={object.id} value={object.id}>
                {annotationTitle(object).slice(0, 45)}
              </option>
            ))}
          </select>
        </label>
        <span className="review-context-hint">Comments and review records stay on this device</span>
      </div>
      {dialog?.kind === 'list' && (
        <ReviewAnnotations
          context={context}
          onClose={() => setDialog(undefined)}
          onEdit={(target) => setDialog({ kind: 'edit', context, target })}
        />
      )}
      {dialog?.kind === 'edit' && (
        <ReviewAnnotationEditor
          context={dialog.context}
          target={dialog.target}
          onClose={() => setDialog(undefined)}
        />
      )}
    </div>
  );
}
