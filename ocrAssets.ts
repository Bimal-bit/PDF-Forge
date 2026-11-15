import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export function offlineOcrAssets(): Plugin {
  const assets = new Map<string, string>();
  assets.set('/ocr/worker.min.js', resolve('node_modules/tesseract.js/dist/worker.min.js'));
  for (const name of readdirSync('node_modules/tesseract.js-core')) {
    if (name.endsWith('.wasm') || name.endsWith('.wasm.js')) assets.set(`/ocr/core/${name}`, resolve('node_modules/tesseract.js-core', name));
  }
  for (const language of ['eng', 'spa']) assets.set(`/ocr/lang/${language}.traineddata.gz`, resolve(`node_modules/@tesseract.js-data/${language}/4.0.0_best_int/${language}.traineddata.gz`));
  assets.set('/fonts/NotoSans-Regular.ttf', resolve('public/fonts/NotoSans-Regular.ttf'));
  return {
    name: 'offline-ocr-assets',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const name = request.url?.split('?')[0] ?? '';
        const path = assets.get(name);
        if (!path) return next();
        response.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : name.endsWith('.wasm') ? 'application/wasm' : 'application/octet-stream');
        response.end(readFileSync(path));
      });
    },
    generateBundle() {
      for (const [name, path] of assets) {
        if (name.startsWith('/fonts/')) continue;
        this.emitFile({ type: 'asset', fileName: name.slice(1), source: readFileSync(path) });
      }
    },
  };
}
