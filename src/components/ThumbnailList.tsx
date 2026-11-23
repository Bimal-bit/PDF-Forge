import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { useAppStore } from '../store/useAppStore';

export function ThumbnailList({ pdf }: { pdf?: PDFDocumentProxy }) {
  const { pageSettings, selectedPage, setSelectedPage } = useAppStore();
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current
      ?.querySelector<HTMLElement>('[aria-current="page"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [selectedPage]);
  if (!pdf) return <p className="empty-panel">Loading page previews…</p>;
  return (
    <div className="thumbnail-list" ref={list} aria-label="Page thumbnails">
      {pageSettings.order.map((source, index) => (
        <Thumbnail
          key={`${source}-${index}`}
          pdf={pdf}
          source={source}
          rotation={pageSettings.rotations[source] ?? 0}
          page={index + 1}
          selected={selectedPage === index + 1}
          onClick={() => setSelectedPage(index + 1)}
        />
      ))}
    </div>
  );
}

function Thumbnail({
  pdf,
  source,
  rotation,
  page,
  selected,
  onClick,
}: {
  pdf: PDFDocumentProxy;
  source: number;
  rotation: number;
  page: number;
  selected: boolean;
  onClick: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [ratio, setRatio] = useState(612 / 792);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!button.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { root: button.current.closest('.thumbnail-list'), rootMargin: '180px' },
    );
    observer.observe(button.current);
    return () => observer.disconnect();
  }, []);
  const renderable = visible || selected;
  useEffect(() => {
    if (!renderable) return;
    let alive = true;
    let task: ReturnType<import('pdfjs-dist').PDFPageProxy['render']> | undefined;
    void pdf
      .getPage(source)
      .then(async (sheet) => {
        if (!alive || !canvas.current) return;
        const base = sheet.getViewport({ scale: 1, rotation: (sheet.rotate + rotation) % 360 });
        setRatio(base.width / base.height);
        const viewport = sheet.getViewport({
          scale: 124 / Math.max(base.width, base.height),
          rotation: (sheet.rotate + rotation) % 360,
        });
        canvas.current.width = Math.ceil(viewport.width * 1.5);
        canvas.current.height = Math.ceil(viewport.height * 1.5);
        task = sheet.render({
          canvas: canvas.current,
          viewport,
          transform: [1.5, 0, 0, 1.5, 0, 0],
        });
        await task.promise;
      })
      .catch((error: unknown) => {
        if (alive && !(error instanceof Error && error.name === 'RenderingCancelledException'))
          setFailed(true);
      });
    return () => {
      alive = false;
      task?.cancel();
    };
  }, [pdf, source, rotation, renderable]);
  return (
    <button
      ref={button}
      className={`thumbnail ${selected ? 'active' : ''}`}
      aria-label={`Go to page ${page}`}
      aria-current={selected ? 'page' : undefined}
      onClick={onClick}
    >
      <span
        className="thumbnail-paper"
        style={{ aspectRatio: ratio, width: Math.min(124, 124 * ratio) }}
      >
        <canvas ref={canvas} className="mini-page" />
        {failed && <span className="thumbnail-error">Preview unavailable</span>}
      </span>
      <span className="thumbnail-caption">
        Page {page}
        {rotation !== 0 && <small>{rotation}°</small>}
      </span>
    </button>
  );
}
