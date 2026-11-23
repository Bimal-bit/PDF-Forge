import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextItem, TextStyle } from 'pdfjs-dist/types/src/display/api';
import type { EditorObject, TextObject } from '../types';
import { visibleSourceItems } from './pageText';
import { pdfTextAppearance } from './smartTextMatch';

export function sourceTextObject(
  page: PDFPageProxy,
  items: TextItem[],
  selected: number,
  styles: Record<string, TextStyle>,
  objects: EditorObject[],
): TextObject | undefined {
  const target = items[selected];
  const visible = visibleSourceItems(items, objects);
  if (
    !target?.str.trim() ||
    !visible.some(
      (item) =>
        item === target ||
        (item.str === target.str &&
          item.fontName === target.fontName &&
          Math.abs(item.transform[4] - target.transform[4]) < 0.01 &&
          Math.abs(item.transform[5] - target.transform[5]) < 0.01),
    )
  )
    return;
  const fontSize = Math.hypot(target.transform[2], target.transform[3]) || target.height;
  const style = styles[target.fontName];
  const ascent = style?.ascent ?? 0.8;
  const descent = style?.descent ?? -0.2;
  const x = target.transform[4],
    baseline = target.transform[5];
  const rotation = (Math.atan2(target.transform[1], target.transform[0]) * 180) / Math.PI;
  const angle = (rotation * Math.PI) / 180;
  const appearance = pdfTextAppearance(page, target, styles);
  const height = (ascent - descent) * fontSize;
  return {
    id: crypto.randomUUID(),
    type: 'text',
    page: page.pageNumber,
    text: target.str,
    sourceText: target.str,
    x,
    y: baseline + descent * fontSize,
    width: target.width,
    height,
    fontSize,
    color: '#000000',
    ...appearance,
    sourceLayout: {
      baselineOffset: -descent * fontSize,
      ascent,
      horizontalScale: Math.hypot(target.transform[0], target.transform[1]) / fontSize,
      rotation,
      fontFamily: appearance.fontFamily,
      bold: appearance.bold,
      italic: appearance.italic,
    },
    cover: {
      x: x - Math.sin(angle) * descent * fontSize + 2,
      y: baseline + Math.cos(angle) * descent * fontSize + 2,
      width: target.width,
      height,
      rotation,
    },
  };
}
