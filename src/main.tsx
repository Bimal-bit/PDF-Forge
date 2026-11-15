import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './pdf-text-layer.css';
import './theme-fonts.css';
import './theme-tokens.css';
import './theme.css';
import App from './App';

if (import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => undefined);

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
