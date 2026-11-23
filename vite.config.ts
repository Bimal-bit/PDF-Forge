import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readdirSync } from 'node:fs';
import { offlineOcrAssets } from './ocrAssets';

export default defineConfig({
  plugins: [react(), offlineOcrAssets(), {
    name: 'offline-asset-list',
    generateBundle(_options, bundle) {
      const assets = Object.keys(bundle).filter((name) => name.startsWith('assets/') || name.startsWith('ocr/')).map((name) => `/${name}`);
      assets.push('/fonts/NotoSans-Regular.ttf', ...readdirSync('public/fonts/theme').filter((name) => name.endsWith('.woff2')).map((name) => '/fonts/theme/' + name));
      assets.push('/fonts/ocr/manifest.json', '/fonts/ocr/glyphs.bin');
      for (const family of readdirSync('public/fonts/catalog', { withFileTypes: true }).filter((entry) => entry.isDirectory())) {
        assets.push(...readdirSync(`public/fonts/catalog/${family.name}`).filter((name) => name.endsWith('.ttf')).map((name) => `/fonts/catalog/${family.name}/${name}`));
      }
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(assets) });
    },
  }],
});
