import { csvRecords } from './forms';

export function tableFromCsv(text: string): string[][] {
  if (text.length > 256 * 1024) throw new Error('Choose a CSV smaller than 256 KB.');
  const rows = csvRecords(text.replace(/^\uFEFF/, ''), true);
  if (!rows.length) throw new Error('This CSV has no cells.');
  const columns = Math.max(...rows.map((row) => row.length));
  if (rows.length > 10 || columns > 6)
    throw new Error(
      'A table can contain up to 10 rows and 6 columns. Reduce the CSV before importing.',
    );
  if (rows.some((row) => row.some((cell) => cell.length > 2000)))
    throw new Error('Each table cell can contain at most 2000 characters.');
  return rows.map((row) => Array.from({ length: columns }, (_, index) => row[index] ?? ''));
}

export function tableToCsv(cells: string[][]): string {
  return cells
    .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}
