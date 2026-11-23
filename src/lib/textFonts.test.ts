import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument } from 'pdf-lib';
import { OPS, type PDFPageProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import type { TextObject } from '../types';
import { fontCatalog } from './fontCatalog';
import { catalogFont, fontIdentity } from './fontNames';
import {
  embedTextFont,
  importFontFace,
  missingFontCharacters,
  prepareTextFont,
  loadedTextFont,
} from './textFonts';
import { preserveSourceFont } from './sourceFonts';
import { replaceFontCmap } from './fontCmap';
import { exportPdf } from './export';
import { sourceFontActive } from './sourceFontResource';

const text: TextObject = {
  id: 'font-test',
  type: 'text',
  page: 1,
  x: 20,
  y: 150,
  text: 'Matching text',
  fontFamily: 'Helvetica',
  fontSize: 18,
  color: '#000000',
};
const nativeFetch = globalThis.fetch;
async function localFetch(input: RequestInfo | URL, init?: RequestInit) {
  if (typeof input === 'string' && input.startsWith('/fonts/'))
    return new Response(await readFile(`public${input}`));
  return nativeFetch(input, init);
}

describe('real local fonts', () => {
  it('bundles 100 distinct families with four valid faces that can all embed in a PDF', async () => {
    vi.stubGlobal('fetch', localFetch);
    try {
      expect(fontCatalog).toHaveLength(100);
      expect(new Set(fontCatalog.map((font) => font.family)).size).toBe(100);
      for (const family of fontCatalog) {
        const pdf = await PDFDocument.create();
        const sheet = pdf.addPage([300, 300]);
        for (const [bold, italic] of [
          [false, false],
          [true, false],
          [false, true],
          [true, true],
        ]) {
          const object = { ...text, fontFamily: family.family, bold, italic };
          const font = await embedTextFont(pdf, object, new Map());
          expect(missingFontCharacters(object)).toBe('');
          sheet.drawText(object.text, { x: 20, y: 100, size: 12, font });
        }
        expect((await PDFDocument.load(await pdf.save())).getPageCount()).toBe(1);
      }
    } finally {
      vi.unstubAllGlobals();
    }
  }, 120000);

  it('recognizes source names without collapsing different catalog fonts', () => {
    expect(catalogFont('ABCDEF+Poppins-BoldItalic')?.family).toBe('Poppins');
    expect(catalogFont('SourceSans3-Regular')?.family).toBe('Source Sans 3');
    expect(fontIdentity('Poppins')).not.toBe(fontIdentity('Roboto'));
  });

  it('restores source Unicode mappings while preserving the original glyph outlines', async () => {
    const bytes = new Uint8Array(await readFile('public/fonts/NotoSans-Regular.ttf'));
    const original = fontkit.create(bytes);
    const privatePoint = 0xe003;
    const z = original.glyphForCodePoint(90);
    const encoded = replaceFontCmap(bytes, new Map([[privatePoint, z.id]]));
    const sourcePage = {
      commonObjs: { get: () => ({ data: encoded, name: 'BrandFace-Regular' }) },
      getOperatorList: async () => ({
        fnArray: [OPS.setFont, OPS.showText],
        argsArray: [['f1', 18], [[{ unicode: 'Q', fontChar: String.fromCodePoint(privatePoint) }]]],
      }),
    } as unknown as PDFPageProxy;
    const object = await preserveSourceFont(sourcePage, { fontName: 'f1' } as TextItem, {
      ...text,
      text: 'Q',
    });
    expect(object.fontFamily).toBe('BrandFace');
    expect(object.fontFace?.dataUrl).toMatch(/^data:font\/ttf;base64,/);
    const restored = loadedTextFont(object)!;
    expect(restored.glyphForCodePoint(81).path.toSVG()).toBe(z.path.toSVG());
    expect(restored.glyphForCodePoint(81).advanceWidth).toBe(z.advanceWidth);
  });

  it('keeps imported font data through export and rejects missing glyphs explicitly', async () => {
    const bytes = new Uint8Array(await readFile('public/fonts/NotoSans-Regular.ttf'));
    const face = await importFontFace(bytes, 'BrandFace-Regular');
    const object: TextObject = {
      ...text,
      fontFamily: face.family,
      fontFace: face,
      sourceLayout: {
        baselineOffset: 0,
        ascent: 0.8,
        horizontalScale: 1,
        rotation: 0,
        fontFamily: face.family,
        bold: false,
        italic: false,
        fontFaceId: 'older-source-face',
        fontResource: { path: ['F1'], codes: { A: { hex: '41', width: 600 } } },
      },
    };
    expect(sourceFontActive(object)).toBe(false);
    const source = await PDFDocument.create();
    source.addPage([300, 300]);
    const data = await source.save();
    const document = {
      id: 'source',
      name: 'source.pdf',
      size: data.byteLength,
      data: data.slice().buffer,
      modifiedAt: 0,
    };
    const exported = await PDFDocument.load(await exportPdf(document, [object]));
    expect(exported.getPageCount()).toBe(1);
    await prepareTextFont(object);
    expect(missingFontCharacters({ ...object, text: '漢' })).toContain('漢');
    await expect(exportPdf(document, [{ ...object, text: '漢' }])).rejects.toThrow(
      'Import the full matching font',
    );
  });
});
