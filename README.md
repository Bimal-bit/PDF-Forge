# PDFForge

PDFForge is a privacy-first, browser-local PDF workspace. This repository currently implements milestones 1 and 2: local PDF intake and recovery, undo/redo state foundation, pdf.js page rendering, zooming, selectable text, search, thumbnails, and outline navigation.

## Run

```sh
npm install
npm run dev
```

Run the validation suite with `npm run test:all`.

## Privacy

Opening a PDF reads it in the browser only. Autosave uses that browser’s IndexedDB; no upload or server is involved.

See `KNOWN_LIMITS.md` for the deliberately deferred milestones.
