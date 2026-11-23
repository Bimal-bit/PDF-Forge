import type { Line } from 'tesseract.js';
import type { TextObject } from '../types';
import { rankOcrFonts, type OcrFontFace } from './ocrFontAtlas';
import { prepareTextFont, textFontCss } from './textFonts';

export function ocrAppearanceKey(object: TextObject): string {
  return JSON.stringify([
    object.x,
    object.y,
    object.fontFamily,
    object.fontSize,
    object.bold ?? false,
    object.italic ?? false,
    object.color,
    object.underline ?? false,
    object.strike ?? false,
    object.letterSpacing ?? 0,
    object.sourceLayout,
    object.cover,
    object.width,
    object.height,
    object.alignment,
    object.list,
    object.indent,
    object.fontFace?.id,
  ]);
}
export function preservesOcrPixels(object: TextObject): boolean {
  return Boolean(
    object.ocr &&
    object.text === object.ocr.text &&
    ocrAppearanceKey(object) === object.ocr.appearance,
  );
}

const cssFamily = { Helvetica: 'Arial', 'Times-Roman': 'Times New Roman', Courier: 'Courier New' };
const hex = (values: number[]) =>
  '#' + values.map((value) => Math.round(value).toString(16).padStart(2, '0')).join('');

/** Compare local font faces and solid colors; unchanged lines keep actual scan pixels. */
export async function matchOcrAppearance(
  canvas: HTMLCanvasElement,
  line: Line,
  scale: number,
  signal: AbortSignal,
) {
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  const box = line.bbox,
    left = Math.max(0, box.x0 - 3),
    top = Math.max(0, box.y0 - 3);
  const width = Math.min(canvas.width - left, box.x1 - left + 3),
    height = Math.min(canvas.height - top, box.y1 - top + 3);
  const data = context.getImageData(left, top, Math.max(1, width), Math.max(1, height)).data;
  const border: number[][] = [];
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      if (x > 1 && x < width - 2 && y > 1 && y < height - 2) continue;
      const i = (y * width + x) * 4;
      border.push([data[i], data[i + 1], data[i + 2]]);
    }
  const background = [0, 1, 2].map(
    (c) =>
      border.map((pixel) => pixel[c]).sort((a, b) => a - b)[Math.floor(border.length / 2)] ?? 255,
  );
  const inks: number[][] = [];
  let maxDifference = 0;
  for (let i = 0; i < data.length; i += 4)
    maxDifference = Math.max(
      maxDifference,
      Math.hypot(data[i] - background[0], data[i + 1] - background[1], data[i + 2] - background[2]),
    );
  const cutoff = Math.max(3, Math.min(90, maxDifference * 0.55));
  for (let i = 0; i < data.length; i += 4)
    if (
      Math.hypot(
        data[i] - background[0],
        data[i + 1] - background[1],
        data[i + 2] - background[2],
      ) > cutoff
    )
      inks.push([data[i], data[i + 1], data[i + 2]]);
  const color = [0, 1, 2].map(
    (c) => inks.map((pixel) => pixel[c]).sort((a, b) => a - b)[Math.floor(inks.length / 2)] ?? 17,
  );
  const target = document.createElement('canvas'),
    candidate = document.createElement('canvas');
  target.width = candidate.width = Math.min(
    900,
    Math.max(32, Math.round(((box.x1 - box.x0) / Math.max(1, box.y1 - box.y0)) * 40)),
  );
  target.height = candidate.height = 48;
  const targetContext = target.getContext('2d')!,
    candidateContext = candidate.getContext('2d')!;
  targetContext.drawImage(
    canvas,
    box.x0,
    box.y0,
    Math.max(1, box.x1 - box.x0),
    Math.max(1, box.y1 - box.y0),
    4,
    4,
    target.width - 8,
    40,
  );
  const targetData = targetContext.getImageData(0, 0, target.width, 48).data;
  let best = {
    family: 'Helvetica',
    bold: false,
    italic: false,
    size: (box.y1 - box.y0) / scale,
    ratio: 1,
    score: Infinity,
  };
  const candidates: OcrFontFace[] = Object.keys(cssFamily).flatMap((family) =>
    [false, true].flatMap((bold) => [false, true].map((italic) => ({ family, bold, italic }))),
  );
  candidates.push(...(await rankOcrFonts(canvas, line, background, cutoff, signal)));
  const ranked: {
    fontFamily: string;
    bold: boolean;
    italic: boolean;
    fontSize: number;
    horizontalScale: number;
    score: number;
  }[] = [];
  for (const { family, bold, italic } of candidates) {
    signal.throwIfAborted();
    const object = {
      type: 'text' as const,
      id: '',
      page: 1,
      x: 0,
      y: 0,
      text: line.text.trim(),
      fontSize: 100,
      fontFamily: family,
      color: '#000000',
      bold,
      italic,
    };
    await prepareTextFont(object);
    signal.throwIfAborted();
    const cssName = cssFamily[family as keyof typeof cssFamily];
    const css = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}100px ${cssName ? `"${cssName}"` : textFontCss(object)}`;
    candidateContext.font = css;
    candidateContext.fontKerning = 'none';
    const metrics = candidateContext.measureText(line.text.trim());
    const ascent = metrics.actualBoundingBoxAscent || 75,
      descent = metrics.actualBoundingBoxDescent || 0;
    const inkWidth =
      metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight || metrics.width;
    candidateContext.clearRect(0, 0, target.width, 48);
    candidateContext.save();
    candidateContext.translate(4, 4);
    candidateContext.scale((target.width - 8) / Math.max(1, inkWidth), 40 / (ascent + descent));
    candidateContext.fillStyle = 'black';
    candidateContext.fillText(line.text.trim(), metrics.actualBoundingBoxLeft, ascent);
    candidateContext.restore();
    const sample = candidateContext.getImageData(0, 0, target.width, 48).data;
    let error = 0,
      union = 0;
    for (let y = 4; y < 44; y += 1)
      for (let x = 4; x < target.width - 4; x += 1) {
        const i = (y * target.width + x) * 4;
        const actual =
          Math.hypot(
            targetData[i] - background[0],
            targetData[i + 1] - background[1],
            targetData[i + 2] - background[2],
          ) >
          cutoff * 0.75;
        const rendered = sample[i + 3] > 100;
        if (actual || rendered) union += 1;
        if (actual !== rendered) error += 1;
      }
    const score = error / Math.max(1, union);
    const size = (((box.y1 - box.y0) / scale) * 100) / (ascent + descent);
    const ratio = (box.x1 - box.x0) / scale / Math.max(1, (metrics.width * size) / 100);
    ranked.push({
      fontFamily: family,
      bold,
      italic,
      fontSize: size,
      horizontalScale: ratio,
      score,
    });
    if (score < best.score)
      best = {
        family,
        bold,
        italic,
        size,
        ratio,
        score,
      };
  }
  target.width = candidate.width = target.height = candidate.height = 0;
  const sample = document.createElement('canvas');
  sample.width = box.x1 - box.x0 + 8;
  sample.height = box.y1 - box.y0 + 8;
  sample
    .getContext('2d')!
    .drawImage(
      canvas,
      box.x0 - 4,
      box.y0 - 4,
      sample.width,
      sample.height,
      0,
      0,
      sample.width,
      sample.height,
    );
  const reference = sample.toDataURL('image/png');
  sample.width = sample.height = 0;
  return {
    fontFamily: best.family,
    bold: best.bold,
    italic: best.italic,
    fontSize: best.size,
    horizontalScale: best.ratio,
    color: hex(color),
    background: hex(background),
    fontOptions: ranked.sort((a, b) => a.score - b.score).slice(0, 8),
    reference,
    referenceScale: scale,
  };
}
