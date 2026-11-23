import { useAppStore } from '../store/useAppStore';
import { downloadPdf, exportDocument, exportPdf, mergePdfs } from '../lib/export';
import {
  compareDocuments,
  extractTables,
  optimizePdf,
  renderPagePng,
  tablesToCsv,
  textToHtml,
} from '../lib/advanced';
import { toPdfDocument } from '../lib/file';
import { detectFormFields, formData } from '../lib/formFields';
import { exportMailMerge, parseCsv } from '../lib/forms';
import { editedTextPages } from '../lib/conversion';
import { secureExport } from '../lib/secureExport';
import { decryptPdfPackage, encryptPdfPackage } from '../lib/security';
import { byteBlob, downloadBlob } from '../lib/downloads';

import type { FormObject } from '../types';
import type { ToolRunner } from './useToolRunner';
import type { ComparisonResult } from './ComparisonReport';

export function useToolsActions(
  runner: ToolRunner,
  onComparison: (result: ComparisonResult) => void,
) {
  const notice = useAppStore((state) => state.setNotice);
  const run = (tool: string) => {
    if (tool === 'Detect form fields')
      return runner.run(
        'Detecting form fields',
        (snapshot) => detectFormFields(snapshot.document!),
        (fields) => {
          const state = useAppStore.getState(),
            before = state.objects.length;
          state.addFormFields(fields);
          notice(`${useAppStore.getState().objects.length - before} new existing fields detected.`);
        },
      );
    if (tool === 'Export form JSON') {
      const state = useAppStore.getState();
      const fields = state.objects.filter(
        (object): object is FormObject =>
          object.type === 'form' &&
          object.kind !== 'button' &&
          state.pageSettings.order.includes(object.page),
      );
      downloadBlob(
        new Blob([JSON.stringify(formData(fields), null, 2)], { type: 'application/json' }),
        'form-data.json',
      );
      return;
    }
    if (tool === 'Optimize PDF')
      return runner.run(
        'Optimizing PDF',
        async (snapshot) => {
          const current = await exportDocument(
            snapshot.document!,
            snapshot.objects,
            snapshot.pageSettings,
          );
          return { bytes: await optimizePdf(current), size: current.size };
        },
        ({ bytes, size }, snapshot) => {
          downloadBlob(
            byteBlob(bytes, 'application/pdf'),
            `${snapshot.document!.name.replace(/\.pdf$/i, '')}-optimized.pdf`,
          );
          const delta = size - bytes.byteLength;
          notice(
            delta > 0
              ? `Optimized PDF downloaded (${Math.round(delta / 1024)} KB smaller).`
              : 'Repacked PDF downloaded; this source could not be made smaller.',
          );
        },
      );
    return runner.run(
      tool,
      async (snapshot) => {
        const name = snapshot.document!.name.replace(/\.pdf$/i, '');
        if (tool === 'Export page PNG') {
          const current = await exportDocument(
            snapshot.document!,
            snapshot.objects,
            snapshot.pageSettings,
          );
          return {
            blob: await renderPagePng(current, snapshot.selectedPage),
            name: `${name}-page-${snapshot.selectedPage}.png`,
          };
        }
        if (tool === 'Extract tables CSV') {
          const tables = await extractTables(
            snapshot.document!,
            snapshot.objects,
            snapshot.pageSettings,
          );
          if (!tables.length) throw new Error('No multi-run text table candidates were found.');
          return {
            blob: new Blob([tablesToCsv(tables)], { type: 'text/csv;charset=utf-8' }),
            name: `${name}-tables.csv`,
          };
        }
        const pages = await editedTextPages(
          snapshot.document!,
          snapshot.objects,
          snapshot.pageSettings,
        );
        const html = tool === 'Export HTML';
        return {
          blob: new Blob(
            [
              html
                ? textToHtml(pages, snapshot.document!.name)
                : pages.join('\n\n--- Page break ---\n\n'),
            ],
            { type: html ? 'text/html;charset=utf-8' : 'text/plain;charset=utf-8' },
          ),
          name: `${name}.${html ? 'html' : 'txt'}`,
        };
      },
      (result) => {
        downloadBlob(result.blob, result.name);
        notice(`${tool} downloaded locally.`);
      },
    );
  };
  const compare = () => {
    const input = globalThis.document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      void runner.run(
        'Comparing PDFs',
        async (snapshot) => ({
          snapshot,
          otherName: file.name,
          pages: await compareDocuments(
            snapshot.document!,
            await toPdfDocument(file),
            snapshot.objects,
            snapshot.pageSettings,
          ),
        }),
        (result) => {
          onComparison(result);
          const changed = result.pages.filter((page) => !page.equal).length;
          notice(
            changed
              ? `${changed} page${changed === 1 ? '' : 's'} contain text changes.`
              : 'No extracted text differences found.',
          );
        },
      );
    };
    input.click();
  };
  const merge = (files: File[]) =>
    runner.run(
      'Merging PDFs',
      async () => {
        if (files.length < 2) throw new Error('Choose two or more PDFs to merge.');
        return mergePdfs(await Promise.all(files.map(toPdfDocument)));
      },
      (bytes) => {
        downloadPdf(bytes, 'merged.pdf');
        notice(`${files.length} PDFs merged locally.`);
      },
    );
  const mailMerge = (file: File) =>
    runner.run(
      'Generating mail merge',
      async (snapshot) => {
        if (file.size > 1024 * 1024)
          throw new Error('Mail merge CSV files must be 1 MB or smaller.');
        const rows = parseCsv(await file.text());
        if (!rows.length) throw new Error('The CSV needs a header row and at least one recipient.');
        if (rows.length > 200) throw new Error('Generate at most 200 recipients per mail merge.');
        return exportMailMerge(snapshot.document!, snapshot.objects, snapshot.pageSettings, rows);
      },
      (files) => {
        files.forEach(({ bytes, name }) => downloadPdf(bytes, name));
        notice(`${files.length} recipient PDFs generated locally.`);
      },
    );
  const secure = (text?: string) =>
    runner.run(
      text === undefined ? 'Sanitizing PDF' : 'Redacting PDF',
      (snapshot) =>
        secureExport(
          snapshot.document!,
          snapshot.objects,
          snapshot.pageSettings,
          text === undefined ? [] : [text],
        ),
      (bytes, snapshot) => {
        downloadPdf(
          bytes,
          `${snapshot.document!.name.replace(/\.pdf$/i, '')}-${text === undefined ? 'sanitized' : 'redacted'}.pdf`,
        );
        notice(
          text === undefined
            ? 'Sanitized copy downloaded.'
            : 'Redacted copy verified and downloaded.',
        );
      },
    );
  const protect = (password: string, clear: () => void) =>
    runner.run(
      'Protecting package',
      async (snapshot) =>
        encryptPdfPackage(
          await exportPdf(snapshot.document!, snapshot.objects, snapshot.pageSettings),
          password,
        ),
      (bytes, snapshot) => {
        downloadBlob(
          byteBlob(bytes, 'application/octet-stream'),
          `${snapshot.document!.name.replace(/\.pdf$/i, '')}.pdfg`,
        );
        clear();
        notice('Password-protected package downloaded.');
      },
    );
  const openProtected = async (file: File) => {
    const password = globalThis.prompt('Enter the package password');
    if (!password) return;
    await runner.run(
      'Opening protected package',
      async () => {
        try {
          const bytes = await decryptPdfPackage(new Uint8Array(await file.arrayBuffer()), password);
          return await toPdfDocument(
            new File([byteBlob(bytes, 'application/pdf')], file.name.replace(/\.pdfg$/i, '.pdf'), {
              type: 'application/pdf',
            }),
          );
        } catch {
          throw new Error(
            'Could not open that protected package. Check its password and PDF contents.',
          );
        }
      },
      (document) => useAppStore.getState().setDocument(document),
    );
  };
  return { run, compare, merge, mailMerge, secure, protect, openProtected };
}
