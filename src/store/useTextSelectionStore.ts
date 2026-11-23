import { create } from 'zustand';
import type { EditorObject, TextObject } from '../types';

export interface TextSelectionGroup {
  documentId: string;
  objects: EditorObject[];
  order: number[];
  ids: string[];
  additions: TextObject[];
  seed: TextObject;
  text: string;
  keys: string[];
}

export const useTextSelectionStore = create<{
  mode: 'edit' | 'select';
  busy: boolean;
  allRequested: number;
  group?: TextSelectionGroup;
  setMode: (mode: 'edit' | 'select') => void;
  setGroup: (group?: TextSelectionGroup) => void;
  setBusy: (busy: boolean) => void;
  selectAll: () => void;
  reset: () => void;
}>((set) => ({
  mode: 'edit',
  busy: false,
  allRequested: 0,
  setMode: (mode) => set({ mode, group: undefined, busy: false }),
  setGroup: (group) => set({ group }),
  setBusy: (busy) => set({ busy }),
  selectAll: () => set((state) => ({ mode: 'select', allRequested: state.allRequested + 1 })),
  reset: () => set({ mode: 'edit', busy: false, group: undefined, allRequested: 0 }),
}));
