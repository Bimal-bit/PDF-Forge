import type { TextObject } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useTextEditStore } from '../store/useTextEditStore';
import { useTextSelectionStore, type TextSelectionGroup } from '../store/useTextSelectionStore';

export function captureTextScope(selected: TextObject, group?: TextSelectionGroup) {
  const state = useAppStore.getState();
  if (!state.document) throw new Error('Open a PDF before editing text.');
  if (
    group &&
    (group.objects !== state.objects ||
      group.order !== state.pageSettings.order ||
      group.documentId !== state.document.id)
  )
    throw new Error('Select the text again before opening this tool.');
  const draft = useTextEditStore.getState().draft;
  const targets = group
    ? group.ids
        .map(
          (id) =>
            state.objects.find((object) => object.id === id) ??
            group.additions.find((object) => object.id === id),
        )
        .filter((object): object is TextObject => object?.type === 'text')
    : [
        state.objects.find(
          (object): object is TextObject => object.type === 'text' && object.id === selected.id,
        ) ?? (draft?.id === selected.id ? draft : selected),
      ];
  return {
    document: state.document,
    objects: state.objects,
    order: state.pageSettings.order,
    targets,
    group,
  };
}

export type TextToolScope = ReturnType<typeof captureTextScope>;

export function applyTextScope(scope: TextToolScope, transform: (text: string) => string) {
  const state = useAppStore.getState();
  if (
    state.document !== scope.document ||
    state.objects !== scope.objects ||
    state.pageSettings.order !== scope.order ||
    (scope.group && useTextSelectionStore.getState().group !== scope.group)
  )
    throw new Error('The document or selection changed. Reopen this tool to use the current text.');
  const changes = scope.targets
    .map((object) => ({ id: object.id, text: transform(object.text) }))
    .filter((change, index) => change.text !== scope.targets[index].text);
  if (!changes.length) return 0;
  const ids = new Set(changes.map((change) => change.id));
  const additions = scope.targets.filter(
    (object) => ids.has(object.id) && !state.objects.some((entry) => entry.id === object.id),
  );
  state.replaceTextObjects(changes, additions);
  useTextEditStore.getState().setDraft(undefined);
  if (scope.group) {
    const current = useAppStore.getState().objects;
    useTextSelectionStore.getState().setGroup({
      ...scope.group,
      objects: current,
      additions: scope.group.additions.filter((object) => !ids.has(object.id)),
      seed:
        current.find(
          (object): object is TextObject =>
            object.type === 'text' && object.id === scope.group!.seed.id,
        ) ?? scope.group.seed,
      text: scope.targets
        .map((object) => changes.find((change) => change.id === object.id)?.text ?? object.text)
        .join('\n'),
    });
  }
  return changes.length;
}
