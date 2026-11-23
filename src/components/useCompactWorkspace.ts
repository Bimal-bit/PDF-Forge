import { useSyncExternalStore } from 'react';

const query = '(max-width: 760px), (max-width: 1000px) and (max-height: 500px)';
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
export function useCompactWorkspace() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const landscapeQuery = '(max-width: 1000px) and (max-height: 500px)';
const subscribeLandscape = (notify: () => void) => {
  const media = window.matchMedia(landscapeQuery);
  media.addEventListener('change', notify);
  return () => media.removeEventListener('change', notify);
};
export function useShortWorkspace() {
  return useSyncExternalStore(
    subscribeLandscape,
    () => window.matchMedia(landscapeQuery).matches,
    () => false,
  );
}
