import { useAppStore } from '../store/useAppStore';
import { useTextEditStore } from '../store/useTextEditStore';
import { useTextSelectionStore } from '../store/useTextSelectionStore';
import { revealTextObject } from './revealTextObject';

export function finishInsertion() {
  useTextSelectionStore.getState().setMode('edit');
  useTextEditStore.getState().setDraft(undefined);
  window.getSelection()?.removeAllRanges();
  const state = useAppStore.getState();
  revealTextObject(state.selectedObjectId, state.selectedPage);
}
