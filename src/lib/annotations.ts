import type { AnnotationObject, EditorObject } from '../types';
import type { InsertBounds } from './insertion';
import { assertInsertFits } from './insertion';

export function isAnnotation(object?: EditorObject): object is AnnotationObject {
  return Boolean(object && ['highlight', 'note', 'stamp', 'measure'].includes(object.type));
}

export function annotationTitle(object: AnnotationObject) {
  if (object.type === 'stamp') return object.label;
  if (object.type === 'measure') return measurementLabel(object);
  return object.comment || (object.type === 'highlight' ? 'Highlight' : 'Comment');
}

export function measurementLabel(annotation: Extract<AnnotationObject, { type: 'measure' }>) {
  const points = Math.hypot(annotation.width, annotation.height);
  if (annotation.units === 'in') return `${(points / 72).toFixed(2)} in`;
  if (annotation.units === 'cm') return `${(points / 28.3465).toFixed(2)} cm`;
  return `${points.toFixed(1)} pt`;
}

export function annotationBox(object: AnnotationObject) {
  if (object.type === 'measure')
    return {
      x: Math.min(object.x, object.x + object.width),
      y: Math.min(object.y, object.y + object.height) - 8,
      width: Math.max(1, Math.abs(object.width)),
      height: Math.abs(object.height) + 24,
    };
  const size =
    object.type === 'highlight'
      ? { width: object.width, height: object.height }
      : object.type === 'stamp'
        ? { width: 110, height: 32 }
        : { width: 22, height: 22 };
  return { x: object.x, y: object.y, ...size };
}

export function validateAnnotation(object: AnnotationObject, bounds?: InsertBounds) {
  if (
    ![object.page, object.x, object.y].every(Number.isFinite) ||
    !Number.isInteger(object.page) ||
    object.page < 1
  )
    throw new Error('Choose a valid page and finite annotation position.');
  if (object.type === 'highlight' || object.type === 'measure') {
    if (![object.width, object.height].every(Number.isFinite))
      throw new Error('Enter finite annotation dimensions.');
    if (object.type === 'highlight' && (object.width <= 0 || object.height <= 0))
      throw new Error('Highlight dimensions must be positive.');
    if (object.type === 'measure' && Math.hypot(object.width, object.height) === 0)
      throw new Error('A measurement needs two different endpoints.');
  }
  if (object.type === 'highlight' && !/^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(object.color))
    throw new Error('Choose a valid highlight color.');
  if (object.type === 'highlight' || object.type === 'note') {
    if (object.comment.length > 5000 || object.author.length > 100)
      throw new Error('Comments support 5000 characters and author names support 100.');
  }
  const box = annotationBox(object);
  if (bounds) assertInsertFits(bounds, box.x, box.y, box.width, box.height);
}
