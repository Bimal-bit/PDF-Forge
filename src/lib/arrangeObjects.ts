import type { InsertBounds } from './insertion';
import { assertInsertFits } from './insertion';
import { canManageObject, objectSize, type ManagedObject } from './objectTools';
import type { EditorObject } from '../types';

export function canArrangeObject(
  object: EditorObject,
  objects: EditorObject[],
): object is ManagedObject {
  return (
    (object.type === 'text' &&
      Boolean(object.width) &&
      object.height !== undefined &&
      !object.cover &&
      !object.sourceLayout) ||
    canManageObject(object, objects)
  );
}

export type ArrangeAction =
  'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom' | 'horizontal' | 'vertical' | 'group';
export interface VisualBox {
  id: string;
  left: number;
  top: number;
  width: number;
  height: number;
}
const rotation = (bounds: InsertBounds) => ((bounds.rotation % 360) + 360) % 360;

export function visualPageSize(bounds: InsertBounds) {
  const sideways = rotation(bounds) % 180 !== 0;
  return {
    width: sideways ? bounds.height : bounds.width,
    height: sideways ? bounds.width : bounds.height,
  };
}

export function visualObjectBox(object: ManagedObject, bounds: InsertBounds): VisualBox {
  const size = objectSize(object),
    angle = rotation(bounds);
  const x = object.x - bounds.x,
    y = object.y - bounds.y;
  if (angle === 90)
    return { id: object.id, left: y, top: x, width: size.height, height: size.width };
  if (angle === 180) return { id: object.id, left: bounds.width - x - size.width, top: y, ...size };
  if (angle === 270)
    return {
      id: object.id,
      left: bounds.height - y - size.height,
      top: bounds.width - x - size.width,
      width: size.height,
      height: size.width,
    };
  return { id: object.id, left: x, top: bounds.height - y - size.height, ...size };
}

export function boxPosition(box: VisualBox, bounds: InsertBounds) {
  const angle = rotation(bounds);
  if (angle === 90) return { id: box.id, x: bounds.x + box.top, y: bounds.y + box.left };
  if (angle === 180)
    return { id: box.id, x: bounds.x + bounds.width - box.left - box.width, y: bounds.y + box.top };
  if (angle === 270)
    return {
      id: box.id,
      x: bounds.x + bounds.width - box.top - box.height,
      y: bounds.y + bounds.height - box.left - box.width,
    };
  return { id: box.id, x: bounds.x + box.left, y: bounds.y + bounds.height - box.top - box.height };
}

function extent(boxes: VisualBox[]) {
  const left = Math.min(...boxes.map((box) => box.left)),
    top = Math.min(...boxes.map((box) => box.top));
  return {
    left,
    top,
    width: Math.max(...boxes.map((box) => box.left + box.width)) - left,
    height: Math.max(...boxes.map((box) => box.top + box.height)) - top,
  };
}

export function arrangeBoxes(
  boxes: VisualBox[],
  bounds: InsertBounds,
  action: ArrangeAction,
  relative: 'page' | 'selection',
  inset: number,
) {
  if (!boxes.length) throw new Error('Choose at least one object.');
  const page = visualPageSize(bounds);
  if (!Number.isFinite(inset) || inset < 0 || inset * 2 >= Math.min(page.width, page.height))
    throw new Error('Reduce the page inset to leave room for the objects.');
  const group = extent(boxes);
  const target =
    relative === 'page' || action === 'group'
      ? { left: inset, top: inset, width: page.width - inset * 2, height: page.height - inset * 2 }
      : group;
  let result = boxes.map((box) => ({ ...box }));
  if (action === 'group') {
    if (group.width > target.width || group.height > target.height)
      throw new Error(
        'The group is larger than the inset area. Reduce the inset or resize its objects.',
      );
    result = result.map((box) => ({
      ...box,
      left: box.left + target.left + (target.width - group.width) / 2 - group.left,
      top: box.top + target.top + (target.height - group.height) / 2 - group.top,
    }));
  } else if (action === 'horizontal' || action === 'vertical') {
    if (boxes.length < 3) throw new Error('Choose at least three objects to distribute.');
    const axis = action === 'horizontal' ? 'left' : 'top',
      dimension = action === 'horizontal' ? 'width' : 'height';
    result.sort((a, b) => a[axis] - b[axis]);
    const gap =
      (target[dimension] - result.reduce((sum, box) => sum + box[dimension], 0)) /
      (result.length - 1);
    if (gap < 0)
      throw new Error(
        'The objects need more space for equal gaps. Use Page or reduce their sizes.',
      );
    let cursor = target[axis];
    result = result.map((box) => {
      const next = { ...box, [axis]: cursor };
      cursor += box[dimension] + gap;
      return next;
    });
  } else {
    result = result.map((box) => {
      if (action === 'left') box.left = target.left;
      if (action === 'center') box.left = target.left + (target.width - box.width) / 2;
      if (action === 'right') box.left = target.left + target.width - box.width;
      if (action === 'top') box.top = target.top;
      if (action === 'middle') box.top = target.top + (target.height - box.height) / 2;
      if (action === 'bottom') box.top = target.top + target.height - box.height;
      return box;
    });
  }
  for (const box of result) {
    const point = boxPosition(box, bounds),
      sideways = rotation(bounds) % 180 !== 0;
    assertInsertFits(
      bounds,
      point.x,
      point.y,
      sideways ? box.height : box.width,
      sideways ? box.width : box.height,
    );
  }
  return result;
}
