import { produceWithPatches, applyPatches, enablePatches, type Patch } from 'immer';
import { create } from 'zustand';
import { getSavedTheme } from '../lib/theme';
import { linkTextFrames } from '../lib/textFlow';
import { recordTextChange } from '../lib/reviewChanges';
import { applyReviewDecisions } from '../lib/reviewDecisions';
import { supportedFormat } from '../lib/textFormatting';
import { boundedPage, boundedZoom } from '../lib/viewGeometry';
import type { FormValueChange } from '../lib/formImport';
import type { AnnotationObject, AppSnapshot, EditorObject, OpenDocument, PageSettings, RecoveryDocument, RibbonTab, TextFormat, TextObject, Theme } from '../types';

interface HistoryEntry { patches: Patch[]; inverse: Patch[] }
interface State extends AppSnapshot {
  document?: OpenDocument;
  isDragging: boolean;
  notice?: string;
  history: HistoryEntry[];
  future: HistoryEntry[];
  pageNavigationRequest: number;
  setDocument: (document: OpenDocument) => void;
  applyOcrDocument: (document: OpenDocument, objects: TextObject[], pageCount: number, selectedPage: number) => void;
  restoreDocument: (document: RecoveryDocument) => void;
  setTab: (tab: RibbonTab) => void;
  setTheme: (theme: Theme) => void;
  setZoom: (zoom: number) => void;
  setLeftPanel: (panel: AppSnapshot['leftPanel']) => void;
  setSelectedPage: (page: number) => void;
  initializePages: (count: number) => void;
  movePage: (direction: -1 | 1) => void;
  rotatePage: (direction?: -1 | 1) => void;
  deletePage: () => void;
  duplicatePage: () => void;
  updatePageSettings: (settings: Partial<Omit<PageSettings, 'order' | 'rotations'>>) => void;
  addTextObject: (page?: number) => void;
  updateTextObject: (id: string, text: string) => void;
  replaceTextObjects: (changes: { id: string; text: string }[], additions: TextObject[]) => void;
  addObject: (object: EditorObject) => void;
  addFormFields: (fields: import('../types').FormObject[]) => void;
  applyFormValues: (changes: FormValueChange[]) => void;
  importAnnotations: (annotations: AnnotationObject[]) => void;
  updateObject: (id: string, patch: Partial<EditorObject>) => void;
  positionObjects: (positions: { id: string; x: number; y: number }[]) => void;
  formatTextObjects: (ids: string[], additions: TextObject[], patch: Partial<TextFormat> & { fallback?: boolean; width?: number }) => void;
  selectObject: (id?: string) => void;
  linkTextObjects: (fromId: string, toId: string) => void;
  unlinkTextObject: (id: string) => void;
  setReviewOptions: (options: Partial<Pick<AppSnapshot, 'trackChanges' | 'changeAuthor'>>) => void;
  reviewTextChange: (id: string, accept: boolean) => void;
  reviewTextChanges: (ids: string[], accept: boolean) => void;
  removeObject: (id: string) => void;
  setDragging: (isDragging: boolean) => void;
  toggleRightPanel: () => void;
  setNotice: (notice?: string) => void;
  undo: () => void;
  redo: () => void;
}

const initial: AppSnapshot = { activeTab: 'Home', theme: getSavedTheme(), zoom: 100, leftPanel: 'thumbnails', rightPanelOpen: true, selectedPage: 1, objects: [], pageSettings: { order: [], rotations: {}, header: '', footer: '', watermark: '', batesStart: null }, trackChanges: false, changeAuthor: 'Local editor', textChanges: [] };

enablePatches();

function tracked(set: (partial: State | Partial<State> | ((state: State) => State | Partial<State>)) => void, recipe: (draft: State) => void) {
  set((state) => {
    const [next, patches, inverse] = produceWithPatches(state, recipe);
    return { ...next, history: [...state.history, { patches, inverse }], future: [] };
  });
}

export const useAppStore = create<State>((set) => ({
  ...initial, history: [], future: [], isDragging: false, pageNavigationRequest: 0,
  setDocument: (document) => tracked(set, (draft) => { draft.document = document; draft.objects = []; draft.textChanges = []; draft.pageSettings = { order: [], rotations: {}, header: '', footer: '', watermark: '', batesStart: null }; draft.selectedObjectId = undefined; draft.selectedPage = 1; draft.notice = `${document.name} opened locally`; }),
  applyOcrDocument: (document, objects, pageCount, selectedPage) => tracked(set, (draft) => {
    draft.document = document;
    draft.objects = objects;
    draft.textChanges = [];
    draft.pageSettings = { ...initial.pageSettings, order: Array.from({ length: pageCount }, (_, index) => index + 1) };
    draft.selectedPage = boundedPage(selectedPage, pageCount);
    draft.selectedObjectId = objects.find((object) => object.page === draft.selectedPage)?.id;
    draft.activeTab = 'Home';
  }),
  restoreDocument: (document) => set({ document, objects: document.objects ?? [], pageSettings: document.pageSettings ?? initial.pageSettings, selectedPage: document.selectedPage ?? 1, selectedObjectId: undefined, trackChanges: document.trackChanges ?? false, changeAuthor: document.changeAuthor ?? 'Local editor', textChanges: document.textChanges ?? [], history: [], future: [], notice: `${document.name} recovered locally` }),
  setTab: (activeTab) => set({ activeTab }),
  setTheme: (theme) => set({ theme }),
  setZoom: (zoom) => set((state) => ({ zoom: boundedZoom(zoom, state.zoom) })),
  setLeftPanel: (leftPanel) => set({ leftPanel }),
  setSelectedPage: (page) => set((state) => ({ selectedPage: boundedPage(page, state.pageSettings.order.length), pageNavigationRequest: state.pageNavigationRequest + 1 })),
  initializePages: (count) => set((state) => state.pageSettings.order.length ? state : { pageSettings: { ...state.pageSettings, order: Array.from({ length: count }, (_, index) => index + 1) } }),
  movePage: (direction) => tracked(set, (draft) => { const index = draft.selectedPage - 1; const target = index + direction; if (target < 0 || target >= draft.pageSettings.order.length) return; [draft.pageSettings.order[index], draft.pageSettings.order[target]] = [draft.pageSettings.order[target], draft.pageSettings.order[index]]; draft.selectedPage = target + 1; }),
  rotatePage: (direction = 1) => tracked(set, (draft) => { const source = draft.pageSettings.order[draft.selectedPage - 1]; if (!source) return; draft.pageSettings.rotations[source] = ((draft.pageSettings.rotations[source] ?? 0) + direction * 90 + 360) % 360; }),
  deletePage: () => tracked(set, (draft) => { if (draft.pageSettings.order.length < 2) return; draft.pageSettings.order.splice(draft.selectedPage - 1, 1); draft.selectedPage = Math.min(draft.selectedPage, draft.pageSettings.order.length); }),
  duplicatePage: () => tracked(set, (draft) => { const source = draft.pageSettings.order[draft.selectedPage - 1]; if (!source) return; draft.pageSettings.order.splice(draft.selectedPage, 0, source); draft.selectedPage += 1; }),
  updatePageSettings: (settings) => tracked(set, (draft) => { Object.assign(draft.pageSettings, settings); }),
  addTextObject: (page) => tracked(set, (draft) => { if (!draft.document) return; const id = crypto.randomUUID(); draft.selectedObjectId = id; draft.objects.push({ id, type: 'text', page: page ?? draft.pageSettings.order[draft.selectedPage - 1] ?? draft.selectedPage, text: 'Text overlay', x: 72, y: 72, fontSize: 14, color: '#d65737', width: 300 }); if (draft.trackChanges) recordTextChange(draft.textChanges, id, '', 'Text overlay', draft.changeAuthor, true); }),
  updateTextObject: (id, text) => tracked(set, (draft) => { const object = draft.objects.find((entry) => entry.id === id); if (object?.type === 'text') { if (draft.trackChanges || draft.textChanges.some((change) => change.objectId === id && change.status === 'pending')) recordTextChange(draft.textChanges, id, object.text, text, draft.changeAuthor); object.text = text; } }),
  addObject: (object) => tracked(set, (draft) => { draft.objects.push(object); draft.selectedObjectId = object.id; if (draft.trackChanges && object.type === 'text') recordTextChange(draft.textChanges, object.id, object.sourceText ?? '', object.text, draft.changeAuthor, true); }),
  replaceTextObjects: (changes, additions) => tracked(set, (draft) => {
    const values = new Map(changes.map((change) => [change.id, change.text]));
    for (const object of additions) {
      const text = values.get(object.id) ?? object.text;
      draft.objects.push({ ...object, text });
      if (draft.trackChanges) recordTextChange(draft.textChanges, object.id, object.sourceText ?? '', text, draft.changeAuthor, true);
      values.delete(object.id);
    }
    for (const object of draft.objects) {
      const text = values.get(object.id);
      if (object.type !== 'text' || text === undefined || text === object.text) continue;
      if (draft.trackChanges || draft.textChanges.some((change) => change.objectId === object.id && change.status === 'pending')) recordTextChange(draft.textChanges, object.id, object.text, text, draft.changeAuthor);
      object.text = text;
    }
  }),
  importAnnotations: (annotations) => tracked(set, (draft) => {
    const ids = new Set(draft.objects.map((object) => object.id));
    for (const annotation of annotations) {
      const object = { ...annotation, id: ids.has(annotation.id) ? crypto.randomUUID() : annotation.id };
      ids.add(object.id);
      draft.objects.push(object);
      draft.selectedObjectId = object.id;
    }
  }),
  addFormFields: (fields) => {
    const state = useAppStore.getState();
    const names = new Set(state.objects.filter((object) => object.type === 'form').map((object) => object.existingName));
    const additions = fields.filter((field) => field.existingName && !names.has(field.existingName) && state.pageSettings.order.includes(field.page));
    if (!additions.length) return;
    tracked(set, (draft) => { draft.objects.push(...additions); draft.selectedObjectId = additions.at(-1)?.id; });
  },
  applyFormValues: (changes) => {
    if (!changes.length) return;
    tracked(set, (draft) => {
      for (const change of changes) {
        const field = draft.objects.find((object) => object.id === change.id);
        if (!field || field.type !== 'form') throw new Error('A form field changed. Import the values again.');
        if (change.value !== undefined) field.value = change.value;
        if (change.checked !== undefined) field.checked = change.checked;
      }
    });
  },
  updateObject: (id, patch) => tracked(set, (draft) => { const object = draft.objects.find((entry) => entry.id === id); if (object) { if (object.type === 'text' && object.cover && ('x' in patch || 'y' in patch)) { object.cover.x ??= object.x; object.cover.y ??= object.y; } Object.assign(object, patch); } }),
  positionObjects: (positions) => {
    if (!positions.length) return;
    tracked(set, (draft) => {
      const targets = positions.map((position) => {
        const object = draft.objects.find((entry) => entry.id === position.id);
        if (!object || !('x' in object) || !Number.isFinite(position.x) || !Number.isFinite(position.y)) throw new Error('Choose existing objects with finite positions.');
        return { object, position };
      });
      for (const { object, position } of targets) {
        if (object.type === 'text' && object.cover) { object.cover.x ??= object.x; object.cover.y ??= object.y; }
        object.x = position.x; object.y = position.y;
      }
    });
  },
  formatTextObjects: (ids, additions, patch) => tracked(set, (draft) => {
    const targets = new Set(ids);
    draft.objects.push(...additions);
    for (const object of draft.objects) {
      if (object.type === 'text' && targets.has(object.id)) Object.assign(object, supportedFormat(object, patch, draft.objects));
    }
  }),
  selectObject: (selectedObjectId) => set({ selectedObjectId }),
  linkTextObjects: (fromId, toId) => tracked(set, (draft) => { linkTextFrames(draft.objects, fromId, toId); }),
  unlinkTextObject: (id) => tracked(set, (draft) => { const object = draft.objects.find((entry) => entry.id === id); if (object?.type === 'text') delete object.nextTextId; }),
  setReviewOptions: (options) => set(options),
  reviewTextChange: (id, accept) => useAppStore.getState().reviewTextChanges([id], accept),
  reviewTextChanges: (ids, accept) => {
    const state = useAppStore.getState();
    if (!state.textChanges.some((change) => ids.includes(change.id) && change.status === 'pending' && state.objects.some((object) => object.id === change.objectId && object.type === 'text'))) return;
    tracked(set, (draft) => applyReviewDecisions(draft, ids, accept));
  },
  removeObject: (id) => tracked(set, (draft) => {
    const removed = draft.objects.find((entry) => entry.id === id);
    for (const object of draft.objects) if (object.type === 'text' && object.nextTextId === id) object.nextTextId = removed?.type === 'text' ? removed.nextTextId : undefined;
    draft.objects = draft.objects.filter((object) => object.id !== id && !(object.type === 'connector' && (object.fromId === id || object.toId === id)));
    for (const change of draft.textChanges) if (change.objectId === id && change.status === 'pending') change.status = 'rejected';
  }),
  setDragging: (isDragging) => set({ isDragging }),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
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
