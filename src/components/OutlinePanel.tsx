import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useAppStore } from '../store/useAppStore';

export interface OutlineItem {
  title: string;
  dest?: string | unknown[] | null;
  items: OutlineItem[];
}
interface ResolvedItem {
  id: string;
  title: string;
  source?: number;
  children: ResolvedItem[];
}

export function OutlinePanel({
  pdf,
  outline,
  loaded,
}: {
  pdf?: PDFDocumentProxy;
  outline: OutlineItem[];
  loaded: boolean;
}) {
  const [items, setItems] = useState<ResolvedItem[]>([]);
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [resolving, setResolving] = useState(false);
  const { pageSettings, selectedPage, setSelectedPage, setNotice } = useAppStore();
  useEffect(() => {
    let alive = true;
    setItems([]);
    setQuery('');
    setCollapsed(new Set());
    setResolving(false);
    if (!pdf || !outline.length) return;
    setResolving(true);
    const resolve = async (entries: OutlineItem[], prefix = ''): Promise<ResolvedItem[]> =>
      Promise.all(
        entries.map(async (item, index) => {
          const id = `${prefix}${index}`;
          let source: number | undefined;
          try {
            const destination =
              typeof item.dest === 'string' ? await pdf.getDestination(item.dest) : item.dest;
            const ref = destination?.[0];
            if (typeof ref === 'number') source = ref + 1;
            else if (ref && typeof ref === 'object' && 'num' in ref && 'gen' in ref)
              source = (await pdf.getPageIndex(ref as { num: number; gen: number })) + 1;
            if (source !== undefined && (source < 1 || source > pdf.numPages)) source = undefined;
          } catch {
            /* Broken/external destinations remain labelled and unavailable. */
          }
          return {
            id,
            title: item.title.trim() || 'Untitled section',
            source,
            children: await resolve(item.items ?? [], `${id}.`),
          };
        }),
      );
    void resolve(outline)
      .then((result) => {
        if (alive) {
          setItems(result);
          setResolving(false);
        }
      })
      .catch(() => {
        if (alive) {
          setResolving(false);
          setNotice('Could not resolve this document outline.');
        }
      });
    return () => {
      alive = false;
    };
  }, [pdf, outline, setNotice]);
  const matches = (item: ResolvedItem): boolean =>
    item.title.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()) ||
    item.children.some(matches);
  const allParents = (nodes: ResolvedItem[]): string[] =>
    nodes.flatMap((item) => [
      ...(item.children.length ? [item.id] : []),
      ...allParents(item.children),
    ]);
  const render = (nodes: ResolvedItem[]) => (
    <ul>
      {nodes.filter(matches).map((item) => {
        const sameSource = item.source === pageSettings.order[selectedPage - 1];
        const index = sameSource ? selectedPage - 1 : pageSettings.order.indexOf(item.source ?? -1);
        const expanded = Boolean(query.trim()) || !collapsed.has(item.id);
        return (
          <li key={item.id}>
            <div className={`outline-row${sameSource ? ' active' : ''}`}>
              {item.children.length ? (
                <button
                  className="outline-expander"
                  aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.title}`}
                  aria-expanded={expanded}
                  onClick={() =>
                    setCollapsed((current) => {
                      const next = new Set(current);
                      if (next.has(item.id)) next.delete(item.id);
                      else next.add(item.id);
                      return next;
                    })
                  }
                >
                  {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              ) : (
                <span className="outline-spacer" />
              )}
              <button
                className="outline-destination"
                disabled={index < 0}
                aria-current={sameSource ? 'location' : undefined}
                title={
                  index < 0
                    ? 'This destination is unavailable in the current page sequence.'
                    : `Go to page ${index + 1}`
                }
                onClick={() => setSelectedPage(index + 1)}
              >
                <span>{item.title}</span>
                <small>{index < 0 ? '—' : index + 1}</small>
              </button>
            </div>
            {item.children.length > 0 && expanded && render(item.children)}
          </li>
        );
      })}
    </ul>
  );
  if (!pdf || !loaded || resolving) return <p className="empty-panel">Loading document outline…</p>;
  if (!outline.length)
    return (
      <div className="navigation-empty">
        <strong>No bookmarks in this PDF</strong>
        <p>Use Pages to browse the document. Embedded bookmarks appear here when available.</p>
      </div>
    );
  return (
    <>
      <label className="navigation-filter">
        <Search size={14} />
        <input
          aria-label="Filter outline"
          placeholder="Find a section"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="outline-controls">
        <button onClick={() => setCollapsed(new Set())} disabled={Boolean(query)}>
          Expand all
        </button>
        <button onClick={() => setCollapsed(new Set(allParents(items)))} disabled={Boolean(query)}>
          Collapse all
        </button>
      </div>
      <nav className="outline-tree" aria-label="PDF outline">
        {items.some(matches) ? render(items) : <p className="empty-panel">No matching sections.</p>}
      </nav>
    </>
  );
}
