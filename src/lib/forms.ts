import type { EditorObject, OpenDocument, PageSettings } from '../types';
import { exportPdf } from './export';

export type MergeRow = Record<string, string>;

export function parseCsv(text: string): MergeRow[] {
  const records = csvRecords(text.replace(/^\uFEFF/, ''));
  if (!records.length) return [];
  const headers = records[0].map((header) => header.trim());
  if (headers.some((header) => !header) || new Set(headers).size !== headers.length) {
    throw new Error('CSV column headers must be nonempty and unique.');
  }
  return records.slice(1).map((record) => {
    if (record.length > headers.length) throw new Error('A CSV row has more values than column headers.');
    return Object.fromEntries(headers.map((header, index) => [header, record[index]?.trim() ?? '']));
  });
}

function csvRecords(text: string): string[][] {
  const records: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  let closedQuote = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character !== '"') value += character;
      else if (text[index + 1] === '"') { value += '"'; index += 1; }
      else { quoted = false; closedQuote = true; }
      continue;
    }
    if (character === ',' || character === '\r' || character === '\n') {
      row.push(value);
      value = '';
      closedQuote = false;
      if (character !== ',') {
        if (row.length > 1 || row[0].trim()) records.push(row);
        row = [];
        if (character === '\r' && text[index + 1] === '\n') index += 1;
      }
    } else if (character === '"') {
      if (value.trim() || closedQuote) throw new Error('Invalid quoting in CSV data.');
      value = '';
      quoted = true;
    } else {
      if (closedQuote && character.trim()) throw new Error('Unexpected text after a quoted CSV value.');
      value += character;
    }
  }
  if (quoted) throw new Error('A quoted CSV value is unfinished.');
  row.push(value);
  if (row.length > 1 || row[0].trim()) records.push(row);
  return records;
}

export function fillMergeTokens(value: string, row: MergeRow): string { return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key: string) => row[key] ?? ''); }

export function mergeObjects(objects: EditorObject[], row: MergeRow): EditorObject[] {
  return objects.map((object) => object.type === 'text' ? { ...object, text: fillMergeTokens(object.text, row) } : object.type === 'link' ? { ...object, label: fillMergeTokens(object.label, row), url: fillMergeTokens(object.url, row) } : object.type === 'form' ? { ...object, label: fillMergeTokens(object.label, row), value: fillMergeTokens(object.value, row) } : object);
}

export async function exportMailMerge(document: OpenDocument, objects: EditorObject[], settings: PageSettings, rows: MergeRow[]): Promise<Array<{ name: string; bytes: Uint8Array }>> {
  return Promise.all(rows.map(async (row, index) => ({ name: `${document.name.replace(/\.pdf$/i, '')}-${row.name || row.Name || index + 1}.pdf`, bytes: await exportPdf(document, mergeObjects(objects, row), settings) })));
}
