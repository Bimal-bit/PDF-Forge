import { useEffect, useSyncExternalStore } from 'react';
import type { EditorObject } from '../types';
import { fontVersion, prepareTextFont, subscribeFonts } from '../lib/textFonts';
import { useAppStore } from '../store/useAppStore';

export function useTextFonts(objects: EditorObject[]) {
  const version = useSyncExternalStore(subscribeFonts, fontVersion);
  useEffect(() => {
    let live = true;
    for (const object of objects) {
      if (object.type === 'text')
        void prepareTextFont(object).catch((error: unknown) => {
          if (live)
            useAppStore
              .getState()
              .setNotice(
                error instanceof Error ? error.message : 'Could not load the selected font.',
              );
        });
    }
    return () => {
      live = false;
    };
  }, [objects, version]);
  return version;
}
