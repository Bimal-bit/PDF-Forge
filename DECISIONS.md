# Decisions

## M3 — Browser-local export engine

- **Export format:** pdf-lib loads the original browser-local bytes, appends the object layer to the relevant page content streams, and downloads a new PDF. No server or remote conversion is involved.
- **Object scope:** M3 provides a small editable text overlay as the visible, exportable object-layer proof. Full text editing, formatting, positioning, and additional object types remain M4 work.
- **Verification:** The unit test creates a source PDF, exports a text object, reparses the result with pdf-lib, and inspects the decoded appended content stream.

## M1 — Project foundation

- **Scope:** The request says “Begin with M1 now”; this commit implements M1 only. Later milestone features are deliberately absent rather than represented by fake controls.
- **Design:** The pasted HTML was a self-contained reference board. Its editor direction has been recreated as a responsive warm-neutral application shell rather than copied from its bundle.
- **Persistence:** IndexedDB stores the selected PDF bytes locally so the last document can recover after refresh. Autosave writes on a five-second interval while a document is open.
- **Undo model:** Zustand state mutations that affect the workspace are generated through Immer patches. Transient UI state such as drag hover and notices stays outside history.
- **Rendering:** Actual PDF rendering is deferred to M2, as prescribed. M1 validates a PDF header, retains its bytes, and presents a document-local confirmation canvas.

## Milestone plan

M1 through M3 are complete. M4 through M11 remain planned exactly as specified in the task brief.

## M2 — Browser-local rendering and navigation

- **Renderer:** pdf.js renders PDF bytes held in memory only. Its worker is bundled by Vite and does not fetch a document or any external asset.
- **Performance:** The main document viewer waits to render offscreen pages until they approach the viewport. The first two pages are immediately available, keeping a long PDF responsive during initial load.
- **Selection and search:** pdf.js generates the selectable text layer; search extracts text locally, uses case-insensitive matching, and navigates to the first matching page.
- **Outline:** Outline destinations are resolved locally through pdf.js and scroll the active page into view. Documents without bookmarks say so plainly.
