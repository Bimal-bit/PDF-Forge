import { useEffect, useState } from 'react';
import type { EditorObject, OpenDocument } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useTextSelectionStore } from '../store/useTextSelectionStore';
import { useTextEditStore } from '../store/useTextEditStore';
import {
  insertionBounds,
  insertionPoint,
  type InsertBounds,
  type InsertPosition,
} from '../lib/insertion';
import { revealTextObject } from './revealTextObject';

export function useInsertion(position: InsertPosition) {
  const { document, selectedPage, pageSettings, objects, setNotice } = useAppStore();
  const sourcePage = pageSettings.order[selectedPage - 1] ?? selectedPage;
  const [loaded, setLoaded] = useState<{
    document: OpenDocument;
    page: number;
    bounds: InsertBounds;
  }>();
  useEffect(() => {
    if (!document) return;
    let live = true;
    void insertionBounds(document, sourcePage)
      .then((bounds) => {
        if (live) setLoaded({ document, page: sourcePage, bounds });
      })
      .catch(() => {
        if (live) setNotice('Could not read this page for insertion.');
      });
    return () => {
      live = false;
    };
  }, [document, sourcePage, setNotice]);
  const bounds =
    loaded && loaded.document === document && loaded.page === sourcePage
      ? {
          ...loaded.bounds,
          rotation: loaded.bounds.rotation + (pageSettings.rotations[sourcePage] ?? 0),
        }
      : undefined;
  const point = (width: number, height: number) =>
    insertionPoint(
      bounds!,
      width,
      height,
      position,
      objects.filter((object) => object.page === sourcePage).length,
    );
  const current = () => {
    const state = useAppStore.getState();
    return (
      state.document === document &&
      state.selectedPage === selectedPage &&
      (state.pageSettings.order[selectedPage - 1] ?? selectedPage) === sourcePage &&
      state.pageSettings.rotations[sourcePage] === pageSettings.rotations[sourcePage]
    );
  };
  const commit = (object: EditorObject, previous?: EditorObject) => {
    const state = useAppStore.getState();
    if (!current())
      throw new Error('The document or page changed. Reopen the insertion tool and try again.');
    if (previous && state.objects.find((entry) => entry.id === previous.id) !== previous)
      throw new Error('This object changed. Reopen its editor to use the latest version.');
    useTextSelectionStore.getState().setMode('edit');
    useTextEditStore.getState().setDraft(undefined);
    window.getSelection()?.removeAllRanges();
    if (previous) state.updateObject(previous.id, object);
    else state.addObject(object);
    state.selectObject(object.id);
    revealTextObject(object.id, selectedPage);
  };
  return {
    document,
    bounds,
    sourcePage,
    selectedPage,
    total: pageSettings.order.length,
    point,
    commit,
    current,
  };
}

export type InsertionContext = ReturnType<typeof useInsertion>;
