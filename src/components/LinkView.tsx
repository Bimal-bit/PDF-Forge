import { useEffect, useState } from 'react';
import type { LinkObject } from '../types';
import { prepareTableMetrics } from '../lib/tableLayout';
import { safeLinkHref } from '../lib/insertion';
import { useAppStore } from '../store/useAppStore';

export function LinkView({ object, zoom }: { object: LinkObject; zoom: number }) {
  const [, refresh] = useState(0);
  useEffect(() => {
    if (!object.fontFamily) return;
    let live = true;
    void prepareTableMetrics()
      .then(() => {
        if (live) refresh((count) => count + 1);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [object.fontFamily]);
  const scale = zoom / 100;
  return (
    <a
      className="link-object"
      data-editor-object-id={object.id}
      href={safeLinkHref(object.url)}
      target="_blank"
      rel="noreferrer"
      onFocus={() => useAppStore.getState().selectObject(object.id)}
      style={{
        left: object.x * scale,
        bottom: object.y * scale,
        fontSize: object.fontSize * scale,
        lineHeight: 1,
        fontFamily: object.fontFamily
          ? 'PDFForgeTable, sans-serif'
          : 'Helvetica, Arial, sans-serif',
        fontKerning: 'none',
        fontVariantLigatures: 'none',
        whiteSpace: 'pre',
      }}
    >
      {object.label}
    </a>
  );
}
