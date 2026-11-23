import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore';

describe('app history', () => {
  beforeEach(() => useAppStore.setState({ activeTab: 'Home', theme: 'light', zoom: 100, history: [], future: [] }));
  it('keeps viewing changes out of document history and preserves redo', () => {
    useAppStore.getState().setDocument({ id: 'view', name: 'view.pdf', size: 0, modifiedAt: 0, data: new ArrayBuffer(0) });
    useAppStore.getState().addTextObject();
    useAppStore.getState().undo();
    const { history, future } = useAppStore.getState();
    useAppStore.getState().setZoom(140);
    useAppStore.getState().setTheme('dark');
    useAppStore.getState().setTab('View');
    useAppStore.getState().toggleRightPanel();
    expect(useAppStore.getState().zoom).toBe(140);
    expect(useAppStore.getState().history).toBe(history);
    expect(useAppStore.getState().future).toBe(future);
    useAppStore.getState().redo(); expect(useAppStore.getState().objects).toHaveLength(1);
  });
  it('keeps page operations undoable', () => {
    useAppStore.getState().initializePages(3);
    useAppStore.getState().setSelectedPage(2);
    useAppStore.getState().duplicatePage();
    expect(useAppStore.getState().pageSettings.order).toEqual([1, 2, 2, 3]);
    useAppStore.getState().undo();
    expect(useAppStore.getState().pageSettings.order).toEqual([1, 2, 3]);
  });

  it('adds palette text to the selected source page after reordering', () => {
    useAppStore.getState().setDocument({ id: 'mapping', name: 'test.pdf', size: 0, modifiedAt: 0, data: new ArrayBuffer(0) });
    useAppStore.getState().initializePages(2);
    useAppStore.getState().movePage(1);
    useAppStore.getState().addTextObject();
    expect(useAppStore.getState().objects[0].page).toBe(1);
  });

  it('recovers edited workspace state and supports old document-only records', () => {
    const document = { id: 'recovery', name: 'old.pdf', size: 0, modifiedAt: 0, data: new ArrayBuffer(0) };
    useAppStore.getState().restoreDocument(document);
    expect(useAppStore.getState().objects).toEqual([]);
    useAppStore.getState().initializePages(2);
    useAppStore.getState().addTextObject();
    const { objects, pageSettings } = useAppStore.getState();
    useAppStore.getState().restoreDocument({ ...document, objects, pageSettings, selectedPage: 2 });
    expect(useAppStore.getState().objects).toEqual(objects);
    expect(useAppStore.getState().selectedPage).toBe(2);
    expect(useAppStore.getState().history).toEqual([]);
  });

  it('keeps imported annotations independently editable when IDs collide', () => {
    useAppStore.getState().setDocument({ id: 'annotations', name: 'test.pdf', size: 0, modifiedAt: 0, data: new ArrayBuffer(0) });
    const note = { id: 'shared', type: 'note' as const, page: 1, x: 20, y: 30, author: 'Ava', comment: 'First' };
    useAppStore.getState().importAnnotations([note]);
    useAppStore.getState().importAnnotations([{ ...note, comment: 'Second' }]);
    const [first, second] = useAppStore.getState().objects;
    expect(second.id).not.toBe(first.id);
    useAppStore.getState().removeObject(first.id);
    expect(useAppStore.getState().objects).toEqual([second]);
  });

  it('applies a matched group as one undoable change without copying source geometry', () => {
    useAppStore.getState().setDocument({ id: 'batch', name: 'batch.pdf', size: 0, modifiedAt: 0, data: new ArrayBuffer(0) });
    const seed = { id: 'seed', type: 'text' as const, page: 1, x: 30, y: 300, fontSize: 12, color: '#000000', text: 'Seed' };
    const addition = { ...seed, id: 'new', page: 2, text: 'Other page' };
    useAppStore.getState().addObject(seed);
    const historySize = useAppStore.getState().history.length;
    useAppStore.getState().formatTextObjects(['seed', 'new'], [addition], { bold: true, color: '#123456' });
    expect(useAppStore.getState().history).toHaveLength(historySize + 1);
    expect(useAppStore.getState().objects).toEqual([{ ...seed, bold: true, color: '#123456' }, { ...addition, bold: true, color: '#123456' }]);
    useAppStore.getState().undo();
    expect(useAppStore.getState().objects).toEqual([seed]);
    useAppStore.getState().redo();
    expect(useAppStore.getState().objects).toHaveLength(2);
  });

  it('tracks multiple selected text edits and source additions as one undoable change', () => {
    const document = { id: 'selection', name: 'selection.pdf', size: 0, modifiedAt: 0, data: new ArrayBuffer(0) };
    const existing = { id: 'existing', type: 'text' as const, page: 1, x: 30, y: 300, fontSize: 16, color: '#123456', text: 'First line' };
    const source = { ...existing, id: 'source', text: 'Second line', sourceText: 'Second line', y: 270 };
    useAppStore.getState().restoreDocument({ ...document, objects: [existing], trackChanges: true });
    useAppStore.getState().replaceTextObjects([{ id: 'existing', text: 'FIRST LINE' }, { id: 'source', text: 'SECOND LINE' }], [source]);
    expect(useAppStore.getState().objects).toEqual([{ ...existing, text: 'FIRST LINE' }, { ...source, text: 'SECOND LINE' }]);
    expect(useAppStore.getState().textChanges.map((change) => [change.before, change.after])).toEqual([['Second line', 'SECOND LINE'], ['First line', 'FIRST LINE']]);
    useAppStore.getState().undo();
    expect(useAppStore.getState().objects).toEqual([existing]);
    expect(useAppStore.getState().textChanges).toEqual([]);
    useAppStore.getState().redo();
    expect(useAppStore.getState().objects).toHaveLength(2);
  });
});
