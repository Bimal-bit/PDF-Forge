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
- Components are split between `Ribbon` for commands and `Panels` for the workspace. Milestone 2 will replace the placeholder page canvas with pdf.js rendering and a virtualized viewer.
- Design takes its cues from the supplied PDFForge mock: warm paper surfaces, restrained orange accents, compact Word-style ribbon, and a generous document canvas.
