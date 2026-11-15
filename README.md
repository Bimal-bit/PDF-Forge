# PDFForge

PDFForge is a privacy-first, browser-local PDF workspace. This repository currently implements milestones 1 through 4: local intake/recovery, pdf.js rendering/navigation, valid pdf-lib export, in-place text-run overlays with font fallback disclosure, and insertion of text, images, shapes, tables, and links.

## Run

```sh
npm install
npm run dev
```

Run the validation suite with `npm run test:all`.

## Privacy

Opening a PDF reads it in the browser only. Autosave uses that browser’s IndexedDB; no upload or server is involved.

See `KNOWN_LIMITS.md` for the deliberately deferred milestones.
