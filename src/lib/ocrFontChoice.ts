import type { OcrLine } from './ocrText';
import type { LocalFontFace, TextObject } from '../types';
import { prepareTextFont, textFontCss } from './textFonts';
import { standardFamilies } from './fontNames';

export function ocrFontObject(line: OcrLine): TextObject {
  return {
    id: line.id,
    type: 'text',
    page: line.page,
    x: line.x,
    y: line.baseline ?? line.y,
    text: line.originalText ?? line.text,
    fontSize: line.fontSize ?? 12,
    fontFamily: line.fontFamily ?? 'Helvetica',
    fontFace: line.fontFace,
    bold: line.bold,
    italic: line.italic,
    color: line.color ?? '#111111',
  };
}

export async function chooseOcrFont(
  line: OcrLine,
  family: string,
  bold: boolean,
  italic: boolean,
  face?: LocalFontFace,
): Promise<Partial<OcrLine>> {
  const object = { ...ocrFontObject(line), fontFamily: family, fontFace: face, bold, italic };
  const loaded = await prepareTextFont(object);
  if (!loaded && !standardFamilies.some((standard) => standard === family))
    throw new Error(
      `Import the ${bold ? 'bold' : 'regular'}${italic ? ' italic' : ''} face of ${family}, or choose a bundled font.`,
    );
  const context = document.createElement('canvas').getContext('2d')!;
  context.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}100px ${textFontCss(object)}`;
  context.fontKerning = 'none';
  const metrics = context.measureText(object.text);
  const fontSize =
    (line.height * 100) /
    Math.max(1, metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent);
  return {
    fontFamily: family,
    fontFace: face,
    bold,
    italic,
    fontSize,
    horizontalScale: line.width / Math.max(1, (metrics.width * fontSize) / 100),
  };
}
