import { useState } from 'react';
import { tableFromCsv, tableToCsv } from '../lib/tableCsv';
import { useDialogLifetime } from './useDialogLifetime';

export function TableCsvTools({
  cells,
  onImport,
  onBusy,
}: {
  cells: string[][];
  onImport: (cells: string[][]) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const live = useDialogLifetime();
  return (
    <div className="table-csv-tools">
      <label className="table-csv-import">
        Import CSV
        <input
          aria-label="Import table CSV"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            setMessage('');
            setError('');
            if (file.size > 256 * 1024) {
              setError('Choose a CSV smaller than 256 KB.');
              return;
            }
            onBusy(true);
            void file
              .arrayBuffer()
              .then((bytes) => {
                if (!live.current) return;
                let text: string;
                try {
                  text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
                } catch {
                  throw new Error('Save the CSV as UTF-8 before importing.');
                }
                const imported = tableFromCsv(text);
                onImport(imported);
                setMessage(
                  `Imported ${imported.length} rows and ${imported[0].length} columns. Review the cells before saving.`,
                );
              })
              .catch((failure: unknown) => {
                if (live.current)
                  setError(
                    failure instanceof Error ? failure.message : 'Could not import this CSV.',
                  );
              })
              .finally(() => {
                if (live.current) onBusy(false);
              });
          }}
        />
      </label>
      <button
        type="button"
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob(['\uFEFF', tableToCsv(cells)], { type: 'text/csv;charset=utf-8' }),
          );
          const link = document.createElement('a');
          link.href = url;
          link.download = 'table.csv';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        Download table CSV
      </button>
      <p className="insert-note">
        Import a UTF-8 CSV. Every row becomes a table row, including the first row.
      </p>
      {message && (
        <p role="status" className="insert-note">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="insert-error">
          {error}
        </p>
      )}
    </div>
  );
}
