import {
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
  beginText,
  endText,
  popGraphicsState,
  pushGraphicsState,
  setCharacterSpacing,
  setCharacterSqueeze,
  setFillingColor,
  setFontAndSize,
  setTextMatrix,
  setWordSpacing,
  showText,
  type PDFPage,
} from 'pdf-lib';
import type { PDFPageProxy } from 'pdfjs-dist';
import type { OpenDocument, TextObject } from '../types';
import { originalFontFamily } from './fontNames';
import { pageTypography } from './sourceTypography';
import { pdfColor } from './color';

const documents = new WeakMap<OpenDocument, Promise<PDFDocument>>();
const key = (value: string) =>
  value
    .replace(/^\//, '')
    .replace(/^[A-Z]{6}\+/, '')
    .toLowerCase();

function fontResources(
  resources: PDFDict,
  name: string,
  path: string[] = [],
  seen = new Set<PDFDict>(),
): string[][] {
  if (seen.has(resources)) return [];
  seen.add(resources);
  const result: string[][] = [];
  const fonts = resources.lookupMaybe(PDFName.of('Font'), PDFDict);
  for (const [id, entry] of fonts?.entries() ?? []) {
    const font = resources.context.lookup(entry, PDFDict);
    const base = font.get(PDFName.of('BaseFont'))?.toString() ?? '';
    if (key(base) === key(name)) result.push([...path, id.decodeText()]);
  }
  const objects = resources.lookupMaybe(PDFName.of('XObject'), PDFDict);
  for (const [id, entry] of objects?.entries() ?? []) {
    const stream = resources.context.lookup(entry);
    if (!(stream instanceof PDFRawStream)) continue;
    const child = stream.dict.lookupMaybe(PDFName.of('Resources'), PDFDict);
    if (child) result.push(...fontResources(child, name, [...path, id.decodeText()], seen));
  }
  return result;
}

function resourceFont(page: PDFPage, path: string[]) {
  let resources = page.node.Resources();
  for (const id of path.slice(0, -1)) {
    const entry = resources?.lookup(PDFName.of('XObject'), PDFDict).get(PDFName.of(id));
    const object = entry ? page.doc.context.lookup(entry) : undefined;
    resources =
      object instanceof PDFRawStream
        ? object.dict.lookupMaybe(PDFName.of('Resources'), PDFDict)
        : undefined;
  }
  const entry = resources?.lookup(PDFName.of('Font'), PDFDict).get(PDFName.of(path.at(-1)!));
  if (!entry) return;
  return {
    ref: entry instanceof PDFRef ? entry : page.doc.context.register(entry),
    dict: page.doc.context.lookup(entry, PDFDict),
  };
}

export async function attachSourceFontResource(
  document: OpenDocument,
  page: PDFPageProxy,
  fontId: string,
  object: TextObject,
): Promise<TextObject> {
  if (!object.sourceLayout) return object;
  let task = documents.get(document);
  if (!task) {
    task = PDFDocument.load(document.data.slice(0), { updateMetadata: false });
    documents.set(document, task);
  }
  const pdf = await task;
  const originalPage = pdf.getPage(object.page - 1);
  const font = page.commonObjs.get(fontId) as {
    name: string;
    widths?: Record<number, number>;
    defaultWidth?: number;
  };
  const resources = originalPage.node.Resources();
  if (!resources) return object;
  const candidates = fontResources(resources, font.name);
  if (candidates.length !== 1) return object;
  const resource = resourceFont(originalPage, candidates[0]);
  if (!resource) return object;
  const composite = resource.dict.get(PDFName.of('Subtype'))?.toString() === '/Type0';
  const code = (value: number) => value.toString(16).padStart(composite ? 4 : 2, '0');
  const codes: Record<string, { hex: string; width: number }> = Object.create(null) as Record<
    string,
    { hex: string; width: number }
  >;
  const unicodeEntry = resource.dict.get(PDFName.of('ToUnicode'));
  const toUnicode = unicodeEntry ? pdf.context.lookup(unicodeEntry) : undefined;
  if (toUnicode instanceof PDFRawStream) {
    const cmap = new TextDecoder().decode(decodePDFRawStream(toUnicode).decode());
    for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const match of block[1].matchAll(/<([0-9a-f]+)>\s*<([0-9a-f]+)>/gi)) {
        const bytes = Uint8Array.from(match[2].match(/.{2}/g)!.map((pair) => parseInt(pair, 16)));
        const text = new TextDecoder('utf-16be').decode(bytes);
        const value = parseInt(match[1], 16);
        codes[text] = { hex: match[1], width: font.widths?.[value] ?? font.defaultWidth ?? 0 };
      }
    }
    for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const match of block[1].matchAll(
        /<([0-9a-f]+)>\s*<([0-9a-f]+)>\s*(<([0-9a-f]+)>|\[([^\]]+)\])/gi,
      )) {
        const first = parseInt(match[1], 16),
          last = parseInt(match[2], 16);
        const entries = match[5]?.match(/<[0-9a-f]+>/gi);
        if (last - first > 65535) continue;
        for (let value = first; value <= last; value += 1) {
          const hex =
            entries?.[value - first]?.slice(1, -1) ??
            (parseInt(match[4] ?? '0', 16) + value - first).toString(16).padStart(4, '0');
          if (hex.length % 4) continue;
          const bytes = Uint8Array.from(hex.match(/.{2}/g)!.map((pair) => parseInt(pair, 16)));
          codes[new TextDecoder('utf-16be').decode(bytes)] = {
            hex: value.toString(16).padStart(match[1].length, '0'),
            width: font.widths?.[value] ?? font.defaultWidth ?? 0,
          };
        }
      }
    }
  }
  const encoding = resource.dict.get(PDFName.of('Encoding'))?.toString();
  if (!composite && encoding === '/WinAnsiEncoding') {
    const decoder = new TextDecoder('windows-1252');
    for (let value = 32; value < 256; value += 1) {
      const width = font.widths?.[value] ?? font.defaultWidth ?? 0;
      if (width) codes[decoder.decode(new Uint8Array([value]))] = { hex: code(value), width };
    }
  }
  const data = await pageTypography(page);
  for (const run of data.runs.filter((run) => run.font === fontId)) {
    for (const glyph of run.glyphs) {
      if (Number.isFinite(glyph.originalCharCode))
        codes[glyph.unicode] = { hex: code(glyph.originalCharCode), width: glyph.width };
    }
  }
  const family =
    object.fontFace?.family ??
    (/^(Helvetica|Times|Courier)(?:-|$)/i.test(font.name)
      ? object.fontFamily!
      : originalFontFamily(font.name));
  const result: TextObject = {
    ...object,
    fontFamily: family,
    fallback: false,
    sourceLayout: {
      ...object.sourceLayout,
      fontFamily: family,
      bold: Boolean(object.bold),
      italic: Boolean(object.italic),
      fontFaceId: object.fontFace?.id,
      fontResource: { path: candidates[0], codes },
    },
  };
  const encoded = encodeSourceText(result, result.text);
  const spaces = Array.from(result.text).filter((character) => character === ' ').length;
  if (encoded && spaces && result.width && result.sourceLayout) {
    const natural = encoded.reduce((sum, glyph) => sum + (glyph.width * result.fontSize) / 1000, 0);
    const extra =
      result.width / result.sourceLayout.horizontalScale -
      natural -
      (result.letterSpacing ?? 0) * encoded.length;
    result.sourceLayout.wordSpacing = extra / spaces;
  }
  return result;
}

export function sourceFontActive(object: TextObject): boolean {
  const source = object.sourceLayout;
  return Boolean(
    source?.fontResource &&
    source.fontFaceId === object.fontFace?.id &&
    source.fontFamily === object.fontFamily &&
    source.bold === Boolean(object.bold) &&
    source.italic === Boolean(object.italic),
  );
}

export function encodeSourceText(object: TextObject, text: string) {
  const codes = object.sourceLayout?.fontResource?.codes;
  if (!codes || !sourceFontActive(object)) return;
  const tokens = Object.keys(codes)
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const result: { hex: string; width: number }[] = [];
  let offset = 0;
  while (offset < text.length) {
    const token = tokens.find((token) => text.startsWith(token, offset));
    if (!token) return;
    result.push(codes[token]);
    offset += token.length;
  }
  return result;
}

export function drawOriginalFont(page: PDFPage, object: TextObject): boolean {
  const source = object.sourceLayout;
  const lines = object.text.split(/\r?\n/);
  const encoded = lines.map((line) => encodeSourceText(object, line));
  if (!source?.fontResource || encoded.some((line) => !line)) return false;
  const resource = resourceFont(page, source.fontResource.path);
  if (!resource) return false;
  const fontKey = page.node.newFontDictionary('PDFForgeOriginal', resource.ref);
  const radians = (source.rotation * Math.PI) / 180;
  const cosine = Math.cos(radians),
    sine = Math.sin(radians);
  lines.forEach((_, index) => {
    const y =
      object.y + source.baselineOffset - index * object.fontSize * (object.lineHeight ?? 1.2);
    page.pushOperators(
      pushGraphicsState(),
      beginText(),
      setFillingColor(pdfColor(object.color)),
      setFontAndSize(fontKey, object.fontSize),
      setCharacterSpacing(object.letterSpacing ?? 0),
      setWordSpacing(source.wordSpacing ?? 0),
      setCharacterSqueeze(source.horizontalScale * 100),
      setTextMatrix(cosine, sine, -sine, cosine, object.x, y),
      showText(
        PDFHexString.of(
          encoded[index]!.map((glyph) => glyph.hex)
            .join('')
            .toUpperCase(),
        ),
      ),
      endText(),
      popGraphicsState(),
    );
    const width =
      encoded[index]!.reduce(
        (sum, glyph) => sum + (glyph.width * object.fontSize) / 1000 + (object.letterSpacing ?? 0),
        0,
      ) * source.horizontalScale;
    for (const decoration of [
      object.underline
        ? (source.underline ?? {
            offset: -object.fontSize * 0.12,
            thickness: Math.max(0.5, object.fontSize / 18),
          })
        : undefined,
      object.strike
        ? (source.strike ?? {
            offset: object.fontSize * 0.3,
            thickness: Math.max(0.5, object.fontSize / 18),
          })
        : undefined,
    ]) {
      if (decoration)
        page.drawLine({
          start: { x: object.x - sine * decoration.offset, y: y + cosine * decoration.offset },
          end: {
            x: object.x + cosine * width - sine * decoration.offset,
            y: y + sine * width + cosine * decoration.offset,
          },
          thickness: decoration.thickness,
          color: pdfColor(object.color),
        });
    }
  });
  return true;
}
