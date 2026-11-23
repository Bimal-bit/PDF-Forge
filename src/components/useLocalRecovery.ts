import { useEffect, useState } from 'react';
import { loadLatestDocument, saveDocument } from '../lib/storage';
import { useAppStore } from '../store/useAppStore';

type Snapshot = ReturnType<typeof useAppStore.getState>;
function sameWorkspace(left: Snapshot, right: Snapshot) {
  return left.document === right.document && left.objects === right.objects &&
    left.pageSettings === right.pageSettings && left.selectedPage === right.selectedPage &&
    left.textChanges === right.textChanges && left.trackChanges === right.trackChanges &&
    left.changeAuthor === right.changeAuthor;
}

export function useLocalRecovery() {
  const { document: currentDocument, objects, pageSettings, selectedPage, textChanges, trackChanges, changeAuthor } = useAppStore();
  const [status, setStatus] = useState('Ready');
  useEffect(() => {
    let live = true;
    void loadLatestDocument().then((saved) => {
      if (live && saved && !useAppStore.getState().document) useAppStore.getState().restoreDocument(saved);
    }).catch(() => {
      if (live) useAppStore.getState().setNotice('Local recovery is unavailable in this browser.');
    });
    return () => { live = false; };
  }, []);
  useEffect(() => {
    setStatus(currentDocument ? 'Unsaved changes' : 'Ready');
  }, [currentDocument, objects, pageSettings, selectedPage, textChanges, trackChanges, changeAuthor]);
  useEffect(() => {
    let live = true;
    let saving = false;
    let requested = false;
    let saved: Snapshot | undefined;
    const persist = async () => {
      // Serialize saves; a hidden-page request during a write must save the latest edits next.
      if (saving) { requested = true; return; }
      const snapshot = useAppStore.getState();
      if (!snapshot.document) return;
      if (saved && sameWorkspace(saved, snapshot)) {
        if (live) setStatus('Saved locally');
        return;
      }
      saving = true;
      try {
        await saveDocument(snapshot.document, {
          objects: snapshot.objects, pageSettings: snapshot.pageSettings,
          selectedPage: snapshot.selectedPage, textChanges: snapshot.textChanges,
          trackChanges: snapshot.trackChanges, changeAuthor: snapshot.changeAuthor,
        });
        saved = snapshot;
        if (live && sameWorkspace(snapshot, useAppStore.getState())) setStatus('Saved locally');
      } catch {
        if (live && sameWorkspace(snapshot, useAppStore.getState())) setStatus('Local save failed');
      } finally {
        saving = false;
        if (live && requested) { requested = false; void persist(); }
      }
    };
    const flush = () => { void persist(); };
    const hidden = () => { if (document.visibilityState === 'hidden') flush(); };
    const timer = window.setInterval(flush, 5000);
    document.addEventListener('visibilitychange', hidden);
    window.addEventListener('pagehide', flush);
    return () => {
      live = false;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', hidden);
      window.removeEventListener('pagehide', flush);
    };
  }, []);
  return status;
}
