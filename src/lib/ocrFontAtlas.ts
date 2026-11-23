import type { Line } from 'tesseract.js';

export interface OcrFontFace {
  family: string;
  bold: boolean;
  italic: boolean;
}
interface Manifest {
  version: number;
  size: number;
  recordBytes: number;
  chars: string;
  faces: OcrFontFace[];
}
interface Atlas {
  manifest: Manifest;
  bytes: Uint8Array;
  view: DataView;
}
let pending: Promise<Atlas> | undefined;
const popcount = new Uint8Array(256);
for (let value = 1; value < 256; value += 1) popcount[value] = popcount[value >> 1] + (value & 1);

async function atlas() {
  pending ??= Promise.all([fetch('/fonts/ocr/manifest.json'), fetch('/fonts/ocr/glyphs.bin')])
    .then(async ([metadata, glyphs]) => {
      if (!metadata.ok || !glyphs.ok)
        throw new Error(
          'The local font-matching library could not be loaded. Reload the app and try again.',
        );
      const manifest = (await metadata.json()) as Manifest,
        buffer = await glyphs.arrayBuffer();
      if (
        manifest.version !== 1 ||
        manifest.size !== 32 ||
        manifest.recordBytes !== 132 ||
        buffer.byteLength !== manifest.faces.length * manifest.chars.length * 132
      )
        throw new Error(
          'The local font-matching library is incomplete. Reload the app to refresh its offline assets.',
        );
      return { manifest, bytes: new Uint8Array(buffer), view: new DataView(buffer) };
    })
    .catch((error: unknown) => {
      pending = undefined;
      throw error;
    });
  return pending;
}

export function glyphDistance(
  target: Uint8Array,
  candidate: Uint8Array,
  targetAspect: number,
  candidateAspect: number,
): number {
  let different = 0,
    union = 0;
  for (let i = 0; i < target.length; i += 1) {
    different += popcount[target[i] ^ candidate[i]];
    union += popcount[target[i] | candidate[i]];
  }
  return (
    different / Math.max(1, union) +
    Math.min(
      0.4,
      Math.abs(Math.log(Math.max(0.01, targetAspect) / Math.max(0.01, candidateAspect))) * 0.15,
    )
  );
}

function sampleGlyph(
  canvas: HTMLCanvasElement,
  box: { x0: number; y0: number; x1: number; y1: number },
  background: number[],
  threshold: number,
) {
  const x0 = Math.max(0, Math.floor(box.x0)),
    y0 = Math.max(0, Math.floor(box.y0));
  const width = Math.min(canvas.width - x0, Math.ceil(box.x1) - x0),
    height = Math.min(canvas.height - y0, Math.ceil(box.y1) - y0);
  if (width < 2 || height < 2) return;
  const image = canvas
    .getContext('2d', { willReadFrequently: true })!
    .getImageData(x0, y0, width, height);
  let left = width,
    top = height,
    right = -1,
    bottom = -1;
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      const ink =
        Math.hypot(
          image.data[i] - background[0],
          image.data[i + 1] - background[1],
          image.data[i + 2] - background[2],
        ) > threshold;
      if (ink) {
        left = Math.min(left, x);
        top = Math.min(top, y);
        right = Math.max(right, x);
        bottom = Math.max(bottom, y);
      }
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 0;
      image.data[i + 3] = ink ? 255 : 0;
    }
  if (right < left || bottom < top) return;
  const source = document.createElement('canvas'),
    target = document.createElement('canvas');
  source.width = width;
  source.height = height;
  source.getContext('2d')!.putImageData(image, 0, 0);
  target.width = target.height = 32;
  const context = target.getContext('2d')!;
  context.drawImage(source, left, top, right - left + 1, bottom - top + 1, 2, 2, 28, 28);
  const rgba = context.getImageData(0, 0, 32, 32).data,
    bits = new Uint8Array(128);
  for (let pixel = 0; pixel < 1024; pixel += 1)
    if (rgba[pixel * 4 + 3] > 100) bits[pixel >> 3] |= 1 << (pixel & 7);
  source.width = source.height = target.width = target.height = 0;
  return { bits, aspect: (right - left + 1) / (bottom - top + 1) };
}

/** Cheap glyph screening covers all 400 local faces; only finalists need full font loading. */
export async function rankOcrFonts(
  canvas: HTMLCanvasElement,
  line: Line,
  background: number[],
  threshold: number,
  signal: AbortSignal,
): Promise<OcrFontFace[]> {
  signal.throwIfAborted();
  const { manifest, bytes, view } = await atlas();
  signal.throwIfAborted();
  const symbols = line.words
    .flatMap((word) => word.symbols)
    .filter((symbol) => symbol.confidence >= 60 && /^[A-Za-z0-9]$/.test(symbol.text));
  const samples: { glyph: number; bits: Uint8Array; aspect: number }[] = [],
    seen = new Set<string>();
  for (const symbol of symbols) {
    if (seen.has(symbol.text)) continue;
    seen.add(symbol.text);
    const glyph = manifest.chars.indexOf(symbol.text);
    const sampled = sampleGlyph(canvas, symbol.bbox, background, threshold);
    if (glyph >= 0 && sampled) samples.push({ glyph, ...sampled });
    if (samples.length >= 16) break;
  }
  if (!samples.length) return [];
  return manifest.faces
    .map((face, index) => {
      let score = 0;
      for (const sample of samples) {
        const offset = (index * manifest.chars.length + sample.glyph) * 132;
        score += glyphDistance(
          sample.bits,
          bytes.subarray(offset + 4, offset + 132),
          sample.aspect,
          view.getFloat32(offset, true),
        );
      }
      return { face, score: score / samples.length };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 16)
    .map((entry) => entry.face);
}
