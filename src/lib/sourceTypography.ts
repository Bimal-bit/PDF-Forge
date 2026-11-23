import { OPS, type PDFPageProxy } from 'pdfjs-dist';
import type { TextItem } from 'pdfjs-dist/types/src/display/api';

type Matrix = [number, number, number, number, number, number];
const identity = (): Matrix => [1, 0, 0, 1, 0, 0];
export interface SourceGlyph {
  unicode: string;
  originalCharCode: number;
  width: number;
  fontChar: string;
  isSpace: boolean;
}
export interface PaintedText {
  font: string;
  text: string;
  x: number;
  y: number;
  size: number;
  horizontalScale: number;
  rotation: number;
  color: string;
  charSpacing: number;
  wordSpacing: number;
  glyphs: SourceGlyph[];
  offsets: number[];
  width: number;
  underline?: { offset: number; thickness: number };
  strike?: { offset: number; thickness: number };
}
interface Rule {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thickness: number;
}
interface Graphics {
  ctm: Matrix;
  tm: Matrix;
  line: Matrix;
  font: string;
  size: number;
  fill: string;
  hScale: number;
  charSpacing: number;
  wordSpacing: number;
  leading: number;
  thickness: number;
}
export function multiply(a: Matrix, b: Matrix): Matrix {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
const cache = new WeakMap<PDFPageProxy, Promise<{ runs: PaintedText[]; rules: Rule[] }>>();

export function pageTypography(page: PDFPageProxy) {
  let task = cache.get(page);
  if (!task) {
    task = parseTypography(page);
    cache.set(page, task);
  }
  return task;
}

async function parseTypography(page: PDFPageProxy) {
  const list = await page.getOperatorList();
  let state: Graphics = {
    ctm: identity(),
    tm: identity(),
    line: identity(),
    font: '',
    size: 12,
    fill: '#000000',
    hScale: 1,
    charSpacing: 0,
    wordSpacing: 0,
    leading: 0,
    thickness: 1,
  };
  const stack: Graphics[] = [];
  const runs: PaintedText[] = [];
  const rules: Rule[] = [];
  const move = (x: number, y: number) => {
    state.line = multiply(state.line, [1, 0, 0, 1, x, y]);
    state.tm = [...state.line];
  };
  for (let index = 0; index < list.fnArray.length; index += 1) {
    const operation = list.fnArray[index];
    const args = list.argsArray[index] as unknown[] | null;
    switch (operation) {
      case OPS.save:
        stack.push({ ...state, ctm: [...state.ctm], tm: [...state.tm], line: [...state.line] });
        break;
      case OPS.restore:
        state = stack.pop() ?? state;
        break;
      case OPS.transform:
        state.ctm = multiply(state.ctm, Array.from(args!) as Matrix);
        break;
      case OPS.beginText:
        state.tm = identity();
        state.line = identity();
        break;
      case OPS.setTextMatrix:
        state.tm = Array.from(args![0] as ArrayLike<number>) as Matrix;
        state.line = [...state.tm];
        break;
      case OPS.setFont:
        state.font = args![0] as string;
        state.size = args![1] as number;
        break;
      case OPS.setFillRGBColor:
        state.fill = args![0] as string;
        break;
      case OPS.setCharSpacing:
        state.charSpacing = args![0] as number;
        break;
      case OPS.setWordSpacing:
        state.wordSpacing = args![0] as number;
        break;
      case OPS.setHScale:
        state.hScale = (args![0] as number) / 100;
        break;
      case OPS.setLeading:
        state.leading = args![0] as number;
        break;
      case OPS.setLineWidth:
        state.thickness = args![0] as number;
        break;
      case OPS.moveText:
        move(args![0] as number, args![1] as number);
        break;
      case OPS.setLeadingMoveText:
        state.leading = -(args![1] as number);
        move(args![0] as number, args![1] as number);
        break;
      case OPS.nextLine:
        move(0, -state.leading);
        break;
      case OPS.showText: {
        const entries = args![0] as (SourceGlyph | number)[];
        const glyphs = entries.filter((entry): entry is SourceGlyph => typeof entry !== 'number');
        const matrix = multiply(state.ctm, state.tm);
        const vertical = Math.hypot(matrix[2], matrix[3]);
        const horizontal = Math.hypot(matrix[0], matrix[1]);
        const offsets: number[] = [];
        let position = 0;
        for (const entry of entries) {
          if (typeof entry === 'number') position -= (entry * state.size) / 1000;
          else {
            offsets.push(position * state.hScale * horizontal);
            position +=
              (entry.width * state.size) / 1000 +
              state.charSpacing +
              (entry.isSpace ? state.wordSpacing : 0);
          }
        }
        runs.push({
          font: state.font,
          text: glyphs.map((glyph) => glyph.unicode).join(''),
          x: matrix[4],
          y: matrix[5],
          size: Math.abs(state.size) * vertical,
          horizontalScale: (horizontal * state.hScale) / vertical,
          rotation: (Math.atan2(matrix[1], matrix[0]) * 180) / Math.PI,
          color: state.fill,
          charSpacing: state.charSpacing * vertical,
          wordSpacing: state.wordSpacing * vertical,
          glyphs,
          offsets,
          width: position * state.hScale * horizontal,
        });
        const advance =
          entries.reduce<number>(
            (sum, entry) =>
              sum +
              (typeof entry === 'number'
                ? (-entry * state.size) / 1000
                : (entry.width * state.size) / 1000 +
                  state.charSpacing +
                  (entry.isSpace ? state.wordSpacing : 0)),
            0,
          ) * state.hScale;
        state.tm = multiply(state.tm, [1, 0, 0, 1, advance, 0]);
        break;
      }
      case OPS.constructPath: {
        const bounds = args?.[2] as ArrayLike<number> | undefined;
        if (
          !bounds ||
          bounds[2] - bounds[0] < 1 ||
          bounds[3] - bounds[1] > Math.max(2, state.thickness * 2)
        )
          break;
        const point = (x: number, y: number) => [
          state.ctm[0] * x + state.ctm[2] * y + state.ctm[4],
          state.ctm[1] * x + state.ctm[3] * y + state.ctm[5],
        ];
        const left = point(bounds[0], (bounds[1] + bounds[3]) / 2);
        const right = point(bounds[2], (bounds[1] + bounds[3]) / 2);
        rules.push({
          x1: left[0],
          y1: left[1],
          x2: right[0],
          y2: right[1],
          thickness:
            Math.max(bounds[3] - bounds[1], state.thickness) *
            Math.hypot(state.ctm[2], state.ctm[3]),
        });
        break;
      }
    }
  }
  return { runs: runs.flatMap((run) => splitDecorations(run, rules)), rules };
}

function splitDecorations(run: PaintedText, rules: Rule[]): PaintedText[] {
  const radians = (run.rotation * Math.PI) / 180,
    cosine = Math.cos(radians),
    sine = Math.sin(radians);
  const ruleAt = (distance: number, minimum: number, maximum: number) =>
    rules.find((rule) => {
      const x = (rule.x1 - run.x) * cosine + (rule.y1 - run.y) * sine;
      const end = (rule.x2 - run.x) * cosine + (rule.y2 - run.y) * sine;
      const offset = -(rule.x1 - run.x) * sine + (rule.y1 - run.y) * cosine;
      const other = -(rule.x2 - run.x) * sine + (rule.y2 - run.y) * cosine;
      return (
        distance >= x - 0.1 &&
        distance <= end + 0.1 &&
        offset >= minimum * run.size &&
        offset <= maximum * run.size &&
        Math.abs(offset - other) < 0.5 &&
        rule.thickness < run.size * 0.2
      );
    });
  const groups: { first: number; last: number; underline?: Rule; strike?: Rule }[] = [];
  run.glyphs.forEach((glyph, index) => {
    const next = run.offsets[index + 1] ?? run.width;
    const center = (run.offsets[index] + next) / 2;
    const underline = ruleAt(center, -0.25, -0.025),
      strike = ruleAt(center, 0.15, 0.55);
    const last = groups.at(-1);
    if (last && last.underline === underline && last.strike === strike) last.last = index;
    else groups.push({ first: index, last: index, underline, strike });
  });
  const decoration = (rule: Rule | undefined) =>
    rule
      ? {
          offset: -(rule.x1 - run.x) * sine + (rule.y1 - run.y) * cosine,
          thickness: rule.thickness,
        }
      : undefined;
  return groups.map((group) => {
    const start = run.offsets[group.first],
      end = run.offsets[group.last + 1] ?? run.width;
    const glyphs = run.glyphs.slice(group.first, group.last + 1);
    return {
      ...run,
      text: glyphs.map((glyph) => glyph.unicode).join(''),
      x: run.x + cosine * start,
      y: run.y + sine * start,
      width: end - start,
      glyphs,
      offsets: run.offsets.slice(group.first, group.last + 1).map((offset) => offset - start),
      underline: decoration(group.underline),
      strike: decoration(group.strike),
    };
  });
}

export async function textTypography(page: PDFPageProxy, item: TextItem) {
  const data = await pageTypography(page);
  const candidates = data.runs.filter((run) => run.font === item.fontName);
  const run = candidates.sort(
    (a, b) =>
      Math.hypot(a.x - item.transform[4], a.y - item.transform[5]) -
      Math.hypot(b.x - item.transform[4], b.y - item.transform[5]),
  )[0];
  if (!run) return;
  const radians = (run.rotation * Math.PI) / 180;
  const along = (x: number, y: number) =>
    (x - run.x) * Math.cos(radians) + (y - run.y) * Math.sin(radians);
  const across = (x: number, y: number) =>
    -(x - run.x) * Math.sin(radians) + (y - run.y) * Math.cos(radians);
  const decoration = (minimum: number, maximum: number) => {
    const rule = data.rules.find((rule) => {
      const offset = across(rule.x1, rule.y1);
      return (
        offset >= minimum * run.size &&
        offset <= maximum * run.size &&
        Math.abs(across(rule.x2, rule.y2) - offset) < 0.5 &&
        Math.min(along(rule.x2, rule.y2), item.width) - Math.max(along(rule.x1, rule.y1), 0) >=
          item.width * 0.7 &&
        rule.thickness < run.size * 0.2
      );
    });
    return rule ? { offset: across(rule.x1, rule.y1), thickness: rule.thickness } : undefined;
  };
  return {
    ...run,
    underline: run.underline ?? decoration(-0.25, -0.025),
    strike: run.strike ?? decoration(0.15, 0.55),
  };
}
