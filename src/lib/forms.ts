import type { EditorObject, OpenDocument, PageSettings } from '../types';
import { exportPdf } from './export';

export type MergeRow = Record<string, string>;

export function parseCsv(text: string): MergeRow[] {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = csvLine(lines[0]);
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, index) => [header.trim(), csvLine(line)[index]?.trim() ?? ''])));
}

function csvLine(line: string): string[] {
  const values: string[] = []; let value = ''; let quoted = false;
  for (let index = 0; index < line.length; index += 1) { const character = line[index]; if (character === '"' && line[index + 1] === '"') { value += '"'; index += 1; } else if (character === '"') quoted = !quoted; else if (character === ',' && !quoted) { values.push(value); value = ''; } else value += character; }
  values.push(value); return values;
}

export function fillMergeTokens(value: string, row: MergeRow): string { return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, key: string) => row[key] ?? ''); }

export function mergeObjects(objects: EditorObject[], row: MergeRow): EditorObject[] {
  return objects.map((object) => object.type === 'text' ? { ...object, text: fillMergeTokens(object.text, row) } : object.type === 'link' ? { ...object, label: fillMergeTokens(object.label, row), url: fillMergeTokens(object.url, row) } : object.type === 'form' ? { ...object, label: fillMergeTokens(object.label, row), value: fillMergeTokens(object.value, row) } : object);
}

export async function exportMailMerge(document: OpenDocument, objects: EditorObject[], settings: PageSettings, rows: MergeRow[]): Promise<Array<{ name: string; bytes: Uint8Array }>> {
  return Promise.all(rows.map(async (row, index) => ({ name: `${document.name.replace(/\.pdf$/i, '')}-${row.name || row.Name || index + 1}.pdf`, bytes: await exportPdf(document, mergeObjects(objects, row), settings) })));
}
