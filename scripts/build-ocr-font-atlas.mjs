/* global document, FontFace, console, Buffer */
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const families = JSON.parse(await readFile('public/fonts/catalog/manifest.json', 'utf8'));
const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,:;!?()/%+-&@';
const faces = [], chunks = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const family of families) {
    for (const bold of [false, true]) for (const italic of [false, true]) {
      const data = [...await readFile(`public/fonts/catalog/${family.id}/${bold ? 700 : 400}-${italic ? 'italic' : 'normal'}.ttf`)];
      const values = await page.evaluate(async ({ data, bold, italic, chars }) => {
        const face = new FontFace('OCRAtlas', new Uint8Array(data), { weight: bold ? '700' : '400', style: italic ? 'italic' : 'normal' });
        await face.load(); document.fonts.add(face);
        try {
          const canvas = document.createElement('canvas'); canvas.width = canvas.height = 32;
          const context = canvas.getContext('2d', { willReadFrequently: true });
          context.font = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}100px OCRAtlas`;
          context.fontKerning = 'none';
          return [...chars].map((character) => {
            const metrics = context.measureText(character), w = metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight, h = metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent;
            context.clearRect(0, 0, 32, 32); context.save(); context.translate(2, 2); context.scale(28 / Math.max(1, w), 28 / Math.max(1, h));
            context.fillText(character, metrics.actualBoundingBoxLeft, metrics.actualBoundingBoxAscent); context.restore();
            const rgba = context.getImageData(0, 0, 32, 32).data, bits = Array(128).fill(0);
            for (let pixel = 0; pixel < 1024; pixel += 1) if (rgba[pixel * 4 + 3] > 100) bits[pixel >> 3] |= 1 << (pixel & 7);
            return { aspect: w / Math.max(1, h), bits };
          });
        } finally { document.fonts.delete(face); }
      }, { data, bold, italic, chars });
      const output = Buffer.alloc(values.length * 132);
      values.forEach((glyph, index) => { output.writeFloatLE(glyph.aspect, index * 132); Buffer.from(glyph.bits).copy(output, index * 132 + 4); });
      chunks.push(output); faces.push({ family: family.family, bold, italic });
    }
    if (faces.length % 40 === 0) console.log(`Prepared ${faces.length} font faces`);
  }
  await mkdir('public/fonts/ocr', { recursive: true });
  await writeFile('public/fonts/ocr/manifest.json', JSON.stringify({ version: 1, size: 32, recordBytes: 132, chars, faces }));
  await writeFile('public/fonts/ocr/glyphs.bin', Buffer.concat(chunks));
  console.log(JSON.stringify({ faces: faces.length, bytes: Buffer.concat(chunks).length }));
} finally { await browser.close(); }
