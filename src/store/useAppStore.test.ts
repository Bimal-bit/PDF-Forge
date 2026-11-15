import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore';

describe('app history', () => {
  beforeEach(() => useAppStore.setState({ activeTab: 'Home', theme: 'light', zoom: 100, history: [], future: [] }));
  it('undoes and redoes a tracked zoom change', () => {
    useAppStore.getState().setZoom(140);
    expect(useAppStore.getState().zoom).toBe(140);
    useAppStore.getState().undo(); expect(useAppStore.getState().zoom).toBe(100);
    useAppStore.getState().redo(); expect(useAppStore.getState().zoom).toBe(140);
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
});
