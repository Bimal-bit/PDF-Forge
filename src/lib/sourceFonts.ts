import { OPS, type PDFPageProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { LocalFontFace, TextObject, OpenDocument } from '../types';
import { replaceFontCmap } from './fontCmap';
import { importFontFace, prepareTextFont } from './textFonts';
import { textTypography } from './sourceTypography';
import { attachSourceFontResource } from './sourceFontResource';

interface PdfGlyph {
  unicode: string;
  fontChar: string;
}
const extracted = new WeakMap<PDFPageProxy, Map<string, Promise<LocalFontFace | undefined>>>();

async function extractFace(page: PDFPageProxy, item: TextItem): Promise<LocalFontFace | undefined> {
  const operators = await page.getOperatorList();
  const source = page.commonObjs.get(item.fontName) as { data?: Uint8Array; name?: string };
  if (!source.data?.length) return;
  const { default: fontkit } = await import('@pdf-lib/fontkit');
  const font = fontkit.create(source.data);
  const glyphs = new Map(
    font.characterSet.map((point) => [point, font.glyphForCodePoint(point).id]),
  );
  let currentFont = '';
  const fontStack: string[] = [];
  for (let index = 0; index < operators.fnArray.length; index += 1) {
    const operation = operators.fnArray[index];
    const args = operators.argsArray[index] as unknown[];
    if (operation === OPS.save) fontStack.push(currentFont);
    if (operation === OPS.restore) currentFont = fontStack.pop() ?? '';
    if (operation === OPS.setFont) currentFont = args[0] as string;
    if (operation !== OPS.showText || currentFont !== item.fontName) continue;
    for (const glyph of args[0] as (PdfGlyph | number)[]) {
      if (typeof glyph === 'number' || Array.from(glyph.unicode).length !== 1) continue;
      const id = font.glyphForCodePoint(glyph.fontChar.codePointAt(0)!).id;
      if (id) glyphs.set(glyph.unicode.codePointAt(0)!, id);
    }
  }
  return importFontFace(replaceFontCmap(source.data, glyphs), source.name);
}

export async function preserveSourceFont(
  page: PDFPageProxy,
  item: TextItem,
  object: TextObject,
  document?: OpenDocument,
): Promise<TextObject> {
  let fonts = extracted.get(page);
  if (!fonts) {
    fonts = new Map();
    extracted.set(page, fonts);
  }
  let task = fonts.get(item.fontName);
  if (!task) {
    task = extractFace(page, item).catch((error: unknown) => {
      fonts.delete(item.fontName);
      throw error;
    });
    fonts.set(item.fontName, task);
  }
  const face = await task;
  const bold = Boolean(object.bold || face?.bold);
  const italic = Boolean(object.italic || face?.italic);
  let result = face
    ? {
        ...object,
        bold,
        italic,
        fontFamily: face.family,
        fontFace: { ...face, bold, italic },
        fallback: false,
      }
    : object;
  if (object.sourceLayout) {
    const typography = await textTypography(page, item);
    const font = page.commonObjs.get(item.fontName) as {
      name?: string;
      systemFontInfo?: { css?: string };
      fallbackName?: string;
    };
    if (typography) {
      result = {
        ...result,
        color: typography.color,
        letterSpacing: typography.charSpacing,
        underline: Boolean(typography.underline),
        strike: Boolean(typography.strike),
        sourceLayout: {
          ...object.sourceLayout,
          horizontalScale: typography.horizontalScale,
          rotation: typography.rotation,
          fontFamily: result.fontFamily ?? object.sourceLayout.fontFamily,
          bold,
          italic,
          cssFamily:
            font.systemFontInfo?.css ?? `"${font.name}", ${font.fallbackName ?? 'sans-serif'}`,
          wordSpacing: typography.wordSpacing,
          underline: typography.underline,
          strike: typography.strike,
        },
      };
    }
    if (document) result = await attachSourceFontResource(document, page, item.fontName, result);
  }
  await prepareTextFont(result);
  return result;
}
