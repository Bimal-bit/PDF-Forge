import type { ZoomMode } from '../store/useViewStore';

export const MIN_ZOOM = 10;
export const MAX_ZOOM = 500;

export function boundedZoom(value: number, fallback = 100) {
  return Number.isFinite(value) ? Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.round(value * 10) / 10)) : fallback;
}

export function fittedZoom(mode: Exclude<ZoomMode, 'custom'>, page: { width: number; height: number }, available: { width: number; height: number }) {
  if (page.width <= 0 || page.height <= 0 || available.width <= 0 || available.height <= 0) return undefined;
  const ratio = mode === 'width' ? available.width / page.width : Math.min(available.width / page.width, available.height / page.height);
  // Round down so the last fraction of a pixel cannot introduce scrollbars.
  return boundedZoom(Math.floor(ratio * 1000) / 10);
}

export function boundedPage(value: number, count: number) {
  return Number.isFinite(value) ? Math.max(1, Math.min(Math.max(1, count), Math.trunc(value))) : 1;
}

export function visiblePage(pages: { number: number; top: number; bottom: number }[], top: number, height: number) {
  const anchor = top + Math.min(100, height / 3);
  return pages.reduce<{ number: number; distance: number } | undefined>((best, page) => {
    const distance = anchor < page.top ? page.top - anchor : anchor > page.bottom ? anchor - page.bottom : 0;
    return !best || distance < best.distance ? { number: page.number, distance } : best;
  }, undefined)?.number;
}
