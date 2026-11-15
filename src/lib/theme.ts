import type { Theme } from '../types';

const preferenceKey = 'pdfforge-theme';

export function getSavedTheme(): Theme {
  try {
    return localStorage.getItem(preferenceKey) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

export function saveTheme(theme: Theme) {
  try {
    localStorage.setItem(preferenceKey, theme);
  } catch {
    // The current session can still change theme when storage is unavailable.
  }
}
