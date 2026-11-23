import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextItem, TextStyle } from 'pdfjs-dist/types/src/display/api';
import type { EditorObject, OpenDocument, PageSettings, TextObject } from '../types';
import { matchPdfFont } from './font';
import { openPdf } from './pdf';
import { paragraphAt } from './paragraphs';
import { visibleSourceItems } from './pageText';
import { catalogFont, fontIdentity, originalFontFamily } from './fontNames';
import { preserveSourceFont } from './sourceFonts';

export function pdfTextAppearance(
  page: PDFPageProxy,
  item: TextItem,
  styles: Record<string, TextStyle>,
) {
  const font = page.commonObjs.has(item.fontName)
    ? (page.commonObjs.get(item.fontName) as {
        fallbackName?: string;
        data?: Uint8Array;
        name?: string;
        cssFontInfo?: { fontFamily?: string; fontWeight?: string; italicAngle?: string };
        bold?: boolean;
        black?: boolean;
        italic?: boolean;
      })
    : undefined;
  const name = font?.name ?? font?.cssFontInfo?.fontFamily ?? font?.fallbackName ?? styles[item.fontName]?.fontFamily ?? '';
  const match = matchPdfFont(name);
  const catalog = catalogFont(name);
  return {
    fontFamily: catalog?.family ?? (font?.data?.length ? originalFontFamily(name) : match.family),
    sourceFontName: name,
    fallback: !catalog && !/^(Helvetica|Times|Courier)(?:-|$)/i.test(name),
    bold: Boolean(font?.bold || font?.black || /bold|black|heavy|demi/i.test(name) || Number(font?.cssFontInfo?.fontWeight) >= 600),
    italic: Boolean(font?.italic || /italic|oblique/i.test(name) || Number(font?.cssFontInfo?.italicAngle || 0)),
  };
}

export function hasSimilarFont(
  seed: TextObject,
  candidate: Pick<TextObject, 'fontFamily' | 'fontSize' | 'bold' | 'italic'>,
): boolean {
  return (
    fontIdentity(seed.fontFamily ?? 'Helvetica') ===
      fontIdentity(candidate.fontFamily ?? 'Helvetica') &&
    Boolean(seed.bold) === Boolean(candidate.bold) &&
    Boolean(seed.italic) === Boolean(candidate.italic) &&
    Math.abs(seed.fontSize - candidate.fontSize) <= Math.max(0.5, seed.fontSize * 0.05)
  );
}

export function matchingPageBlocks(
  page: number,
  items: TextItem[],
  seed: TextObject,
  objects: EditorObject[],
  appearance: (item: TextItem) => Pick<TextObject, 'fontFamily' | 'fallback' | 'bold' | 'italic'>,
): TextObject[] {
  const visible = visibleSourceItems(items, objects);
  const candidates = visible.filter(
    (item) =>
      item.str.trim() &&
      item.dir !== 'ttb' &&
      item.transform[0] > 0 &&
      item.transform[3] > 0 &&
      Math.abs(item.transform[1]) < 0.01 &&
      Math.abs(item.transform[2]) < 0.01 &&
      hasSimilarFont(seed, { ...appearance(item), fontSize: item.height }),
  );
  const candidateSet = new Set(candidates);
  const unmatched = visible.filter((item) => item.str.trim() && !candidateSet.has(item));
  const blocks: TextObject[] = [];
  let remaining = candidates;
  while (remaining.length) {
    const item = remaining[0];
    const paragraph = paragraphAt(remaining, 0);
    const overlapsUnmatched = unmatched.some(
      (run) =>
        run.transform[4] < paragraph.x + paragraph.width - 2 &&
        run.transform[4] + run.width > paragraph.x - 2 &&
        run.transform[5] - run.height * 0.2 < paragraph.y + paragraph.height - 2 &&
        run.transform[5] + run.height * 0.8 > paragraph.y - 2,
    );
    if (!overlapsUnmatched)
      blocks.push({
        id: crypto.randomUUID(),
        type: 'text',
        page,
        ...paragraph,
        ...appearance(item),
        color: '#292724',
        cover: { width: paragraph.width, height: paragraph.height },
      });
    remaining = remaining.filter(
      (run, index) =>
        index > 0 &&
        !(
          run.transform[4] >= paragraph.x &&
          run.transform[4] <= paragraph.x + paragraph.width &&
          run.transform[5] >= paragraph.y &&
          run.transform[5] <= paragraph.y + paragraph.height
        ),
    );
  }
  return blocks;
}

export async function findSimilarText(
  document: OpenDocument,
  seed: TextObject,
  objects: EditorObject[],
  settings: PageSettings,
  signal: AbortSignal,
) {
  const pdf = await openPdf(document);
  const additions: TextObject[] = [];
  const order = settings.order.length
    ? settings.order
    : Array.from({ length: pdf.numPages }, (_, index) => index + 1);
  const pages = new Set(order);
  const ids = objects
    .filter(
      (object): object is TextObject =>
        object.type === 'text' && pages.has(object.page) && hasSimilarFont(seed, object),
    )
    .map((object) => object.id);
  try {
    for (const pageNumber of pages) {
      signal.throwIfAborted();
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      await page.getOperatorList();
      const items = content.items.filter((item): item is TextItem => 'str' in item);
      const blocks = matchingPageBlocks(
          pageNumber,
          items,
          seed,
          objects.filter((object) => object.page === pageNumber),
          (item) => pdfTextAppearance(page, item, content.styles),
        );
      for (const block of blocks) {
        const item = items.find((run) => run.str.trim() && run.transform[4] >= block.x && run.transform[4] <= block.x + (block.width ?? 0) && run.transform[5] >= block.y && run.transform[5] <= block.y + (block.height ?? 0) && hasSimilarFont(block, { ...pdfTextAppearance(page, run, content.styles), fontSize: run.height }));
        additions.push(item ? await preserveSourceFont(page, item, block,document) : block);
      }
    }
    signal.throwIfAborted();
    return { ids: [...ids, ...additions.map((object) => object.id)], additions };
  } finally {
    await pdf.loadingTask.destroy();
  }
}
