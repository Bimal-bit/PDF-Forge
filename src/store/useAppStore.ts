import { produceWithPatches, applyPatches, enablePatches, type Patch } from 'immer';
import { create } from 'zustand';
import type { AnnotationObject, AppSnapshot, EditorObject, OpenDocument, PageSettings, RecoveryDocument, RibbonTab, Theme } from '../types';

interface HistoryEntry { patches: Patch[]; inverse: Patch[] }
interface State extends AppSnapshot {
  document?: OpenDocument;
  isDragging: boolean;
  notice?: string;
  history: HistoryEntry[];
  future: HistoryEntry[];
  setDocument: (document: OpenDocument) => void;
  restoreDocument: (document: RecoveryDocument) => void;
  setTab: (tab: RibbonTab) => void;
  setTheme: (theme: Theme) => void;
  setZoom: (zoom: number) => void;
  setLeftPanel: (panel: AppSnapshot['leftPanel']) => void;
  setSelectedPage: (page: number) => void;
  initializePages: (count: number) => void;
  movePage: (direction: -1 | 1) => void;
  rotatePage: () => void;
  deletePage: () => void;
  duplicatePage: () => void;
  updatePageSettings: (settings: Partial<Omit<PageSettings, 'order' | 'rotations'>>) => void;
  addTextObject: (page?: number) => void;
  updateTextObject: (id: string, text: string) => void;
  addObject: (object: EditorObject) => void;
  importAnnotations: (annotations: AnnotationObject[]) => void;
  updateObject: (id: string, patch: Partial<EditorObject>) => void;
  selectObject: (id?: string) => void;
  removeObject: (id: string) => void;
  setDragging: (isDragging: boolean) => void;
  toggleRightPanel: () => void;
  setNotice: (notice?: string) => void;
  undo: () => void;
  redo: () => void;
}

const initial: AppSnapshot = { activeTab: 'Home', theme: 'light', zoom: 100, leftPanel: 'thumbnails', rightPanelOpen: true, selectedPage: 1, objects: [], pageSettings: { order: [], rotations: {}, header: '', footer: '', watermark: '', batesStart: null } };

enablePatches();

function tracked(set: (partial: State | Partial<State> | ((state: State) => State | Partial<State>)) => void, recipe: (draft: State) => void) {
  set((state) => {
    const [next, patches, inverse] = produceWithPatches(state, recipe);
    return { ...next, history: [...state.history, { patches, inverse }], future: [] };
  });
}

export const useAppStore = create<State>((set) => ({
  ...initial, history: [], future: [], isDragging: false,
  setDocument: (document) => tracked(set, (draft) => { draft.document = document; draft.objects = []; draft.pageSettings = { order: [], rotations: {}, header: '', footer: '', watermark: '', batesStart: null }; draft.selectedObjectId = undefined; draft.selectedPage = 1; draft.notice = `${document.name} opened locally`; }),
  restoreDocument: (document) => set({ document, objects: document.objects ?? [], pageSettings: document.pageSettings ?? initial.pageSettings, selectedPage: document.selectedPage ?? 1, selectedObjectId: undefined, history: [], future: [], notice: `${document.name} recovered locally` }),
  setTab: (activeTab) => tracked(set, (draft) => { draft.activeTab = activeTab; }),
  setTheme: (theme) => tracked(set, (draft) => { draft.theme = theme; }),
  setZoom: (zoom) => tracked(set, (draft) => { draft.zoom = Math.max(10, Math.min(500, zoom)); }),
  setLeftPanel: (leftPanel) => set({ leftPanel }),
  setSelectedPage: (selectedPage) => set({ selectedPage }),
  initializePages: (count) => set((state) => state.pageSettings.order.length ? state : { pageSettings: { ...state.pageSettings, order: Array.from({ length: count }, (_, index) => index + 1) } }),
  movePage: (direction) => tracked(set, (draft) => { const index = draft.selectedPage - 1; const target = index + direction; if (target < 0 || target >= draft.pageSettings.order.length) return; [draft.pageSettings.order[index], draft.pageSettings.order[target]] = [draft.pageSettings.order[target], draft.pageSettings.order[index]]; draft.selectedPage = target + 1; }),
  rotatePage: () => tracked(set, (draft) => { const source = draft.pageSettings.order[draft.selectedPage - 1]; if (!source) return; draft.pageSettings.rotations[source] = ((draft.pageSettings.rotations[source] ?? 0) + 90) % 360; }),
  deletePage: () => tracked(set, (draft) => { if (draft.pageSettings.order.length < 2) return; draft.pageSettings.order.splice(draft.selectedPage - 1, 1); draft.selectedPage = Math.min(draft.selectedPage, draft.pageSettings.order.length); }),
  duplicatePage: () => tracked(set, (draft) => { const source = draft.pageSettings.order[draft.selectedPage - 1]; if (!source) return; draft.pageSettings.order.splice(draft.selectedPage, 0, source); draft.selectedPage += 1; }),
  updatePageSettings: (settings) => tracked(set, (draft) => { Object.assign(draft.pageSettings, settings); }),
  addTextObject: (page) => tracked(set, (draft) => { if (!draft.document) return; const id = crypto.randomUUID(); draft.selectedObjectId = id; draft.objects.push({ id, type: 'text', page: page ?? draft.pageSettings.order[draft.selectedPage - 1] ?? draft.selectedPage, text: 'Text overlay', x: 72, y: 72, fontSize: 14, color: '#d65737', width: 300 }); }),
  updateTextObject: (id, text) => tracked(set, (draft) => { const object = draft.objects.find((entry) => entry.id === id); if (object?.type === 'text') object.text = text; }),
  addObject: (object) => tracked(set, (draft) => { draft.objects.push(object); draft.selectedObjectId = object.id; }),
  importAnnotations: (annotations) => tracked(set, (draft) => {
    const ids = new Set(draft.objects.map((object) => object.id));
    for (const annotation of annotations) {
      const object = { ...annotation, id: ids.has(annotation.id) ? crypto.randomUUID() : annotation.id };
      ids.add(object.id);
      draft.objects.push(object);
      draft.selectedObjectId = object.id;
    }
  }),
  updateObject: (id, patch) => tracked(set, (draft) => { const object = draft.objects.find((entry) => entry.id === id); if (object) Object.assign(object, patch); }),
  selectObject: (selectedObjectId) => set({ selectedObjectId }),
  removeObject: (id) => tracked(set, (draft) => { draft.objects = draft.objects.filter((object) => object.id !== id); }),
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
