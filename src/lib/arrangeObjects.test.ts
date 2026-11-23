import { expect, it } from 'vitest';
import type { ShapeObject } from '../types';
import {
  arrangeBoxes,
  boxPosition,
  canArrangeObject,
  visualObjectBox,
  visualPageSize,
} from './arrangeObjects';

const shape: ShapeObject = {
  id: 'a',
  type: 'shape',
  page: 1,
  x: 100,
  y: 150,
  width: 100,
  height: 60,
  color: '#000000',
};
it('arranges inserted linked and column frames while retaining source replacements in their own editors', () => {
  const frame = {
    id: 'frame',
    type: 'text' as const,
    page: 1,
    x: 30,
    y: 30,
    width: 200,
    height: 160,
    text: 'Story',
    fontSize: 12,
    color: '#000000',
    nextTextId: 'next',
    columns: 2 as const,
  };
  expect(canArrangeObject(frame, [frame])).toBe(true);
  expect(canArrangeObject({ ...frame, cover: { width: 200, height: 160 } }, [])).toBe(false);
});
it('round-trips visual geometry through every rotation and crop offset', () => {
  for (const rotation of [0, 90, 180, 270, -90, 450]) {
    const bounds = { x: 40, y: 60, width: 400, height: 600, rotation };
    expect(boxPosition(visualObjectBox(shape, bounds), bounds)).toEqual({
      id: 'a',
      x: 100,
      y: 150,
    });
    const box = arrangeBoxes([visualObjectBox(shape, bounds)], bounds, 'right', 'page', 25)[0];
    expect(box.left + box.width).toBe(visualPageSize(bounds).width - 25);
  }
});
it('aligns to page insets or selection bounds and centers a group without changing its spacing', () => {
  const bounds = { x: 0, y: 0, width: 400, height: 600, rotation: 0 };
  const boxes = [
    { id: 'a', left: 20, top: 40, width: 50, height: 30 },
    { id: 'b', left: 120, top: 140, width: 80, height: 40 },
  ];
  expect(
    arrangeBoxes(boxes, bounds, 'bottom', 'selection', 20).map((box) => box.top + box.height),
  ).toEqual([180, 180]);
  expect(arrangeBoxes(boxes, bounds, 'left', 'page', 36).map((box) => box.left)).toEqual([36, 36]);
  const centered = arrangeBoxes(boxes, bounds, 'group', 'page', 36);
  expect(centered[1].left - centered[0].left).toBe(100);
  expect(centered[1].top - centered[0].top).toBe(100);
  expect((centered[0].left + centered[1].left + centered[1].width) / 2).toBe(200);
  expect(boxes[0].left).toBe(20);
});
it('distributes equal gaps with different object widths and rejects impossible arrangements', () => {
  const bounds = { x: 0, y: 0, width: 400, height: 600, rotation: 0 };
  const boxes = [
    { id: 'a', left: 20, top: 40, width: 50, height: 30 },
    { id: 'b', left: 100, top: 80, width: 80, height: 40 },
    { id: 'c', left: 200, top: 120, width: 30, height: 30 },
  ];
  const result = arrangeBoxes(boxes, bounds, 'horizontal', 'page', 20);
  expect(result.map((box) => box.left)).toEqual([20, 170, 350]);
  expect(() => arrangeBoxes(boxes.slice(0, 2), bounds, 'horizontal', 'page', 20)).toThrow('three');
  expect(() => arrangeBoxes(boxes, bounds, 'horizontal', 'page', 150)).toThrow('more space');
  expect(() => arrangeBoxes(boxes, bounds, 'left', 'page', NaN)).toThrow('inset');
});
