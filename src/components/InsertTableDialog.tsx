import { assertInsertFits } from '../lib/insertion';
import { useState } from 'react';
import type { TableObject } from '../types';
import { insertionSize, resizeTable } from '../lib/insertion';
import { prepareTableMetrics, tableLayout } from '../lib/tableLayout';
import type { InsertionContext } from './useInsertion';
import { EditorDialog } from './EditorDialog';
import { FormatNumberInput } from './FormatNumberInput';
import { InsertPlacementFields } from './InsertPlacementFields';
import { TableCsvTools } from './TableCsvTools';
import { useDialogLifetime } from './useDialogLifetime';

export function InsertTableDialog({
  context,
  target,
  onClose,
}: {
  context: InsertionContext;
  target?: TableObject;
  onClose: () => void;
}) {
  const bounds = context.bounds!;
  const [size, setSize] = useState(() =>
    target ? { width: target.width, height: target.height } : insertionSize(bounds, 220, 90),
  );
  const [point, setPoint] = useState(() =>
    target ? { x: target.x, y: target.y } : context.point(size.width, size.height),
  );
  const [cells, setCells] = useState(
    target?.cells ?? [
      ['Header 1', 'Header 2'],
      ['Cell 1', 'Cell 2'],
    ],
  );
  const [header, setHeader] = useState(target?.headerRow ?? true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const live = useDialogLifetime();
  const save = async () => {
    setError('');
    setBusy(true);
    try {
      const object: TableObject = {
        id: target?.id ?? crypto.randomUUID(),
        type: 'table',
        page: context.sourcePage,
        ...point,
        ...size,
        cells,
        headerRow: header,
        fontFamily: 'Noto Sans',
      };
      assertInsertFits(bounds, point.x, point.y, size.width, size.height);
      tableLayout(object, await prepareTableMetrics());
      if (!live.current) return;
      context.commit(object, target);
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save this table.');
      setBusy(false);
    }
  };
  return (
    <EditorDialog title={target ? 'Edit table' : 'Insert table'} onClose={onClose}>
      <p>Set up your grid and enter cell values. Text wraps within each cell.</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <fieldset disabled={busy || importing} className="insert-dialog-body">
          <TableCsvTools
            cells={cells}
            onBusy={setImporting}
            onImport={(imported) => {
              const nextSize = insertionSize(
                bounds,
                Math.max(size.width, imported[0].length * 100),
                Math.max(size.height, imported.length * 36),
              );
              setCells(imported);
              setSize(nextSize);
              setPoint({
                x: Math.max(bounds.x, Math.min(point.x, bounds.x + bounds.width - nextSize.width)),
                y: Math.max(
                  bounds.y,
                  Math.min(point.y, bounds.y + bounds.height - nextSize.height),
                ),
              });
              setError('');
            }}
          />
          <div className="insert-dimensions">
            <label>
              Rows{' '}
              <select
                aria-label="Table rows"
                value={cells.length}
                onChange={(event) =>
                  setCells(resizeTable(cells, Number(event.target.value), cells[0].length))
                }
              >
                {Array.from({ length: 10 }, (_, index) => (
                  <option key={index} value={index + 1}>
                    {index + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Columns{' '}
              <select
                aria-label="Table columns"
                value={cells[0].length}
                onChange={(event) =>
                  setCells(resizeTable(cells, cells.length, Number(event.target.value)))
                }
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <option key={index} value={index + 1}>
                    {index + 1}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Width (pt){' '}
              <FormatNumberInput
                label="Table width"
                value={size.width}
                min={20}
                max={bounds.width}
                onChange={(width) => setSize({ ...size, width })}
              />
            </label>
            <label>
              Height (pt){' '}
              <FormatNumberInput
                label="Table height"
                value={size.height}
                min={20}
                max={bounds.height}
                onChange={(height) => setSize({ ...size, height })}
              />
            </label>
          </div>
          <label className="insert-check">
            <input
              type="checkbox"
              checked={header}
              onChange={(event) => setHeader(event.target.checked)}
            />{' '}
            Shade first row as header
          </label>
          <div
            className="insert-cell-grid"
            style={{ gridTemplateColumns: `repeat(${cells[0].length}, minmax(100px, 1fr))` }}
          >
            {cells.flatMap((row, rowIndex) =>
              row.map((value, column) => (
                <label
                  key={`${rowIndex}:${column}`}
                  className={header && rowIndex === 0 ? 'insert-header-cell' : ''}
                >
                  <span>
                    Row {rowIndex + 1}, column {column + 1}
                  </span>
                  <textarea
                    aria-label={`Cell ${rowIndex + 1}:${column + 1}`}
                    value={value}
                    maxLength={2000}
                    onChange={(event) =>
                      setCells(
                        cells.map((entry, index) =>
                          index === rowIndex
                            ? entry.map((text, col) => (col === column ? event.target.value : text))
                            : entry,
                        ),
                      )
                    }
                  />
                </label>
              )),
            )}
          </div>
          <InsertPlacementFields bounds={bounds} {...point} onChange={setPoint} />
          <p className="insert-note">
            Up to 10 rows × 6 columns. Long text scales down to 6 pt; enlarge the table if it needs
            more room.
          </p>
        </fieldset>
        {error && (
          <p role="alert" className="insert-error">
            {error}
          </p>
        )}
        <div className="insert-dialog-actions">
          <span>Page {context.selectedPage}</span>
          <button type="submit" disabled={busy || importing}>
            {busy ? 'Preparing table…' : target ? 'Save table' : 'Insert table'}
          </button>
        </div>
      </form>
    </EditorDialog>
  );
}
