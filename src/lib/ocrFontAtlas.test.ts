import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { glyphDistance } from './ocrFontAtlas';
import { fontCatalog } from './fontCatalog';
import { editableOcrObjects } from './ocrText';
import { chooseOcrFont } from './ocrFontChoice';

describe('local OCR font matching', () => {
  it('bundles fingerprints for all four styles of every catalog family', () => {
    const manifest = JSON.parse(readFileSync('public/fonts/ocr/manifest.json', 'utf8')) as { faces: { family: string; bold: boolean; italic: boolean }[]; chars: string; recordBytes: number };
    expect(manifest.faces).toHaveLength(fontCatalog.length * 4);
    expect(readFileSync('public/fonts/ocr/glyphs.bin').length).toBe(manifest.faces.length * manifest.chars.length * manifest.recordBytes);
    for (const font of fontCatalog) for (const bold of [true, false]) for (const italic of [true, false]) expect(manifest.faces).toContainEqual({ family: font.family, bold, italic });
  });
  it('ranks matching ink and proportions above different glyphs', () => {
    const glyph = new Uint8Array([15, 240]), other = new Uint8Array([240, 15]);
    expect(glyphDistance(glyph, glyph, .7, .7)).toBe(0);
    expect(glyphDistance(glyph, other, .7, .7)).toBeGreaterThan(.9);
    expect(glyphDistance(glyph, glyph, .7, 1.5)).toBeGreaterThan(0);
  });
  it('carries imported font bytes into the editable object for recovery and PDF embedding', () => {
    const face = { id: 'local-face', family: 'Exact face', name: 'Exact face Regular', bold: false, italic: false, dataUrl: 'data:font/ttf;base64,AAAA' };
    const [object] = editableOcrObjects([{ id: 'line', page: 1, text: 'Edited', originalText: 'Original', confidence: 95, x: 30, y: 40, width: 120, height: 20, baseline: 42, fontSize: 18, fontFamily: face.family, fontFace: face }], () => 1);
    expect(object.fontFace).toEqual(face); expect(object.fontFamily).toBe(face.family);
  });
  it('rejects unavailable imported-font variants before creating an unexportable replacement', async () => {
    const line = { id: 'line', page: 1, text: 'Value', confidence: 90, x: 30, y: 40, width: 120, height: 20 };
    await expect(chooseOcrFont(line, 'Unbundled Original', true, false)).rejects.toThrow('Import the bold face');
  });
});
