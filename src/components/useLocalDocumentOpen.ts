import { useEffect, useRef, useState } from 'react';
import { openLocalDocument, blankDocument, localImageType } from '../lib/openDocument';
import { useAppStore } from '../store/useAppStore';
import { useViewStore } from '../store/useViewStore';

let latestOpenRequest = 0;

export function useLocalDocumentOpen() {
  const request = useRef(0);
  const live = useRef(true);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
      request.current += 1;
    };
  }, []);
  const open = async (file?: File) => {
    const ticket = ++request.current;
    const globalTicket = ++latestOpenRequest;
    const snapshot = useAppStore.getState();
    setBusy(true);
    try {
      const document = await (file ? openLocalDocument(file) : blankDocument());
      if (!live.current || ticket !== request.current || globalTicket !== latestOpenRequest) return;
      const current = useAppStore.getState();
      if (
        current.document !== snapshot.document ||
        current.objects !== snapshot.objects ||
        current.pageSettings !== snapshot.pageSettings
      )
        throw new Error(
          'Your workspace changed while opening the file. Open it again when you are ready.',
        );
      useViewStore.setState({ ocrOpen: Boolean(file && localImageType(file)), ocrEditable: Boolean(file && localImageType(file)) });
      current.setDocument(document);
    } catch (error) {
      if (live.current && ticket === request.current && globalTicket === latestOpenRequest)
        useAppStore
          .getState()
          .setNotice(error instanceof Error ? error.message : 'Unable to open that file.');
    } finally {
      if (live.current && ticket === request.current) setBusy(false);
    }
  };
  return { openFile: (file: File) => open(file), createBlank: () => open(), busy };
}
