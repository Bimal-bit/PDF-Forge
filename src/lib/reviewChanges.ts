import type { TextChange } from '../types';

export function recordTextChange(
  changes: TextChange[],
  objectId: string,
  before: string,
  after: string,
  author: string,
  removeOnReject = false,
) {
  if (before === after) return;
  const name = author.trim() || 'Local editor';
  const pending = changes.find(
    (change) => change.objectId === objectId && change.status === 'pending',
  );
  if (pending) {
    pending.after = after;
    pending.lastAt = Date.now();
    if (!pending.authors.includes(name)) pending.authors.push(name);
    if (pending.before === after && !pending.removeOnReject)
      changes.splice(changes.indexOf(pending), 1);
  } else
    changes.push({
      id: crypto.randomUUID(),
      objectId,
      authors: [name],
      at: Date.now(),
      lastAt: Date.now(),
      before,
      after,
      removeOnReject,
      status: 'pending',
    });
}
