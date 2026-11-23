import type { EditorObject } from '../types';
import { useAppStore } from '../store/useAppStore';
import { finishInsertion } from './insertionEffects';

export function goToReviewObject(object: EditorObject) {
  const state = useAppStore.getState();
  const index =
    state.pageSettings.order[state.selectedPage - 1] === object.page
      ? state.selectedPage - 1
      : state.pageSettings.order.indexOf(object.page);
  if (index < 0) return false;
  state.selectObject(object.id);
  state.setSelectedPage(index + 1);
  finishInsertion();
  return true;
}
