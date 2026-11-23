import type { EditorObject, OpenDocument, PageSettings } from '../types';

export interface ToolSession {
  document?: OpenDocument;
  objects: EditorObject[];
  pageSettings: PageSettings;
  selectedPage: number;
}

export function assertToolSession(snapshot: ToolSession, current: ToolSession) {
  if (
    snapshot.document !== current.document ||
    snapshot.objects !== current.objects ||
    snapshot.pageSettings !== current.pageSettings
  )
    throw new Error(
      'The document changed while this tool was running. No results were applied. Run the tool again.',
    );
}
