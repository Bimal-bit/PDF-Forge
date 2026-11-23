import { Search, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { findMatches } from '../lib/pdf';
import { editedPageText } from '../lib/pageText';
import { layoutTextFrames } from '../lib/textFlow';
import { useAppStore } from '../store/useAppStore';
export interface SearchHit {
  page: number;
  count: number;
}

export function DocumentSearch({
  pdf,
  query,
  setQuery,
  hits,
  setHits,
  onSelectPage,
}: {
  pdf?: PDFDocumentProxy;
  query: string;
  setQuery: (value: string) => void;
  hits: SearchHit[];
  setHits: (hits: SearchHit[]) => void;
  onSelectPage: (page: number) => void;
}) {
  const { pageSettings, objects, selectedPage } = useAppStore();
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const cycle = (direction: -1 | 1) => {
    if (!hits.length) return;
    const next =
      direction === 1
        ? (hits.find((hit) => hit.page > selectedPage) ?? hits[0])
        : ([...hits].reverse().find((hit) => hit.page < selectedPage) ?? hits[hits.length - 1]);
    onSelectPage(next.page);
  };
  useEffect(() => {
    let alive = true;
    setHits([]);
    setFailed(false);
    setSearching(false);
    if (!pdf || !query.trim()) return;
    setSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        const results: SearchHit[] = [];
        const order = pageSettings.order.length
          ? pageSettings.order
          : Array.from({ length: pdf.numPages }, (_, index) => index + 1);
        const layouts = layoutTextFrames(objects, order);
        for (const [index, source] of order.entries()) {
          if (!alive) return;
          const content = await (await pdf.getPage(source)).getTextContent();
          const text = editedPageText(
            content.items.filter((item) => 'str' in item),
            objects.filter((object) => object.page === source),
            layouts,
          );
          const count = findMatches(text.replace(/\s+/g, ' '), query.replace(/\s+/g, ' ')).length;
          if (count) results.push({ page: index + 1, count });
        }
        if (alive) {
          setHits(results);
          setSearching(false);
        }
      })().catch(() => {
        if (alive) {
          setHits([]);
          setSearching(false);
          setFailed(true);
        }
      });
    }, 200);
    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [pdf, query, pageSettings.order, objects, setHits]);
  const total = hits.reduce((sum, hit) => sum + hit.count, 0);
  return (
    <div className="search-box">
      <Search size={14} />
      <input
        aria-label="Find text in document"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            cycle(event.shiftKey ? -1 : 1);
          }
        }}
        placeholder="Find in document"
      />
      {query && (
        <>
          <span aria-live="polite">
            {searching
              ? 'Searching…'
              : failed
                ? 'Search failed. Try again.'
                : `${total} match${total === 1 ? '' : 'es'}`}
          </span>
          <button aria-label="Clear search" onClick={() => setQuery('')}>
            <X size={13} />
          </button>
        </>
      )}
      {hits.length > 0 && (
        <>
          <button className="next-match" onClick={() => onSelectPage(hits[0].page)}>
            Go to page {hits[0].page}
          </button>
          <button
            aria-label="Previous matching page"
            title="Previous matching page (Shift+Enter)"
            onClick={() => cycle(-1)}
          >
            ←
          </button>
          <button
            aria-label="Next matching page"
            title="Next matching page (Enter)"
            onClick={() => cycle(1)}
          >
            →
          </button>
          <span>
            {hits.length} matching page{hits.length === 1 ? '' : 's'}
          </span>
        </>
      )}
    </div>
  );
}
