import { StandardFonts, type PDFFont, type PDFPage, rgb, pushGraphicsState, popGraphicsState, concatTransformationMatrix } from 'pdf-lib';
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

export function blockTextGeometry(object: TextObject, measure: (value: string) => number) {
  const lines = textLines(object, measure);
  const size = object.fontSize;
  const leading = size * (object.lineHeight ?? 1.2);
  const coverHeight = object.height ?? object.cover?.height ?? (object.width ? lines.length * leading : undefined);
  const baseline = coverHeight ? object.y + coverHeight - size : object.y;
  return {
    height: coverHeight ?? Math.max(leading, lines.length * leading),
    lines: lines.map((text, index) => {
      const width = measure(text);
      const available = Math.max(1, (object.width ?? object.cover?.width ?? width) - (object.indent ?? 0));
      let x = object.x + (object.indent ?? 0);
      if (object.alignment === 'center') x += (available - width) / 2;
      if (object.alignment === 'right') x += available - width;
      const justify = object.alignment === 'justify' && index < lines.length - 1 && text.includes(' ');
      const wordSpacing = justify ? Math.max(0, available - width) / (text.split(' ').length - 1) : 0;
      return { text, x, y: baseline - index * leading, width: justify ? available : width, wordSpacing };
    }),
  };
}

export function drawTextBlock(page: PDFPage, object: TextObject, font: PDFFont) {
  if(object.sourceLayout){
    const source=object.sourceLayout;
    const angle=source.rotation*Math.PI/180;
    page.pushOperators(pushGraphicsState(),concatTransformationMatrix(Math.cos(angle)*source.horizontalScale,Math.sin(angle)*source.horizontalScale,-Math.sin(angle),Math.cos(angle),object.x,object.y+source.baselineOffset));
    drawTextBlock(page,{...object,x:0,y:0,width:undefined,height:undefined,cover:undefined,sourceLayout:undefined,alignment:'left',indent:0,list:'none'},font);
    page.pushOperators(popGraphicsState());
    return;
  }
  const spacing = object.letterSpacing ?? 0;
  const measure = (value: string) => Array.from(value).reduce((sum, character) => sum + font.widthOfTextAtSize(character, object.fontSize), 0) + Math.max(0, Array.from(value).length - 1) * spacing;
  const geometry = blockTextGeometry(object, measure);
  const size = object.fontSize;
  const color = object.color.replace('#', '');
  const value = Number.parseInt(color.length === 3 ? color.split('').map((part) => part + part).join('') : color, 16);
  const ink = rgb(((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255);
  geometry.lines.forEach(({ text: line, x, y, width, wordSpacing: extra }) => {
    if (spacing || extra) {
      let cursor = x;
      for (const character of line) {
        page.drawText(character, { x: cursor, y, size, font, color: ink });
        cursor += font.widthOfTextAtSize(character, size) + spacing + (character === ' ' ? extra : 0);
      }
    } else page.drawText(line, { x, y, size, font, color: ink });
    for (const offset of [object.underline ? -size * .12 : undefined, object.strike ? size * .3 : undefined]) {
      if (offset !== undefined) page.drawLine({ start: { x, y: y + offset }, end: { x: x + width, y: y + offset }, thickness: Math.max(.5, size / 18), color: ink });
    }
  });
}
