import { openDB } from 'idb';
import type { OpenDocument } from '../types';

const DB_NAME = 'pdfforge';
const STORE_NAME = 'documents';

async function database() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(STORE_NAME);
    },
  });
}

export async function saveDocument(document: OpenDocument): Promise<void> {
  const db = await database();
  await db.put(STORE_NAME, document, document.id);
}

export async function loadLatestDocument(): Promise<OpenDocument | undefined> {
  const db = await database();
  const keys = await db.getAllKeys(STORE_NAME);
  if (!keys.length) return undefined;
  const documents = await Promise.all(keys.map((key) => db.get(STORE_NAME, key)));
  return documents.filter(Boolean).sort((a, b) => b.modifiedAt - a.modifiedAt)[0];
}
