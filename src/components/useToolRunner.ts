import { useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { assertToolSession, type ToolSession } from '../lib/toolSession';
import { useDialogLifetime } from './useDialogLifetime';

export interface ToolRunner {
  busy?: string;
  run: <T>(
    name: string,
    work: (snapshot: ToolSession) => Promise<T>,
    apply: (value: T, snapshot: ToolSession) => void,
  ) => Promise<void>;
}

export function useToolRunner(): ToolRunner {
  const [busy, setBusy] = useState<string>();
  const locked = useRef(false);
  const live = useDialogLifetime();
  const run: ToolRunner['run'] = async (name, work, apply) => {
    if (locked.current) return;
    locked.current = true;
    setBusy(name);
    const snapshot = useAppStore.getState();
    try {
      const result = await work(snapshot);
      if (!live.current) return;
      assertToolSession(snapshot, useAppStore.getState());
      apply(result, snapshot);
    } catch (error) {
      if (live.current)
        useAppStore
          .getState()
          .setNotice(error instanceof Error ? error.message : `${name} failed.`);
    } finally {
      locked.current = false;
      if (live.current) setBusy(undefined);
    }
  };
  return { busy, run };
}
