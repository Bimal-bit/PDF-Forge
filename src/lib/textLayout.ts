import { StandardFonts, type PDFFont, type PDFPage, rgb } from 'pdf-lib';
import type { TextObject } from '../types';

export function standardFontName(object: TextObject): StandardFonts {
  if (object.fontFamily === 'Courier') {
    if (object.bold && object.italic) return StandardFonts.CourierBoldOblique;
    if (object.bold) return StandardFonts.CourierBold;
    return object.italic ? StandardFonts.CourierOblique : StandardFonts.Courier;
  }
  if (object.fontFamily === 'Times-Roman') {
    if (object.bold && object.italic) return StandardFonts.TimesRomanBoldItalic;
    if (object.bold) return StandardFonts.TimesRomanBold;
    return object.italic ? StandardFonts.TimesRomanItalic : StandardFonts.TimesRoman;
  }
  if (object.bold && object.italic) return StandardFonts.HelveticaBoldOblique;
  if (object.bold) return StandardFonts.HelveticaBold;
  return object.italic ? StandardFonts.HelveticaOblique : StandardFonts.Helvetica;
}

export function wrapText(text: string, width: number, measure: (value: string) => number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split(/\r?\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= width) { line = candidate; continue; }
      if (line) lines.push(line);
      line = '';
      for (const character of word) {
        if (line && measure(line + character) > width) { lines.push(line); line = ''; }
        line += character;
      }
    }
    lines.push(line);
  }
  return lines;
}

export function textLines(object: TextObject, measure: (value: string) => number): string[] {
  const prefix = (line: string, index: number) => object.list === 'bullet' ? `• ${line}` : object.list === 'number' ? `${index + 1}. ${line}` : line;
  const content = object.text.split(/\r?\n/).map(prefix).join('\n');
  const width = object.width ?? object.cover?.width;
  return width ? wrapText(content, Math.max(1, width - (object.indent ?? 0)), measure) : content.split('\n');
}

export function drawTextBlock(page: PDFPage, object: TextObject, font: PDFFont) {
  const spacing = object.letterSpacing ?? 0;
  const measure = (value: string) => font.widthOfTextAtSize(value, object.fontSize) + Math.max(0, value.length - 1) * spacing;
  const lines = textLines(object, measure);
  const size = object.fontSize;
  const lineHeight = size * (object.lineHeight ?? 1.2);
  const coverHeight = object.height ?? object.cover?.height ?? (object.width ? lines.length * lineHeight : undefined);
  const baseline = coverHeight ? object.y + coverHeight - size : object.y;
  const color = object.color.replace('#', '');
  const value = Number.parseInt(color.length === 3 ? color.split('').map((part) => part + part).join('') : color, 16);
  const ink = rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
  lines.forEach((line, index) => {
    const width = measure(line);
    const available = (object.width ?? object.cover?.width ?? width) - (object.indent ?? 0);
    let x = object.x + (object.indent ?? 0);
    if (object.alignment === 'center') x += (available - width) / 2;
    if (object.alignment === 'right') x += available - width;
    const y = baseline - index * lineHeight;
    const justify = object.alignment === 'justify' && index < lines.length - 1 && line.includes(' ');
    const extra = justify ? Math.max(0, available - width) / (line.split(' ').length - 1) : 0;
    if (spacing || justify) {
      let cursor = x;
      for (const character of line) {
        page.drawText(character, { x: cursor, y, size, font, color: ink });
        cursor += font.widthOfTextAtSize(character, size) + spacing + (character === ' ' ? extra : 0);
      }
    } else page.drawText(line, { x, y, size, font, color: ink });
    for (const offset of [object.underline ? -size * .12 : undefined, object.strike ? size * .3 : undefined]) {
      if (offset !== undefined) page.drawLine({ start: { x, y: y + offset }, end: { x: x + (justify ? available : width), y: y + offset }, thickness: Math.max(.5, size / 18), color: ink });
    }
  });
}
