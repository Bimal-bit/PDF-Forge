import type { TextObject, LocalFontFace } from '../types';
import { ocrAppearanceKey } from './ocrAppearance';

export interface OcrLine {
  id: string;
  page: number;
  text: string;
  confidence: number;
  x: number;
  y: number;
  width: number;
  height: number;
  originalText?: string;
  baseline?: number;
  fontFamily?: string;
  fontFace?: LocalFontFace;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  horizontalScale?: number;
  color?: string;
  background?: string;
  reference?: string;
  referenceScale?: number;
  fontOptions?: { fontFamily: string; bold: boolean; italic: boolean; fontSize: number; horizontalScale: number; score: number }[];
}

export function editableOcrObjects(
  lines: OcrLine[],
  measure: (text: string) => number,
): TextObject[] {
  return lines
    .filter((line) => line.text.trim())
    .map((line) => {
      const size =
        line.fontSize ??
        Math.max(
          4,
          Math.min(72, line.height * 1.15, line.width / Math.max(0.01, measure(line.text))),
        );
      const object: TextObject = {
        id: line.id,
        type: 'text',
        page: line.page,
        text: line.text.trim(),
        x: line.x,
        y: line.baseline ?? line.y - size * 0.2,
        width: line.width + 2,
        fontSize: size,
        fontFamily: line.fontFamily ?? 'Noto Sans',
        fontFace: line.fontFace,
        bold: line.bold,
        italic: line.italic,
        color: line.color ?? '#111111',
        sourceLayout:
          line.baseline === undefined
            ? undefined
            : {
                baselineOffset: 0,
                ascent: 0.8,
                horizontalScale: line.horizontalScale ?? 1,
                rotation: 0,
                fontFamily: line.fontFamily ?? 'Noto Sans',
                bold: Boolean(line.bold),
                italic: Boolean(line.italic),
              },
        lineHeight: 1.2,
        cover: {
          x: line.x,
          y: line.y,
          width: line.width + 4,
          height: line.height + 4,
          color: line.background ?? '#ffffff',
        },
      };
      if (line.originalText !== undefined)
        object.ocr = { text: line.originalText, appearance: ocrAppearanceKey(object) };
      return object;
    });
}
