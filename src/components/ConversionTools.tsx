import { useAppStore } from '../store/useAppStore';
import { exportPdf } from '../lib/export';
import { editedTextPages, exportDocx, exportXlsx, importDocument } from '../lib/conversion';
import { extractTables } from '../lib/advanced';
import { openPdf } from '../lib/pdf';
import { byteBlob, downloadBlob } from '../lib/downloads';
import type { ToolSession } from '../lib/toolSession';
import type { ToolRunner } from './useToolRunner';

async function convert(
  format: string,
  snapshot: ToolSession,
): Promise<{ blob: Blob; name: string }> {
  const { document, objects, pageSettings, selectedPage } = snapshot;
  if (!document) throw new Error('Open a PDF before exporting.');
  const name = document.name.replace(/\.pdf$/i, '');
  if (format === 'md' || format === 'docx') {
    const pages = await editedTextPages(document, objects, pageSettings);
    const blob =
      format === 'docx'
        ? await exportDocx(pages, objects)
        : new Blob([pages.join('\n\n---\n\n')], { type: 'text/markdown;charset=utf-8' });
    return { blob, name: `${name}.${format}` };
  }
  if (format === 'xlsx') {
    const tables = await extractTables(document, objects, pageSettings);
    if (!tables.length) throw new Error('No multi-run text table candidates were found.');
    return { blob: await exportXlsx(tables), name: `${name}.xlsx` };
  }
  const bytes = await exportPdf(document, objects, pageSettings);
  if (format === 'print') {
    const { PDFDocument, PrintScaling } = await import('pdf-lib');
    const print = await PDFDocument.load(bytes);
    print.getForm().flatten();
    print.catalog.getOrCreateViewerPreferences().setPrintScaling(PrintScaling.None);
    return {
      blob: byteBlob(await print.save({ useObjectStreams: true }), 'application/pdf'),
      name: `${name}-print.pdf`,
    };
  }
  const pdf = await openPdf({
    ...document,
    data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  });
  try {
    const files: Record<string, Uint8Array> = {};
    const pages =
      format === 'zip'
        ? Array.from({ length: pdf.numPages }, (_, index) => index + 1)
        : [selectedPage];
    for (const number of pages) {
      const page = await pdf.getPage(number),
        viewport = page.getViewport({ scale: 1.5 });
      const canvas = globalThis.document.createElement('canvas');
      try {
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        await page.render({ canvas, viewport }).promise;
        const mime =
          format === 'webp' ? 'image/webp' : format === 'jpg' ? 'image/jpeg' : 'image/png';
        const blob = await new Promise<Blob>((resolve, reject) =>
          canvas.toBlob(
            (value) => (value ? resolve(value) : reject(new Error('Image encoding failed.'))),
            mime,
            0.9,
          ),
        );
        if (blob.type !== mime)
          throw new Error(`This browser cannot encode ${format.toUpperCase()}. Try PNG or JPEG.`);
        if (format === 'zip')
          files[`${name}-page-${number}.png`] = new Uint8Array(await blob.arrayBuffer());
        else return { blob, name: `${name}-page-${number}.${format}` };
      } finally {
        canvas.width = 0;
        canvas.height = 0;
      }
    }
    const { zipSync } = await import('fflate');
    return { blob: byteBlob(zipSync(files), 'application/zip'), name: `${name}-pages.zip` };
  } finally {
    await pdf.loadingTask.destroy();
  }
}

export function ConversionTools({ runner }: { runner: ToolRunner }) {
  const { document, setDocument, setNotice } = useAppStore();
  return (
    <>
      <label className={`tools-file${runner.busy ? ' disabled' : ''}`}>
        Import document
        <input
          aria-label="Import document"
          type="file"
          accept=".png,.jpg,.jpeg,.webp,.txt,.md,.markdown,.html,.htm,.docx"
          disabled={Boolean(runner.busy)}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file) return;
            void runner.run(
              'Importing document',
              () => importDocument(file),
              (imported) => {
                setDocument(imported);
              },
            );
          }}
        />
      </label>
      {['md', 'docx', 'jpg', 'webp', 'xlsx', 'zip', 'print'].map((format) => (
        <button
          key={format}
          disabled={!document || Boolean(runner.busy)}
          onClick={() =>
            void runner.run(
              `Exporting ${format.toUpperCase()}`,
              (snapshot) => convert(format, snapshot),
              (result) => {
                downloadBlob(result.blob, result.name);
                setNotice(`${format.toUpperCase()} export downloaded.`);
              },
            )
          }
        >
          Export {format === 'print' ? 'print PDF' : format.toUpperCase()}
        </button>
      ))}
    </>
  );
}
