import { useEffect, useRef, useState } from 'react';
import type { TextObject, TextFormat, EditorObject } from '../types';
import { findSimilarText } from '../lib/smartTextMatch';
import { useAppStore } from '../store/useAppStore';

interface MatchGroup {
  seed: string;
  documentId: string;
  objects: EditorObject[];
  order: number[];
  ids: string[];
  additions: TextObject[];
}

export function useSmartTextMatch(selected?: TextObject) {
  const {
    document,
    objects,
    pageSettings,
    formatTextObjects,
    updateObject,
    selectObject,
    setNotice,
  } = useAppStore();
  const [group, setGroup] = useState<MatchGroup>();
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController>();
  useEffect(() => () => controller.current?.abort(), []);
  const active =
    group?.seed === selected?.id &&
    group?.documentId === document?.id &&
    group?.objects === objects &&
    group?.order === pageSettings.order
      ? group
      : undefined;
  useEffect(() => {
    if (group && !active) setGroup(undefined);
  }, [group, active]);
  const update = (patch: Partial<TextFormat> & { fallback?: boolean; width?: number }) => {
    if (!selected) return;
    if (!active) return updateObject(selected.id, patch);
    formatTextObjects(active.ids, active.additions, patch);
    setGroup({ ...active, additions: [], objects: useAppStore.getState().objects });
  };
  const match = async () => {
    if (active) {
      setGroup(undefined);
      return;
    }
    if (!document || !selected || busy) return;
    selectObject(selected.id);
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    try {
      const result = await findSimilarText(document, selected, objects, pageSettings, abort.signal);
      const current = useAppStore.getState();
      if (abort.signal.aborted) return;
      if (
        current.document !== document ||
        current.objects !== objects ||
        current.pageSettings.order !== pageSettings.order ||
        current.selectedObjectId !== selected.id
      ) {
        setNotice('The document changed during matching. Run Smart text match again.');
        return;
      }
      setGroup({
        ...result,
        seed: selected.id,
        documentId: document.id,
        objects,
        order: pageSettings.order,
      });
      setNotice(
        `${result.ids.length} text block${result.ids.length === 1 ? '' : 's'} matched. Formatting now applies to this group.`,
      );
    } catch {
      if (!abort.signal.aborted) setNotice('Could not match text in this PDF.');
    } finally {
      if (!abort.signal.aborted) setBusy(false);
    }
  };
  return { update, match, busy, matchCount: active?.ids.length };
}
