import { insertionSize } from '../lib/insertion';
import { useAppStore } from '../store/useAppStore';
import { useInsertion } from './useInsertion';

/** Keep every quick-text entry point on the same crop-aware insertion path. */
export function useAddText() {
  const insertion = useInsertion('bottom');
  const addText = () => {
    try {
      if (!insertion.bounds) throw new Error('Wait for this page to load before adding text.');
      const size = insertionSize(insertion.bounds, 300, 36);
      insertion.commit({
        id: crypto.randomUUID(),
        type: 'text',
        page: insertion.sourcePage,
        ...insertion.point(size.width, size.height),
        width: size.width,
        text: 'Text overlay',
        fontSize: 14,
        color: '#d65737',
      });
    } catch (failure) {
      useAppStore.getState().setNotice(
        failure instanceof Error ? failure.message : 'Could not insert text on this page.',
      );
    }
  };
  return { ready: Boolean(insertion.bounds), addText };
}
