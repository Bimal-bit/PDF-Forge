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
});
