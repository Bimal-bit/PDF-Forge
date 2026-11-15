import { openDB } from 'idb';
import type { OpenDocument, RecoveryDocument, AppSnapshot } from '../types';

const DB_NAME = 'pdfforge';
const STORE_NAME = 'documents';

async function database() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });
}

export async function saveDocument(document: OpenDocument, workspace?: Pick<AppSnapshot, 'objects' | 'pageSettings' | 'selectedPage'>): Promise<void> {
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
