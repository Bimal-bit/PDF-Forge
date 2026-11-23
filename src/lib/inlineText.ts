import type { CSSProperties } from 'react';
import type { TextObject } from '../types';
import { textFontCss } from './textFonts';
import { encodeSourceText } from './sourceFontResource';

let context: CanvasRenderingContext2D | null | undefined;
export function inlineTextStyle(object: TextObject, zoom: number): CSSProperties {
  const scale = zoom / 100;
  const source = object.sourceLayout;
  const family = textFontCss(object);
  const lineHeight = object.fontSize * (object.lineHeight ?? 1.2);
  context ??=
    typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  let baselineFromTop = source ? source.ascent * object.fontSize : object.fontSize;
  let widthScale = 1;
  if (context) {
    context.font = `${object.italic ? 'italic' : 'normal'} ${object.bold ? 'bold' : 'normal'} ${object.fontSize}px ${family}`;
    context.fontKerning = 'none';
    const metrics = context.measureText(object.sourceText ?? object.text);
    const ascent = metrics.fontBoundingBoxAscent ?? object.fontSize * 0.8;
    const descent = metrics.fontBoundingBoxDescent ?? object.fontSize * 0.2;
    baselineFromTop = (lineHeight - ascent - descent) / 2 + ascent;
    const codes = encodeSourceText(object, object.sourceText ?? object.text);
    const sourceWidth = codes?.reduce(
      (sum, glyph) => sum + (glyph.width * object.fontSize) / 1000,
      0,
    );
    if (sourceWidth && metrics.width) widthScale = sourceWidth / metrics.width;
  }
  const bottom = source
    ? object.y + source.baselineOffset - (lineHeight - baselineFromTop)
    : object.y + baselineFromTop - object.fontSize;
  const horizontalScale = source ? source.horizontalScale * widthScale : 1;
  return {
    position: 'absolute',
    left: object.x * scale,
    bottom: bottom * scale,
    width: source ? 'max-content' : (object.width ?? object.cover?.width ?? 300) * scale,
    minWidth: 1,
    height:
      !source && (object.height ?? object.cover?.height) !== undefined
        ? (object.height ?? object.cover!.height) * scale
        : undefined,
    minHeight:
      (source ? lineHeight : (object.height ?? object.cover?.height ?? lineHeight)) * scale,
    fontFamily: family,
    fontSize: object.fontSize * scale,
    fontWeight: object.bold ? 'bold' : 'normal',
    fontStyle: object.italic ? 'italic' : 'normal',
    color: object.color,
    caretColor: object.color,
    lineHeight: object.lineHeight ?? 1.2,
    fontKerning: 'none',
    fontVariantLigatures: 'none',
    letterSpacing: ((object.letterSpacing ?? 0) * scale) / widthScale,
    wordSpacing: ((source?.wordSpacing ?? 0) * scale) / widthScale,
    textDecoration: [object.underline ? 'underline' : '', object.strike ? 'line-through' : ''].join(
      ' ',
    ),
    textUnderlineOffset: source?.underline ? -source.underline.offset * scale : undefined,
    textDecorationThickness: source?.underline ? source.underline.thickness * scale : undefined,
    textAlign: source ? 'left' : object.alignment,
    paddingLeft: source ? 0 : (object.indent ?? 0) * scale,
    whiteSpace: source ? 'pre' : 'pre-wrap',
    transform: source ? `rotate(${-source.rotation}deg) scaleX(${horizontalScale})` : undefined,
    transformOrigin: `0 ${baselineFromTop * scale}px`,
    pointerEvents: 'auto',
  };
}

export function coverStyle(object: TextObject, zoom: number): CSSProperties | undefined {
  if (!object.cover) return;
  const scale = zoom / 100;
  return {
    position: 'absolute',
    left: ((object.cover.x ?? object.x) - 2) * scale,
    bottom: ((object.cover.y ?? object.y) - 2) * scale,
    width: object.cover.width * scale,
    height: object.cover.height * scale,
    background: object.cover.color ?? 'white',
    transform: object.cover.rotation ? `rotate(${-object.cover.rotation}deg)` : undefined,
    transformOrigin: 'bottom left',
    pointerEvents: 'none',
  };
}
