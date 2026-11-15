import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { exportPdf } from '../lib/export';
import { editedTextPages, exportDocx, exportXlsx, importDocument } from '../lib/conversion';
import { extractTables } from '../lib/advanced';
import { openPdf } from '../lib/pdf';

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = name; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ConversionTools() {
  const { document, objects, pageSettings, selectedPage, setDocument, setNotice } = useAppStore();
  const [busy, setBusy] = useState(false);
  const run = async (format: string) => {
    if (!document) return;
    setBusy(true);
    try {
      const name = document.name.replace(/\.pdf$/i, '');
      if (['md', 'docx'].includes(format)) {
        const pages = await editedTextPages(document, objects, pageSettings);
        const text = pages.join('\n\n---\n\n');
        const blob = format === 'docx' ? await exportDocx(pages, objects) : new Blob([text], { type: 'text/plain;charset=utf-8' });
        download(blob, `${name}.${format}`);
      } else {
        const bytes = await exportPdf(document, objects, pageSettings);
        const current = { ...document, data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
        if (format === 'xlsx') download(await exportXlsx(await extractTables(current)), `${name}.xlsx`);
        else if (format === 'print') {
          const { PDFDocument, PrintScaling } = await import('pdf-lib');
          const print = await PDFDocument.load(bytes);
          print.getForm().flatten();
          print.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
          const output = await print.save({ useObjectStreams: true });
          download(new Blob([output.buffer as ArrayBuffer], { type: 'application/pdf' }), `${name}-print.pdf`);
        }
        else {
          const pdf = await openPdf(current);
          try {
            const files: Record<string, Uint8Array> = {};
            const pages = format === 'zip' ? Array.from({ length: pdf.numPages }, (_, index) => index + 1) : [selectedPage];
            for (const number of pages) {
              const page = await pdf.getPage(number); const viewport = page.getViewport({ scale: 1.5 });
              const canvas = globalThis.document.createElement('canvas'); canvas.width = viewport.width; canvas.height = viewport.height;
              await page.render({ canvas, viewport }).promise;
              const mime = format === 'webp' ? 'image/webp' : format === 'jpg' ? 'image/jpeg' : 'image/png';
              const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Image encoding failed.')), mime, .9));
              if (format === 'zip') files[`${name}-page-${number}.png`] = new Uint8Array(await blob.arrayBuffer());
              else download(blob, `${name}-page-${number}.${format}`);
              canvas.width = 0; canvas.height = 0;
            }
            if (format === 'zip') {
              const { zipSync } = await import('fflate'); const zip = zipSync(files);
              download(new Blob([zip.buffer as ArrayBuffer], { type: 'application/zip' }), `${name}-pages.zip`);
            }
          } finally { await pdf.loadingTask.destroy(); }
        }
      }
      setNotice(`${format.toUpperCase()} export downloaded.`);
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Conversion failed.'); }
    finally { setBusy(false); }
  };
  return <>
    <label className="insert-image">Import document<input aria-label="Import document" type="file" accept=".png,.jpg,.jpeg,.webp,.txt,.md,.markdown,.html,.htm,.docx" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; setBusy(true); void importDocument(file).then(setDocument).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Import failed.')).finally(() => setBusy(false)); event.target.value = ''; }} /></label>
    {['md', 'docx', 'jpg', 'webp', 'xlsx', 'zip', 'print'].map((format) => <button key={format} disabled={!document || busy} onClick={() => void run(format)}>Export {format === 'print' ? 'print PDF' : format.toUpperCase()}</button>)}
  </>;
}
