import { StandardFontEmbedder, type PDFFont, type PDFDocument, type PDFPage } from 'pdf-lib';
import type { EquationObject } from '../types';
import { parseEquation, type MathNode } from './equationParser';
import { pdfColor } from './color';

type MathFont = 'Times-Roman' | 'Times-Italic' | 'Symbol';
export interface MathGlyph {
  text: string;
  x: number;
  y: number;
  size: number;
  font: MathFont;
}
export interface MathRule {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
}
export interface EquationLayout {
  width: number;
  ascent: number;
  descent: number;
  glyphs: MathGlyph[];
  rules: MathRule[];
}
const metrics = new Map<MathFont, StandardFontEmbedder>();

function shifted(box: EquationLayout, x: number, y: number) {
  return {
    glyphs: box.glyphs.map((glyph) => ({ ...glyph, x: glyph.x + x, y: glyph.y + y })),
    rules: box.rules.map((rule) => ({
      ...rule,
      x1: rule.x1 + x,
      x2: rule.x2 + x,
      y1: rule.y1 + y,
      y2: rule.y2 + y,
    })),
  };
}

function measure(text: string, font: MathFont, size: number) {
  let embedder = metrics.get(font);
  if (!embedder) {
    embedder = StandardFontEmbedder.for(font as Parameters<typeof StandardFontEmbedder.for>[0]);
    metrics.set(font, embedder);
  }
  return embedder.widthOfTextAtSize(text, size);
}

function layoutNode(node: MathNode, size: number): EquationLayout {
  const empty: EquationLayout = { width: 0, ascent: 0, descent: 0, glyphs: [], rules: [] };
  if (node.kind === 'text') {
    for (const character of node.text) {
      let font: MathFont =
        !node.upright && /^[A-Za-z]$/.test(character) ? 'Times-Italic' : 'Times-Roman';
      let width: number;
      try {
        width = measure(character, font, size);
      } catch {
        font = 'Symbol';
        try {
          width = measure(character, font, size);
        } catch {
          throw new Error(`Unsupported equation character “${character}”.`);
        }
      }
      empty.glyphs.push({ text: character, x: empty.width, y: 0, font, size });
      empty.width += width;
    }
    return { ...empty, ascent: size * 0.8, descent: size * 0.22 };
  }
  if (node.kind === 'row') {
    for (const child of node.children) {
      const box = layoutNode(child, size);
      const moved = shifted(box, empty.width, 0);
      empty.glyphs.push(...moved.glyphs);
      empty.rules.push(...moved.rules);
      empty.width += box.width;
      empty.ascent = Math.max(empty.ascent, box.ascent);
      empty.descent = Math.max(empty.descent, box.descent);
    }
    return empty;
  }
  if (node.kind === 'fraction') {
    const upper = layoutNode(node.numerator, size * 0.85);
    const lower = layoutNode(node.denominator, size * 0.85);
    const width = Math.max(upper.width, lower.width) + size * 0.3;
    const axis = size * 0.22;
    const upperY = axis + size * 0.18 + upper.descent;
    const lowerY = axis - size * 0.18 - lower.ascent;
    const numerator = shifted(upper, (width - upper.width) / 2, upperY);
    const denominator = shifted(lower, (width - lower.width) / 2, lowerY);
    return {
      width,
      ascent: upperY + upper.ascent,
      descent: -lowerY + lower.descent,
      glyphs: [...numerator.glyphs, ...denominator.glyphs],
      rules: [
        ...numerator.rules,
        ...denominator.rules,
        { x1: 0, x2: width, y1: axis, y2: axis, thickness: size * 0.045 },
      ],
    };
  }
  if (node.kind === 'root') {
    const box = layoutNode(node.content, size);
    const offset = size * 0.55;
    const moved = shifted(box, offset, 0);
    const top = box.ascent + size * 0.12;
    return {
      width: offset + box.width + size * 0.08,
      ascent: top + size * 0.05,
      descent: box.descent,
      glyphs: moved.glyphs,
      rules: [
        ...moved.rules,
        { x1: 0, y1: size * 0.12, x2: size * 0.13, y2: size * 0.2, thickness: size * 0.045 },
        {
          x1: size * 0.13,
          y1: size * 0.2,
          x2: size * 0.27,
          y2: -box.descent,
          thickness: size * 0.045,
        },
        { x1: size * 0.27, y1: -box.descent, x2: size * 0.47, y2: top, thickness: size * 0.045 },
        {
          x1: size * 0.47,
          y1: top,
          x2: offset + box.width + size * 0.08,
          y2: top,
          thickness: size * 0.045,
        },
      ],
    };
  }
  const base = layoutNode(node.base, size);
  const result = { ...base, glyphs: [...base.glyphs], rules: [...base.rules] };
  for (const [script, upper] of [
    [node.upper, true],
    [node.lower, false],
  ] as const) {
    if (!script) continue;
    const box = layoutNode(script, size * 0.65);
    const y = upper ? base.ascent * 0.8 + box.descent : -base.descent - box.ascent * 0.7;
    const moved = shifted(box, base.width + size * 0.05, y);
    result.glyphs.push(...moved.glyphs);
    result.rules.push(...moved.rules);
    result.width = Math.max(result.width, base.width + size * 0.05 + box.width);
    result.ascent = Math.max(result.ascent, y + box.ascent);
    result.descent = Math.max(result.descent, -y + box.descent);
  }
  return result;
}

export function equationLayout(latex: string, size: number): EquationLayout {
  return layoutNode(parseEquation(latex), Math.max(6, Math.min(144, size)));
}

export async function drawEquation(
  pdf: PDFDocument,
  page: PDFPage,
  object: EquationObject,
  fonts: Map<string, PDFFont>,
) {
  const layout = equationLayout(object.latex, object.fontSize);
  const color = pdfColor(object.color);
  for (const glyph of layout.glyphs) {
    let font = fonts.get(glyph.font);
    if (!font) {
      font = await pdf.embedFont(glyph.font);
      fonts.set(glyph.font, font);
    }
    page.drawText(glyph.text, {
      x: object.x + glyph.x,
      y: object.y + layout.descent + glyph.y,
      size: glyph.size,
      font,
      color,
    });
  }
  for (const rule of layout.rules)
    page.drawLine({
      start: { x: object.x + rule.x1, y: object.y + layout.descent + rule.y1 },
      end: { x: object.x + rule.x2, y: object.y + layout.descent + rule.y2 },
      thickness: rule.thickness,
      color,
    });
}
