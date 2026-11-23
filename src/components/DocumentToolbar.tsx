import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Columns2,
  Maximize,
  Minus,
  Plus,
} from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useViewStore } from '../store/useViewStore';
import { boundedPage, boundedZoom, MAX_ZOOM, MIN_ZOOM } from '../lib/viewGeometry';
import '../view.css';

function CommitNumber({
  label,
  value,
  min,
  max,
  commit,
  whole = false,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  commit: (number: number) => void;
  whole?: boolean;
}) {
  const [draft, setDraft] = useState(String(value));
  const dirty = useRef(false);
  useEffect(() => {
    setDraft(String(value));
    dirty.current = false;
  }, [value]);
  const apply = () => {
    const parsed = draft.trim() ? Number(draft) : value;
    const number = whole ? Math.trunc(parsed) : Math.round(parsed * 10) / 10;
    const next = Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : value;
    dirty.current = false;
    setDraft(String(next));
    commit(next);
  };
  return (
    <input
      aria-label={label}
      type="number"
      min={min}
      max={max}
      step={whole ? 1 : 'any'}
      value={draft}
      onChange={(event) => {
        dirty.current = true;
        setDraft(event.target.value);
      }}
      onBlur={() => {
        if (dirty.current) apply();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          apply();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          dirty.current = false;
          setDraft(String(value));
        }
      }}
    />
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="view-group" role="group" aria-label={label}>
      <div className="view-group-controls">{children}</div>
      <span>{label}</span>
    </div>
  );
}

export function DocumentToolbar() {
  const state = useAppStore();
  const view = useViewStore();
  const count = state.pageSettings.order.length;
  const customZoom = (value: number) => {
    view.setZoomMode('custom');
    state.setZoom(boundedZoom(value, state.zoom));
  };
  const navigate = (value: number) => state.setSelectedPage(boundedPage(value, count));
  return (
    <div className="document-toolbar" aria-label="Document view controls">
      {' '}
      <Group label="Zoom">
        <button
          aria-label="Zoom out"
          title="Zoom out"
          disabled={state.zoom <= MIN_ZOOM}
          onClick={() => customZoom(state.zoom - 10)}
        >
          <Minus size={15} />
        </button>
        <label className="view-number">
          <CommitNumber
            label="Zoom percent"
            value={state.zoom}
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            commit={customZoom}
          />
          <span>%</span>
        </label>
        <button
          aria-label="Zoom in"
          title="Zoom in"
          disabled={state.zoom >= MAX_ZOOM}
          onClick={() => customZoom(state.zoom + 10)}
        >
          <Plus size={15} />
        </button>
        <button
          aria-pressed={view.zoomMode === 'custom' && state.zoom === 100}
          onClick={() => customZoom(100)}
        >
          100%
        </button>
      </Group>
      <Group label="Fit to workspace">
        <button aria-pressed={view.zoomMode === 'width'} onClick={() => view.setZoomMode('width')}>
          <Columns2 size={15} />
          Fit width
        </button>
        <button aria-pressed={view.zoomMode === 'page'} onClick={() => view.setZoomMode('page')}>
          <Maximize size={15} />
          Fit page
        </button>
      </Group>
      <Group label="Page navigation">
        <button
          aria-label="First page"
          title="First page"
          disabled={state.selectedPage <= 1}
          onClick={() => navigate(1)}
        >
          <ChevronFirst size={15} />
        </button>
        <button
          aria-label="Previous page"
          title="Previous page"
          disabled={state.selectedPage <= 1}
          onClick={() => navigate(state.selectedPage - 1)}
        >
          <ChevronLeft size={15} />
        </button>
        <label className="view-number">
          Page
          <CommitNumber
            label="Page number"
            value={state.selectedPage}
            min={1}
            max={count || 1}
            commit={navigate}
            whole
          />
          <span>of {count || 1}</span>
        </label>
        <button
          aria-label="Next page"
          title="Next page"
          disabled={state.selectedPage >= count}
          onClick={() => navigate(state.selectedPage + 1)}
        >
          <ChevronRight size={15} />
        </button>
        <button
          aria-label="Last page"
          title="Last page"
          disabled={state.selectedPage >= count}
          onClick={() => navigate(count)}
        >
          <ChevronLast size={15} />
        </button>
      </Group>
    </div>
  );
}
