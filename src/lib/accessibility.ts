import type { EditorObject, OpenDocument, PageSettings } from '../types';
import { editedTextPages } from './conversion';

export interface AccessibilityIssue { severity: 'error' | 'warning' | 'info'; message: string }
export interface AccessibilityReport { pages: number; words: number; issues: AccessibilityIssue[] }

export async function checkAccessibility(document: OpenDocument, objects: EditorObject[], settings: PageSettings = { order: [], rotations: {}, header: '', footer: '', watermark: '', batesStart: null }): Promise<AccessibilityReport> {
  const pages = await editedTextPages(document, objects, settings);
  const visibleObjects = objects.filter((object) => !settings.order.length || settings.order.includes(object.page));
  const issues: AccessibilityIssue[] = [];
  const words = pages.join(' ').trim().split(/\s+/).filter(Boolean).length;
  if (!words) issues.push({ severity: 'error', message: 'No selectable text was found. This may be a scanned PDF and needs offline OCR before it can be checked.' });
  if (pages.some((page) => !page.trim())) issues.push({ severity: 'warning', message: 'One or more pages have no selectable text.' });
  if (visibleObjects.some((object) => object.type === 'image')) issues.push({ severity: 'warning', message: 'Inserted images do not yet carry alternative text in PDFForge exports.' });
  if (visibleObjects.some((object) => object.type === 'table' && object.cells.some((row) => row.some((cell) => !cell.trim())))) issues.push({ severity: 'warning', message: 'An inserted table has empty cells; review its headers and reading order.' });
  if (!issues.length) issues.push({ severity: 'info', message: 'No issues were found in the available text and PDFForge object layer. Check visual reading order manually.' });
  return { pages: pages.length, words, issues };
}

export function localDocumentInsight(pages: string[]): string {
  const text = pages.join(' ').replace(/\s+/g, ' ').trim();
  if (!text) return 'No selectable document text is available. This panel does not send your document anywhere.';
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  const ignored = new Set(['the', 'and', 'for', 'that', 'with', 'this', 'from', 'are', 'was', 'have', 'has', 'not', 'you', 'your']);
  const counts = new Map<string, number>();
  for (const word of text.toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []) if (!ignored.has(word)) counts.set(word, (counts.get(word) ?? 0) + 1);
  const topics = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([word]) => word);
  return `${sentences.slice(0, 2).join(' ').trim()}${topics.length ? ` Key terms: ${topics.join(', ')}.` : ''}`;
}
