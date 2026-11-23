import type { Font } from '@pdf-lib/fontkit';
import type { PDFDocument, PDFFont } from 'pdf-lib';
import type { LocalFontFace, TextObject } from '../types';
import { catalogFont, originalFontFamily, standardFamilies } from './fontNames';
import { standardFontName } from './textLayout';
import { encodeSourceText, sourceFontActive } from './sourceFontResource';

interface LoadedFont {
  bytes: Uint8Array;
  font: Font;
}
const loaded = new Map<string, LoadedFont>();
const pending = new Map<string, Promise<LoadedFont | undefined>>();
const listeners = new Set<() => void>();
let version = 0;

export const subscribeFonts = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const fontVersion = () => version;

export function activeFontFace(object: TextObject) {
  const face = object.fontFace;
  if (
    !face ||
    face.family !== object.fontFamily ||
    face.bold !== Boolean(object.bold) ||
    face.italic !== Boolean(object.italic)
  )
    return;
  const font = loaded.get(face.id)?.font;
  const needsFullFont =
    font &&
    catalogFont(face.family) &&
    Array.from(object.text.replace(/[\r\n\t]/g, '')).some(
      (character) => !font.hasGlyphForCodePoint(character.codePointAt(0)!),
    );
  return needsFullFont ? undefined : face;
}

function fontLocation(object: TextObject) {
  const face = activeFontFace(object);
  if (face) return { key: face.id, url: face.dataUrl, css: `PDFForge-${face.id}` };
  const family = catalogFont(object.fontFamily ?? '');
  if (!family) return;
  const style = `${object.bold ? 700 : 400}-${object.italic ? 'italic' : 'normal'}`;
  return {
    key: `${family.id}-${style}`,
    url: `/fonts/catalog/${family.id}/${style}.ttf`,
    css: `PDFForge-${family.id}`,
  };
}

export function textFontCss(object: TextObject): string {
  const location = fontLocation(object);
  if (location) return `"${location.css}"`;
  if (sourceFontActive(object) && object.sourceLayout?.cssFamily) return object.sourceLayout.cssFamily;
  if (object.fontFamily === 'Times-Roman') return '"Times New Roman", serif';
  return object.fontFamily ?? 'Helvetica';
}

export function loadedTextFont(object: TextObject): Font | undefined {
  const location = fontLocation(object);
  return location ? loaded.get(location.key)?.font : undefined;
}

export async function prepareTextFont(object: TextObject): Promise<LoadedFont | undefined> {
  const location = fontLocation(object);
  if (!location) return;
  if (loaded.has(location.key)) return loaded.get(location.key);
  let task = pending.get(location.key);
  if (!task) {
    task = (async () => {
      const response = await fetch(location.url);
      if (!response.ok)
        throw new Error(
          `Could not load ${object.fontFamily}. Try again or import a matching font.`,
        );
      const bytes = new Uint8Array(await response.arrayBuffer());
      const { default: fontkit } = await import('@pdf-lib/fontkit');
      const font = fontkit.create(bytes);
      if (globalThis.document?.fonts) {
        const browserFace = new FontFace(location.css, bytes.slice().buffer, {
          weight: object.bold ? '700' : '400',
          style: object.italic ? 'italic' : 'normal',
        });
        await browserFace.load();
        document.fonts.add(browserFace);
      }
      const result = { bytes, font };
      loaded.set(location.key, result);
      version += 1;
      listeners.forEach((listener) => listener());
      return result;
    })().catch((error: unknown) => {
      pending.delete(location.key);
      throw error;
    });
    pending.set(location.key, task);
  }
  const result = await task;
  if (fontLocation(object)?.key !== location.key) return prepareTextFont(object);
  return result;
}

export function missingFontCharacters(object: TextObject, text = object.text): string {
  if (sourceFontActive(object) && encodeSourceText(object,text.replace(/[\r\n]/g,''))) return '';
  const font = loadedTextFont(object);
  if (!font) return '';
  return [...new Set(Array.from(text.replace(/[\r\n\t]/g, '')))]
    .filter((character) => !font.hasGlyphForCodePoint(character.codePointAt(0)!))
    .join('');
}

export async function embedTextFont(
  pdf: PDFDocument,
  object: TextObject,
  fonts: Map<string, PDFFont>,
): Promise<PDFFont> {
  if (object.fallback && object.sourceFontName)
    throw new Error(
      `The original font ${object.sourceFontName} is unavailable. Import its TTF/OTF file or choose a font in Home before exporting.`,
    );
  const location = fontLocation(object);
  if (!location) {
    if(!standardFamilies.some((family)=>family===(object.fontFamily??'Helvetica'))) throw new Error(`Import the matching ${object.fontFamily} TTF/OTF face, or choose a bundled font in Home.`);
    if (sourceFontActive(object)) throw new Error(`The original ${object.fontFamily} font cannot encode these new characters. Import its full TTF/OTF file or choose a font in Home.`);
    if(object.sourceLayout && !standardFamilies.some((family)=>family===object.fontFamily)) throw new Error(`Import the matching ${object.fontFamily} face for this formatting, or choose a bundled font in Home.`);
    if (object.fontFace && !standardFamilies.some((family) => family === object.fontFamily))
      throw new Error(
        `Import the ${object.bold ? 'bold' : 'regular'}${object.italic ? ' italic' : ''} face of ${object.fontFamily}, or choose a catalog font.`,
      );
    const name = standardFontName(object);
    const font = fonts.get(name) ?? (await pdf.embedFont(name));
    fonts.set(name, font);
    return font;
  }
  const data = (await prepareTextFont(object))!;
  const missing = missingFontCharacters(object);
  if (missing)
    throw new Error(
      `${object.fontFamily} does not contain these characters: ${missing.slice(0, 30)}. Import the full matching font or choose another font in Home.`,
    );
  let embedded = fonts.get(location.key);
  if (!embedded) {
    const { default: fontkit } = await import('@pdf-lib/fontkit');
    pdf.registerFontkit(fontkit);
    embedded = await pdf.embedFont(data.bytes, {
      subset: true,
      features: { kern: false, liga: false, clig: false },
    });
    fonts.set(location.key, embedded);
  }
  return embedded;
}

export function fontDataUrl(bytes: Uint8Array): string {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 8192)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return `data:font/ttf;base64,${btoa(binary)}`;
}

export async function importFontFace(bytes: Uint8Array, name?: string): Promise<LocalFontFace> {
  if (bytes.length < 4)
    throw new Error('Choose a valid TrueType (.ttf) or OpenType (.otf) font file.');
  const signature = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(0);
  if (![0x00010000, 0x4f54544f, 0x74727565].includes(signature))
    throw new Error('Choose a TrueType (.ttf) or OpenType (.otf) font file.');
  const { default: fontkit } = await import('@pdf-lib/fontkit');
  const font = fontkit.create(bytes);
  const fullName = name ?? font.fullName ?? font.postscriptName ?? 'Imported font';
  const weight = (font['OS/2'] as { usWeightClass?: number } | undefined)?.usWeightClass ?? 400;
  return {
    id: crypto.randomUUID(),
    family: originalFontFamily(name ?? font.familyName ?? fullName),
    name: fullName,
    bold: weight >= 600 || /bold|black|heavy|demi/i.test(fullName + (font.subfamilyName ?? '')),
    italic: Boolean(
      font.italicAngle || /italic|oblique/i.test(fullName + (font.subfamilyName ?? '')),
    ),
    dataUrl: fontDataUrl(bytes),
  };
}
