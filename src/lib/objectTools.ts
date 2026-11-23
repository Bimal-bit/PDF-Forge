import type { EditorObject } from '../types';
import { equationLayout } from './equations';
import { assertInsertFits, type InsertBounds } from './insertion';
import { blockTextGeometry } from './textLayout';
import { measureFlowText } from './textFlow';
import { currentTableMetrics } from './tableLayout';

export type ManagedObject = Extract<
  EditorObject,
  { type: 'text' | 'shape' | 'image' | 'table' | 'link' | 'form' | 'equation' }
>;
export function canManageObject(
  object: EditorObject | undefined,
  objects: EditorObject[],
): object is ManagedObject {
  if (!object) return false;
  if (object.type === 'text')
    return (
      Boolean(object.width) &&
      !object.sourceLayout &&
      !object.cover &&
      object.sourceText === undefined &&
      !object.nextTextId &&
      (object.columns ?? 1) === 1 &&
      !object.dropCapLines &&
      !objects.some((entry) => entry.type === 'text' && entry.nextTextId === object.id)
    );
  if (object.type === 'form') return !object.existingName;
  return ['shape', 'image', 'table', 'link', 'equation'].includes(object.type);
}

export function objectSize(object: ManagedObject) {
  if (object.type === 'text') {
    const geometry = blockTextGeometry(object, (text) => measureFlowText(object, text));
    return {
      width:
        object.width ??
        Math.max(1, ...geometry.lines.map((line) => line.x - object.x + line.width)),
      height: geometry.height,
    };
  }
  if (object.type === 'link') {
    const metrics = currentTableMetrics(object);
    return { width: metrics.measure(object.label, object.fontSize), height: object.fontSize * 1.3 };
  }
  if (object.type === 'equation') {
    const math = equationLayout(object.latex, object.fontSize);
    return { width: math.width, height: math.ascent + math.descent };
  }
  return { width: object.width, height: object.height };
}

export function positionedCopy(object: ManagedObject, bounds: InsertBounds): ManagedObject {
  const size = objectSize(object);
  const x = Math.max(bounds.x, Math.min(bounds.x + bounds.width - size.width, object.x + 20));
  const y = Math.max(bounds.y, Math.min(bounds.y + bounds.height - size.height, object.y - 20));
  assertInsertFits(bounds, x, y, size.width, size.height);
  return { ...structuredClone(object), id: crypto.randomUUID(), x, y };
}
