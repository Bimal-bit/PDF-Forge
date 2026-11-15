import { useEffect } from 'react';
import { Panels } from './components/Panels';
import { Ribbon } from './components/Ribbon';
import { loadLatestDocument, saveDocument } from './lib/storage';
import { useAppStore } from './store/useAppStore';

export default function App() {
  const { document, setDocument, notice, setNotice, theme, undo, redo } = useAppStore();
  useEffect(() => { void loadLatestDocument().then((saved) => { if (saved && !useAppStore.getState().document) setDocument(saved); }); }, [setDocument]);
  useEffect(() => { if (!document) return; const timer = window.setInterval(() => { void saveDocument(document); }, 5000); return () => window.clearInterval(timer); }, [document]);
  useEffect(() => { const handleKeys = (event: KeyboardEvent) => { if (!event.ctrlKey && !event.metaKey) return; if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); } if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); } }; window.addEventListener('keydown', handleKeys); return () => window.removeEventListener('keydown', handleKeys); }, [undo, redo]);
  return <div className={`app theme-${theme}`}><Ribbon /><Panels />{notice && <button className="notice" onClick={() => setNotice(undefined)}>{notice}</button>}<footer><span>{document ? 'Saved locally' : 'Ready'}</span><span>100% private · no uploads</span></footer></div>;
}
