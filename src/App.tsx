import { useEffect } from 'react';
import { Welcome } from './components/Welcome';
import { Panels } from './components/Panels';
import { Ribbon } from './components/Ribbon';
import { useAppStore } from './store/useAppStore';
import { saveTheme } from './lib/theme';
import { useLocalRecovery } from './components/useLocalRecovery';

export default function App() {
  const { document, notice, setNotice, theme, undo, redo } = useAppStore();
  const saveStatus = useLocalRecovery();
  useEffect(() => { saveTheme(theme); }, [theme]);
  useEffect(() => {
    const handleKeys = (event: KeyboardEvent) => {
      if (event.defaultPrevented || (!event.ctrlKey && !event.metaKey)) return;
      if (globalThis.document.querySelector('dialog[open], .command-backdrop')) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable=true]')) return;
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      }
      if (event.key.toLowerCase() === 'y') { event.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', handleKeys);
    return () => window.removeEventListener('keydown', handleKeys);
  }, [undo, redo]);
  return <div className={`app theme-${theme}${document ? '' : ' app-welcome'}`}>
    {document ? <><a className="skip-link" href="#document-canvas">Skip to document</a><Ribbon /><Panels /><footer><span role="status">{saveStatus}</span><span>100% private · no uploads</span></footer></> : <Welcome />}
    {notice && <button className="notice" role="alert" onClick={() => setNotice(undefined)}>{notice}</button>}
  </div>;
}
