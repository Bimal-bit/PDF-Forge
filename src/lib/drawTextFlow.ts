import { type PDFFont, type PDFPage } from 'pdf-lib';
import type { TextObject } from '../types';
import type { FlowLine, TextFrameLayout } from './textFlow';
import { pdfColor } from './color';

export function flowLineX(object: TextObject, line: FlowLine) {
  if (object.alignment === 'center') return line.x + (line.available - line.width) / 2;
  if (object.alignment === 'right') return line.x + line.available - line.width;
  return line.x;
}

export function drawTextFlow(
  page: PDFPage,
  object: TextObject,
  layout: TextFrameLayout,
  font: PDFFont,
) {
  const ink = pdfColor(object.color);
  for (const line of layout.lines) {
    const x = object.x + flowLineX(object, line);
    const y = object.y + layout.height - line.y;
    const spaces = line.text.split(' ').length - 1;
    const justify = object.alignment === 'justify' && !line.paragraphEnd && spaces > 0;
    const extra = justify ? Math.max(0, line.available - line.width) / spaces : 0;
    const spacing = object.letterSpacing ?? 0;
    if (spacing || justify) {
      let cursor = x;
      for (const character of line.text) {
        page.drawText(character, { x: cursor, y, size: line.fontSize, font, color: ink });
        cursor +=
          font.widthOfTextAtSize(character, line.fontSize) +
          spacing +
          (character === ' ' ? extra : 0);
      }
    } else if (line.text) page.drawText(line.text, { x, y, size: line.fontSize, font, color: ink });
    for (const offset of [
      object.underline ? -line.fontSize * 0.12 : undefined,
      object.strike ? line.fontSize * 0.3 : undefined,
    ]) {
      if (offset !== undefined)
        page.drawLine({
          start: { x, y: y + offset },
          end: { x: x + (justify ? line.available : line.width), y: y + offset },
          thickness: Math.max(0.5, line.fontSize / 18),
          color: ink,
        });
    }
  }
}
