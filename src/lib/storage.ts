import { openDB, type DBSchema } from 'idb';
import type { OpenDocument, RecoveryDocument, AppSnapshot, EditingLibraryEntry } from '../types';

const DB_NAME = 'pdfforge';
const STORE_NAME = 'documents';

interface LocalDatabase extends DBSchema {
  documents: { key: string; value: RecoveryDocument };
  editingLibrary: { key: string; value: EditingLibraryEntry };
}

export async function database() {
  return openDB<LocalDatabase>(DB_NAME, 2, {
    upgrade(db, oldVersion) {
      if (oldVersion < 1) db.createObjectStore(STORE_NAME);
      if (oldVersion < 2) db.createObjectStore('editingLibrary');
    },
  });
}

export async function saveDocument(document: OpenDocument, workspace?: Pick<AppSnapshot, 'objects' | 'pageSettings' | 'selectedPage'> & Partial<Pick<AppSnapshot, 'trackChanges' | 'changeAuthor' | 'textChanges'>>): Promise<void> {
  const db = await database();
  try {
    await db.put(STORE_NAME, { ...document, ...workspace, savedAt: Date.now() }, document.id);
  } finally {
    db.close();
  }
}

export async function loadLatestDocument(): Promise<RecoveryDocument | undefined> {
  const db = await database();
  try {
    const documents: RecoveryDocument[] = await db.getAll(STORE_NAME);
    return documents.sort((a, b) => (b.savedAt ?? b.modifiedAt) - (a.savedAt ?? a.modifiedAt))[0];
  } finally {
    db.close();
  }
}
