import { useEffect, useState } from 'react';
import type { TableObject } from '../types';
import { currentTableMetrics, prepareTableMetrics, tableLayout } from '../lib/tableLayout';

export function TableView({ object, zoom }: { object: TableObject; zoom: number }) {
  const [, refresh] = useState(0);
  const [error, setError] = useState('');
  useEffect(() => {
    if (object.fontFamily !== 'Noto Sans') return;
    let live = true;
    void prepareTableMetrics()
      .then(() => {
        if (live) refresh((value) => value + 1);
      })
      .catch(() => {
        if (live) setError('The local table font could not be loaded.');
      });
    return () => {
      live = false;
    };
  }, [object.fontFamily]);
  const metrics = currentTableMetrics(object),
    scale = zoom / 100;
  let layout;
  try {
    layout = tableLayout(object, metrics);
  } catch (failure) {
    return (
      <span
        className="insert-table-error"
        data-editor-object-id={object.id}
        style={{ position: 'absolute', left: object.x * scale, bottom: object.y * scale }}
      >
        {failure instanceof Error ? failure.message : 'Edit this table to correct its layout.'}
      </span>
    );
  }
  return (
    <div
      className="table-object"
      data-editor-object-id={object.id}
      role="table"
      aria-label="Inserted table"
      style={{
        left: object.x * scale,
        bottom: object.y * scale,
        width: object.width * scale,
        height: object.height * scale,
        background: 'white',
        color: '#292724',
        fontFamily: metrics.family,
        fontKerning: 'none',
        fontVariantLigatures: 'none',
      }}
    >
      {error && <span role="alert">{error}</span>}
      {Array.from({ length: layout.rows }, (_, row) => (
        <div role="row" key={row}>
          {layout!.cells
            .filter((cell) => cell.row === row)
            .map((cell) => (
              <div
                role={cell.header ? 'columnheader' : 'cell'}
                key={cell.column}
                style={{
                  position: 'absolute',
                  left: cell.x * scale,
                  top: cell.top * scale,
                  width: cell.width * scale,
                  height: cell.height * scale,
                  border: `${0.6 * scale}px solid #a6a1b3`,
                  background: cell.header ? '#f0eefb' : 'white',
                  padding: `${5 * scale}px`,
                  boxSizing: 'border-box',
                  fontSize: cell.size * scale,
                  lineHeight: 1.2,
                  whiteSpace: 'pre',
                  fontWeight: 400,
                }}
              >
                {cell.lines.join('\n')}
              </div>
            ))}
        </div>
      ))}
    </div>
  );
}
