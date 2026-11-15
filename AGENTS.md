# PDFForge engineering guide

## Working rules

- Work in the ordered milestones defined in `DECISIONS.md`; validate each completed milestone before committing it as `M<n>: <title>`.
- Do not expose unfinished features as working controls. Keep unavailable work out of the UI and record it in `KNOWN_LIMITS.md`.
- All document processing is browser-local. No server, upload endpoint, analytics, or network dependency belongs in the app.
- Keep modules typed, focused, and below roughly 400 lines. Every user-facing feature needs a UI path and a test.
- Record material assumptions in `DECISIONS.md`.

## Commands

`npm run dev` · `npm run build` · `npm run preview` · `npm run lint` · `npm run typecheck` · `npm run test` · `npm run test:e2e` · `npm run test:all`

Run `npm run test:all` before every milestone commit.

## Architecture

- React 18 + strict TypeScript + Vite provides the client application.
- Zustand stores UI/document state. Immer patches make state changes undoable and redoable without an artificial history cap.
- The `idb` adapter persists opened browser-local document data for automatic recovery. The document bytes never leave the browser.
- Components are split between `Ribbon` for commands and `Panels` for the workspace. The pdf.js viewer shares its loaded document with lazy thumbnails and search. Visited main-viewer canvases remain allocated.
- Recovery records persist source bytes, object edits, page settings, and selected page. Version history remains pending.
- Production builds emit an offline asset list for the same-origin service worker. Browser tests also build and launch a production preview to verify offline recovery.
- Design takes its cues from the supplied PDFForge mock: warm paper surfaces, restrained orange accents, compact Word-style ribbon, and a generous document canvas.

- Tesseract OCR cores, English/Spanish model data, and the Unicode font are bundled locally and included in production precaching.
- Certificate signing uses local P12/PFX data with network chain fetching disabled. Secure redaction/sanitization uses the user-approved rendered-image output and includes current edits.
