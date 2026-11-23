import { OPS, type PDFPageProxy } from 'pdfjs-dist';
import { multiply } from './sourceTypography';

type Matrix = [number, number, number, number, number, number];
export interface OcrRegion {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Locate ordinary raster image paints in page coordinates, including nested forms. */
export async function imageOcrRegions(page: PDFPageProxy): Promise<OcrRegion[]> {
  const list = await page.getOperatorList();
  const viewport = page.getViewport({ scale: 1, rotation: 0 });
  let matrix: Matrix = [1, 0, 0, 1, 0, 0];
  const stack: Matrix[] = [],
    regions: OcrRegion[] = [];
  const add = (m: Matrix) => {
    const points = [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ].map(([x, y]) =>
      viewport.convertToViewportPoint(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]),
    );
    const left = Math.max(0, Math.min(...points.map((point) => point[0])));
    const top = Math.max(0, Math.min(...points.map((point) => point[1])));
    const right = Math.min(viewport.width, Math.max(...points.map((point) => point[0])));
    const bottom = Math.min(viewport.height, Math.max(...points.map((point) => point[1])));
    if (right - left < 8 || bottom - top < 5) return;
    const region = { left, top, width: right - left, height: bottom - top };
    if (
      !regions.some(
        (entry) =>
          Math.abs(entry.left - left) < 1 &&
          Math.abs(entry.top - top) < 1 &&
          Math.abs(entry.width - region.width) < 1 &&
          Math.abs(entry.height - region.height) < 1,
      )
    )
      regions.push(region);
  };
  for (let index = 0; index < list.fnArray.length; index += 1) {
    const op = list.fnArray[index],
      args = list.argsArray[index] as unknown[];
    if (op === OPS.save || op === OPS.paintFormXObjectBegin) {
      stack.push([...matrix]);
      if (op === OPS.paintFormXObjectBegin && args[0])
        matrix = multiply(matrix, Array.from(args[0] as ArrayLike<number>) as Matrix);
    } else if (op === OPS.restore || op === OPS.paintFormXObjectEnd) matrix = stack.pop() ?? matrix;
    else if (op === OPS.transform) matrix = multiply(matrix, Array.from(args) as Matrix);
    else if (op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject) add(matrix);
    else if (op === OPS.paintImageXObjectRepeat) {
      const positions = args[3] as number[];
      for (let i = 0; i < positions.length; i += 2)
        add(
          multiply(matrix, [
            Number(args[1]),
            0,
            0,
            Number(args[2]),
            positions[i],
            positions[i + 1],
          ]),
        );
    }
  }
  return regions;
}

export function recognitionScale(region: OcrRegion): number {
  return Math.min(6, Math.sqrt(12_000_000 / (region.width * region.height)));
}

export function enhanceOcrImage(canvas: HTMLCanvasElement): HTMLCanvasElement {
  const output = document.createElement('canvas');
  output.width = canvas.width;
  output.height = canvas.height;
  const context = output.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(canvas, 0, 0);
  const image = context.getImageData(0, 0, output.width, output.height),
    histogram = new Uint32Array(256);
  for (let i = 0; i < image.data.length; i += 4)
    histogram[
      Math.round(image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114)
    ] += 1;
  const pixels = output.width * output.height;
  let low = 0,
    high = 255,
    sum = 0;
  while (low < 254 && sum + histogram[low] < pixels * 0.005) sum += histogram[low++];
  sum = 0;
  while (high > low + 1 && sum + histogram[high] < pixels * 0.005) sum += histogram[high--];
  const invert = histogram.slice(0, 128).reduce((a, b) => a + b, 0) > pixels * 0.6;
  for (let i = 0; i < image.data.length; i += 4) {
    const gray = image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114;
    const value = Math.max(0, Math.min(255, ((gray - low) * 255) / Math.max(1, high - low)));
    image.data[i] = image.data[i + 1] = image.data[i + 2] = invert ? 255 - value : value;
  }
  context.putImageData(image, 0, 0);
  return output;
}
