import type { PDFPageProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { SourceTextLayout } from '../types';
import { pageTypography, type PaintedText } from './sourceTypography';

export function paintedTextItem(
  run: Pick<PaintedText, 'text' | 'x' | 'y' | 'width' | 'size' | 'horizontalScale' | 'rotation'>,
  fontName: string,
): TextItem {
  const angle = (run.rotation * Math.PI) / 180,
    cosine = Math.cos(angle),
    sine = Math.sin(angle);
  return {
    str: run.text,
    dir: 'ltr',
    width: run.width,
    height: run.size,
    fontName,
    hasEOL: false,
    transform: [
      cosine * run.size * run.horizontalScale,
      sine * run.size * run.horizontalScale,
      -sine * run.size,
      cosine * run.size,
      run.x,
      run.y,
    ],
  };
}

export async function sourceRunAtPoint(page: PDFPageProxy, item: TextItem, point?: number[]) {
  const { runs } = await pageTypography(page);
  const angle = Math.atan2(item.transform[1], item.transform[0]),
    cosine = Math.cos(angle),
    sine = Math.sin(angle);
  const along = (run: PaintedText) =>
    (run.x - item.transform[4]) * cosine + (run.y - item.transform[5]) * sine;
  const across = (run: PaintedText) =>
    -(run.x - item.transform[4]) * sine + (run.y - item.transform[5]) * cosine;
  const candidates = runs.filter(
    (run) =>
      run.font === item.fontName &&
      Math.abs(across(run)) < Math.max(1, item.height * 0.25) &&
      along(run) >= -0.5 &&
      along(run) < item.width + 0.1,
  );
  if (!candidates.length) return { item };
  const target = point ?? [item.transform[4], item.transform[5]];
  const distance = (run: PaintedText) => {
    const radians = (run.rotation * Math.PI) / 180;
    const x = (target[0] - run.x) * Math.cos(radians) + (target[1] - run.y) * Math.sin(radians);
    const y = -(target[0] - run.x) * Math.sin(radians) + (target[1] - run.y) * Math.cos(radians);
    return Math.abs(y) + Math.max(0, -x, x - run.width) * 10;
  };
  const run = [...candidates].sort((a, b) => distance(a) - distance(b))[0];
  const splitItems: SourceTextLayout['splitItems'] = {
    fontName: item.fontName,
    text: item.str,
    x: item.transform[4],
    y: item.transform[5],
    items: candidates.map(({ text, x, y, width, size, horizontalScale, rotation }) => ({
      text,
      x,
      y,
      width,
      size,
      horizontalScale,
      rotation,
    })),
  };
  const text =
    candidates.length === 1 &&
    !run.charSpacing &&
    run.text.replace(/\s/g, '') === item.str.replace(/\s/g, '')
      ? item.str
      : run.text;
  return { item: paintedTextItem({ ...run, text }, item.fontName), splitItems };
}
