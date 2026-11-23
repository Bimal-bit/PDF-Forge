import { useState, type ChangeEvent } from 'react';
import { PDFDocument } from 'pdf-lib';
import { annotationsFromXfdf, annotationsToXfdf } from '../lib/xfdf';
import { isAnnotation } from '../lib/annotations';
import { useAppStore } from '../store/useAppStore';
import { finishInsertion } from './insertionEffects';
import { useDialogLifetime } from './useDialogLifetime';

export function ReviewExchange() {
  const state = useAppStore();
  const [busy, setBusy] = useState(false);
  const live = useDialogLifetime();
  const annotations = state.objects
    .filter(isAnnotation)
    .filter((object) => state.pageSettings.order.includes(object.page));
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget,
      file = input.files?.[0];
    const document = state.document,
      order = state.pageSettings.order;
    if (!file || !document) return;
    setBusy(true);
    try {
      if (file.size > 1024 * 1024) throw new Error('Annotation XML supports files up to 1 MB.');
      const text = await file.text();
      const source = await PDFDocument.load(document.data.slice(0));
      const imported = annotationsFromXfdf(text);
      if (!live.current) return;
      const current = useAppStore.getState();
      if (current.document !== document || current.pageSettings.order !== order)
        throw new Error('The document or page plan changed. Import the annotations again.');
      if (imported.some((object) => object.page > source.getPageCount()))
        throw new Error(
          'An annotation refers to a page outside this document. Nothing was imported.',
        );
      if (imported.length) {
        current.importAnnotations(imported);
        const first = imported.find((object) => order.includes(object.page));
        if (first) {
          current.setSelectedPage(order.indexOf(first.page) + 1);
          const added = useAppStore.getState().objects.slice(-imported.length);
          current.selectObject(added[imported.indexOf(first)].id);
        }
        finishInsertion();
      }
      current.setNotice(
        imported.length
          ? `${imported.length} annotation${imported.length === 1 ? '' : 's'} imported.`
          : 'No supported PDFForge annotations were found.',
      );
    } catch (error) {
      if (live.current)
        useAppStore
          .getState()
          .setNotice(error instanceof Error ? error.message : 'Could not import that XFDF file.');
    } finally {
      input.value = '';
      if (live.current) setBusy(false);
    }
  };
  return (
    <>
      <button
        disabled={!state.document || !annotations.length}
        onClick={() => {
          const url = URL.createObjectURL(
            new Blob([annotationsToXfdf(annotations)], { type: 'application/vnd.adobe.xfdf+xml' }),
          );
          const link = document.createElement('a');
          link.href = url;
          link.download = 'annotations.xfdf';
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}
      >
        Export PDFForge XFDF
      </button>
      <label className="review-import">
        {busy ? 'Reading annotations…' : 'Import PDFForge XFDF'}
        <input
          aria-label="Import PDFForge XFDF"
          type="file"
          accept=".xfdf,application/vnd.adobe.xfdf+xml,text/xml"
          disabled={!state.document || busy}
          onChange={(event) => void importFile(event)}
        />
      </label>
    </>
  );
}
