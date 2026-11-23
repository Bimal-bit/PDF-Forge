import { StandardFontEmbedder, type PDFFont, type PDFDocument, type PDFPage, rgb } from 'pdf-lib';
import type { Font } from '@pdf-lib/fontkit';
import type { TableObject } from '../types';
import { unicodeFontBytes } from './fonts';
import { wrapText } from './textLayout';

export interface TableMetrics {
  family: string;
  measure: (text: string, size: number) => number;
  supports: (text: string) => boolean;
}
let unicode: TableMetrics | undefined;
let loading: Promise<TableMetrics> | undefined;
const standard = StandardFontEmbedder.for(
  'Helvetica' as Parameters<typeof StandardFontEmbedder.for>[0],
);
const legacy: TableMetrics = {
  family: 'Helvetica, Arial, sans-serif',
  measure: (text, size) =>
    Array.from(text).reduce((sum, character) => {
      try {
        return sum + standard.widthOfTextAtSize(character, size);
      } catch {
        return sum + size * 0.6;
      }
    }, 0),
  supports: (text) => {
    try {
      standard.encodeText(text.replace(/[\r\n]/g, ''));
      return true;
    } catch {
      return false;
    }
  },
};

export function currentTableMetrics(object: Pick<TableObject, 'fontFamily'>): TableMetrics {
  return object.fontFamily === 'Noto Sans' ? (unicode ?? legacy) : legacy;
}
export function prepareTableMetrics(): Promise<TableMetrics> {
  if (unicode) return Promise.resolve(unicode);
  loading ??= (async () => {
    const [{ default: fontkit }, bytes] = await Promise.all([
      import('@pdf-lib/fontkit'),
      unicodeFontBytes(),
    ]);
    const font: Font = fontkit.create(new Uint8Array(bytes));
    if (globalThis.document?.fonts) {
      const face = new FontFace('PDFForgeTable', bytes.slice(0));
      await face.load();
      document.fonts.add(face);
    }
    unicode = {
      family: 'PDFForgeTable, sans-serif',
      measure: (text, size) =>
        Array.from(text).reduce(
          (sum, character) =>
            sum +
            (font.glyphForCodePoint(character.codePointAt(0)!).advanceWidth * size) /
              font.unitsPerEm,
          0,
        ),
      supports: (text) =>
        Array.from(text.replace(/[\r\n]/g, '')).every((character) =>
          font.hasGlyphForCodePoint(character.codePointAt(0)!),
        ),
    };
    return unicode;
  })().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

export function tableLayout(object: TableObject, metrics: TableMetrics) {
  const rows = object.cells.length,
    columns = object.cells[0]?.length ?? 0;
  if (!rows || !columns || object.cells.some((row) => row.length !== columns))
    throw new Error('A table needs a rectangular grid with at least one cell.');
  if (
    !Number.isFinite(object.width) ||
    !Number.isFinite(object.height) ||
    object.width < 20 ||
    object.height < 20
  )
    throw new Error('Increase the table width and height.');
  const rowHeight = object.height / rows,
    columnWidth = object.width / columns;
  const cells = object.cells.flatMap((row, rowIndex) =>
    row.map((text, columnIndex) => {
      if (!metrics.supports(text))
        throw new Error(
          `Cell ${rowIndex + 1}:${columnIndex + 1} contains characters unavailable in the table font.`,
        );
      let size = 10;
      let lines = wrapText(text, Math.max(1, columnWidth - 10), (value) =>
        metrics.measure(value, size),
      );
      while (
        size > 6 &&
        (lines.length * size * 1.2 > rowHeight - 8 ||
          lines.some((line) => metrics.measure(line, size) > columnWidth - 10 + 0.1))
      ) {
        size -= 1;
        lines = wrapText(text, Math.max(1, columnWidth - 10), (value) =>
          metrics.measure(value, size),
        );
      }
      if (
        lines.length * size * 1.2 > rowHeight - 8 ||
        lines.some((line) => metrics.measure(line, size) > columnWidth - 10 + 0.1)
      )
        throw new Error(
          `Cell ${rowIndex + 1}:${columnIndex + 1} needs more space. Enlarge the table or shorten its text.`,
        );
      return {
        row: rowIndex,
        column: columnIndex,
        text,
        lines,
        size,
        width: columnWidth,
        height: rowHeight,
        x: columnIndex * columnWidth,
        top: rowIndex * rowHeight,
        header: Boolean(object.headerRow && rowIndex === 0),
      };
    }),
  );
  return { rows, columns, cells };
}

export async function insertUnicodeFont(pdf: PDFDocument, fonts: Map<string, PDFFont>) {
  const existing = fonts.get('PDFForgeTable');
  if (existing) return existing;
  const { default: fontkit } = await import('@pdf-lib/fontkit');
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await unicodeFontBytes(), {
    subset: true,
    features: { kern: false, liga: false, clig: false },
  });
  fonts.set('PDFForgeTable', font);
  return font;
}

export async function drawTable(
  pdf: PDFDocument,
  page: PDFPage,
  object: TableObject,
  defaultFont: PDFFont,
  fonts: Map<string, PDFFont>,
) {
  let font = defaultFont;
  let metrics = legacy;
  if (object.fontFamily === 'Noto Sans') {
    metrics = await prepareTableMetrics();
    font = await insertUnicodeFont(pdf, fonts);
  }
  const layout = tableLayout(object, metrics);
  for (const cell of layout.cells) {
    const x = object.x + cell.x,
      y = object.y + object.height - cell.top - cell.height;
    page.drawRectangle({
      x,
      y,
      width: cell.width,
      height: cell.height,
      color: cell.header ? rgb(0.941, 0.933, 0.984) : rgb(1, 1, 1),
      borderColor: rgb(0.65, 0.63, 0.7),
      borderWidth: 0.6,
    });
    cell.lines.forEach((line, index) => {
      if (line)
        page.drawText(line, {
          x: x + 5,
          y: y + cell.height - 5 - cell.size - index * cell.size * 1.2,
          size: cell.size,
          font,
          color: rgb(0.16, 0.15, 0.14),
        });
    });
  }
}
