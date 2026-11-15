import { produceWithPatches, applyPatches, enablePatches, type Patch } from 'immer';
import { create } from 'zustand';
import type { AppSnapshot, OpenDocument, RibbonTab, Theme } from '../types';

interface HistoryEntry { patches: Patch[]; inverse: Patch[] }
interface State extends AppSnapshot {
  document?: OpenDocument;
  isDragging: boolean;
  notice?: string;
  history: HistoryEntry[];
  future: HistoryEntry[];
  setDocument: (document: OpenDocument) => void;
  setTab: (tab: RibbonTab) => void;
  setTheme: (theme: Theme) => void;
  setZoom: (zoom: number) => void;
  setLeftPanel: (panel: AppSnapshot['leftPanel']) => void;
  setSelectedPage: (page: number) => void;
  setDragging: (isDragging: boolean) => void;
  toggleRightPanel: () => void;
  setNotice: (notice?: string) => void;
  undo: () => void;
  redo: () => void;
}

const initial: AppSnapshot = { activeTab: 'Home', theme: 'light', zoom: 100, leftPanel: 'thumbnails', rightPanelOpen: true, selectedPage: 1 };

enablePatches();

function tracked(set: (partial: State | Partial<State> | ((state: State) => State | Partial<State>)) => void, recipe: (draft: State) => void) {
  set((state) => {
    const [next, patches, inverse] = produceWithPatches(state, recipe);
    return { ...next, history: [...state.history, { patches, inverse }], future: [] };
  });
}

export const useAppStore = create<State>((set) => ({
  ...initial, history: [], future: [], isDragging: false,
  setDocument: (document) => tracked(set, (draft) => { draft.document = document; draft.notice = `${document.name} opened locally`; }),
  setTab: (activeTab) => tracked(set, (draft) => { draft.activeTab = activeTab; }),
  setTheme: (theme) => tracked(set, (draft) => { draft.theme = theme; }),
  setZoom: (zoom) => tracked(set, (draft) => { draft.zoom = Math.max(10, Math.min(500, zoom)); }),
  setLeftPanel: (leftPanel) => set({ leftPanel }),
  setSelectedPage: (selectedPage) => set({ selectedPage }),
  setDragging: (isDragging) => set({ isDragging }),
  toggleRightPanel: () => tracked(set, (draft) => { draft.rightPanelOpen = !draft.rightPanelOpen; }),
  setNotice: (notice) => set({ notice }),
  undo: () => set((state) => {
    const entry = state.history.at(-1); if (!entry) return state;
    const reverted = applyPatches(state, entry.inverse);
    return { ...reverted, history: state.history.slice(0, -1), future: [...state.future, entry] };
  }),
  redo: () => set((state) => {
    const entry = state.future.at(-1); if (!entry) return state;
    const redone = applyPatches(state, entry.patches);
    return { ...redone, history: [...state.history, entry], future: state.future.slice(0, -1) };
  }),
}));
