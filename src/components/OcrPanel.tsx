import { useRef, useState, useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';
import { exportPdf } from '../lib/export';
import { recognizePdf, type OcrProgress } from '../lib/ocr';

export function OcrPanel({ onClose }: { onClose: () => void }) {
  const { document, objects, pageSettings, setDocument, setNotice } = useAppStore();
  const [language, setLanguage] = useState('eng');
  const [progress, setProgress] = useState<OcrProgress>();
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController>();
  useEffect(() => () => controller.current?.abort(), []);
  const run = async () => {
    if (!document) return;
    const operation = new AbortController();
    controller.current = operation; setBusy(true); setProgress(undefined);
    try {
      const bytes = await exportPdf(document, objects, pageSettings);
      const current = { ...document, data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
      const result = await recognizePdf(current, language, setProgress, operation.signal);
      if (useAppStore.getState().document?.id !== document.id) throw new Error('The open document changed during OCR.');
      setDocument({ ...document, id: crypto.randomUUID(), data: result.buffer.slice(result.byteOffset, result.byteOffset + result.byteLength) as ArrayBuffer, size: result.byteLength });
      setNotice('OCR completed. Recognized text is searchable in this document.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'OCR failed.'); }
    finally { setBusy(false); controller.current = undefined; }
  };
  return <aside className="productivity-panel" aria-label="Offline OCR">
    <button disabled={busy} onClick={onClose}>Close</button><h2>Offline OCR</h2>
    <label>Recognition language<select aria-label="OCR language" value={language} disabled={busy} onChange={(event) => setLanguage(event.target.value)}><option value="eng">English</option><option value="spa">Spanish</option><option value="eng+spa">English and Spanish</option></select></label>
    <button disabled={!document || busy} onClick={() => void run()}>Recognize document</button>
    {busy && <button onClick={() => controller.current?.abort()}>Cancel OCR</button>}
    {progress && <><progress aria-label="OCR progress" value={(progress.page - 1 + progress.progress) / progress.pages} max="1" /><p>Page {progress.page} of {progress.pages} — {progress.status}</p></>}
  </aside>;
}
