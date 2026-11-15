import { Moon, Sun } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';

export function ThemeToggle() {
  const theme = useAppStore((state) => state.theme);
  const setTheme = useAppStore((state) => state.setTheme);
  const dark = theme === 'dark';

  return (
    <button
      className="theme-toggle"
      aria-label="Toggle theme"
      aria-pressed={dark}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    </button>
  );
}
