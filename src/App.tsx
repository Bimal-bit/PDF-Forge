import { useEffect, useState } from 'react';
import { Welcome } from './components/Welcome';
import { Panels } from './components/Panels';
import { Ribbon } from './components/Ribbon';
import { loadLatestDocument, saveDocument } from './lib/storage';
import { useAppStore } from './store/useAppStore';
import { saveTheme } from './lib/theme';

export default function App() {
  const { document, objects, pageSettings, restoreDocument, notice, setNotice, theme, undo, redo } = useAppStore();
  const [saveStatus, setSaveStatus] = useState('Ready');
  useEffect(() => { saveTheme(theme); }, [theme]);
  useEffect(() => {
    let live = true;
    void loadLatestDocument().then((saved) => {
      if (live && saved && !useAppStore.getState().document) restoreDocument(saved);
    }).catch(() => {
      if (live) setNotice('Local recovery is unavailable in this browser.');
    });
    return () => { live = false; };
  }, [restoreDocument, setNotice]);

  useEffect(() => {
    setSaveStatus(document ? 'Unsaved changes' : 'Ready');
  }, [document, objects, pageSettings]);

  useEffect(() => {
    let saving = false;
    let live = true;
    const timer = window.setInterval(() => {
      const state = useAppStore.getState();
      if (!state.document || saving) return;
      saving = true;
      const snapshot = { objects: state.objects, pageSettings: state.pageSettings, selectedPage: state.selectedPage };
      void saveDocument(state.document, snapshot).then(() => {
        const current = useAppStore.getState();
        if (live && current.document === state.document && current.objects === state.objects && current.pageSettings === state.pageSettings) {
          setSaveStatus('Saved locally');
        }
      }).catch(() => {
        if (live) setSaveStatus('Local save failed');
      }).finally(() => { saving = false; });
    }, 5000);
    return () => { live = false; window.clearInterval(timer); };
  }, []);
  useEffect(() => { const handleKeys = (event: KeyboardEvent) => { if (!event.ctrlKey && !event.metaKey) return; if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable=true]')) return; if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); } if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); } }; window.addEventListener('keydown', handleKeys); return () => window.removeEventListener('keydown', handleKeys); }, [undo, redo]);
  return <div className={`app theme-${theme}${document ? '' : ' app-welcome'}`}>
    {document ? <><Ribbon /><Panels /><footer><span role="status">{saveStatus}</span><span>100% private · no uploads</span></footer></> : <Welcome />}
    {notice && <button className="notice" role="alert" onClick={() => setNotice(undefined)}>{notice}</button>}
  </div>;
}
