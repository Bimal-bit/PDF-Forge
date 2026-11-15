import type { EditingLibraryEntry, StyleKind, TextFormat, TextObject } from '../types';
import { database } from './storage';

export function textFormat(object?: TextObject, kind: StyleKind = 'paragraph'): TextFormat {
  const character: TextFormat = {
    fontFamily: object?.fontFamily ?? 'Helvetica',
    fontSize: object?.fontSize ?? 12,
    color: object?.color ?? '#292724',
    bold: object?.bold ?? false,
    italic: object?.italic ?? false,
    underline: object?.underline ?? false,
    strike: object?.strike ?? false,
    letterSpacing: object?.letterSpacing ?? 0,
  };
  if (kind === 'character') return character;
  return {
    ...character,
    alignment: object?.alignment ?? 'left',
    lineHeight: object?.lineHeight ?? 1.2,
    list: object?.list ?? 'none',
    indent: object?.indent ?? 0,
    style: object?.style ?? 'Body',
  };
}

export async function listLibraryEntries(): Promise<EditingLibraryEntry[]> {
  const db = await database();
  try {
    return (await db.getAll('editingLibrary')).sort((a, b) => a.name.localeCompare(b.name));
  } finally {
    db.close();
  }
}

export async function saveLibraryEntry(entry: EditingLibraryEntry): Promise<void> {
  const db = await database();
  try {
    await db.put('editingLibrary', entry, entry.id);
  } finally {
    db.close();
  }
}

export async function deleteLibraryEntry(id: string): Promise<void> {
  const db = await database();
  try {
    await db.delete('editingLibrary', id);
  } finally {
    db.close();
  }
}
