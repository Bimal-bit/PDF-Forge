import { create } from 'zustand';
import type { TextObject } from '../types';

// A source selection can show its formatting before it becomes a document edit.
// Drafts are transient: they never enter recovery or undo history.
export const useTextEditStore = create<{
  draft?: TextObject;
  setDraft: (draft?: TextObject) => void;
}>((set) => ({ setDraft: (draft) => set({ draft }) }));
