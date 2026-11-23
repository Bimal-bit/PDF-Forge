import type { AppSnapshot } from '../types';

export function applyReviewDecisions(
  snapshot: Pick<AppSnapshot, 'objects' | 'textChanges' | 'selectedObjectId'>,
  ids: string[],
  accept: boolean,
) {
  const selected = new Set(ids);
  const pending = snapshot.textChanges.filter(
    (change) => selected.has(change.id) && change.status === 'pending',
  );
  for (const change of pending) {
    const object = snapshot.objects.find((entry) => entry.id === change.objectId);
    if (object?.type !== 'text') continue;
    if (!accept) {
      if (change.removeOnReject) {
        for (const entry of snapshot.objects)
          if (entry.type === 'text' && entry.nextTextId === object.id)
            entry.nextTextId = object.nextTextId;
        snapshot.objects = snapshot.objects.filter((entry) => entry.id !== object.id);
        if (snapshot.selectedObjectId === object.id) snapshot.selectedObjectId = undefined;
      } else object.text = change.before;
    }
    change.status = accept ? 'accepted' : 'rejected';
  }
}
