import { PanelRightClose, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ObjectEditor } from './ObjectEditor';
import { objectLabel } from '../lib/insertion';
import { PanelResizeHandle } from './PanelResizeHandle';

export function PropertiesPanel({ ready, onClose }: { ready: boolean; onClose?: () => void }) {
  const state = useAppStore();
  const [tab, setTab] = useState('objects');
  const [scope, setScope] = useState('all');
  const [query, setQuery] = useState('');
  useEffect(() => {
    if (state.selectedObjectId) setTab('objects');
  }, [state.selectedObjectId]);
  useEffect(() => {
    setQuery('');
    setScope('all');
  }, [state.document?.id]);
  const objects = state.objects.filter((object) => state.pageSettings.order.includes(object.page));
  const filtered = objects.filter(
    (object) =>
      (scope === 'all' || object.page === state.pageSettings.order[state.selectedPage - 1]) &&
      `${objectLabel(object)} ${'text' in object ? object.text : ''} ${'label' in object ? object.label : ''} ${'comment' in object ? object.comment : ''}`
        .toLocaleLowerCase()
        .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <aside className="right-panel" aria-label="Properties">
      <div className="properties-heading">
        <strong>Inspector</strong>
        <button
          className="close-panel"
          aria-label="Hide properties panel"
          title="Hide properties panel"
          onClick={onClose ?? state.toggleRightPanel}
        >
          <PanelRightClose size={16} />
        </button>
      </div>
      <div className="panel-tabs" aria-label="Inspector sections">
        <button
          className={tab === 'objects' ? 'selected' : ''}
          aria-pressed={tab === 'objects'}
          onClick={() => setTab('objects')}
        >
          Objects <span>{objects.length}</span>
        </button>
        <button
          className={tab === 'document' ? 'selected' : ''}
          aria-pressed={tab === 'document'}
          onClick={() => setTab('document')}
        >
          Document
        </button>
      </div>
      {tab === 'document' ? (
        <div className="document-details">
          <p className="inspector-document-name">{state.document?.name}</p>
          <dl>
            <dt>Status</dt>
            <dd>{ready ? 'Rendered locally' : 'Loading'}</dd>
            <dt>Pages</dt>
            <dd>{state.pageSettings.order.length || '—'}</dd>
            <dt>Source size</dt>
            <dd>{((state.document?.size ?? 0) / 1024).toFixed(1)} KB</dd>
            <dt>Recovery</dt>
            <dd>Every 5 seconds and when leaving the page</dd>
          </dl>
          <p>Your document and edits stay in this browser.</p>
        </div>
      ) : (
        <>
          <div className="inspector-filters">
            <label className="navigation-filter">
              <Search size={14} />
              <input
                aria-label="Filter objects"
                placeholder="Find an object"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <select
              aria-label="Object page scope"
              value={scope}
              onChange={(event) => setScope(event.target.value)}
            >
              <option value="all">All pages</option>
              <option value="current">Current page</option>
            </select>
          </div>
          <div className="inspector-objects">
            {filtered.length ? (
              <ObjectEditor objects={filtered} />
            ) : (
              <div className="navigation-empty">
                <strong>{objects.length ? 'No matching objects' : 'Nothing selected yet'}</strong>
                <p>
                  {objects.length
                    ? 'Try another search or page scope.'
                    : 'Insert content or edit text on the page to inspect it here.'}
                </p>
              </div>
            )}
          </div>
        </>
      )}
      <PanelResizeHandle panel="properties" />
    </aside>
  );
}
