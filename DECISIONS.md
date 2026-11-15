# Decisions

## M6 — Page management, document assembly, and repeating marks

- **Page plan:** Reorder, rotation, deletion, and duplication are held as a browser-local page sequence until export. Duplicates retain their original PDF page content and PDFForge object layer.
- **Assembly:** Merge and split use pdf-lib copies in the browser; source bytes are neither uploaded nor retained beyond the current browser session.
- **Marks:** Headers, footers, watermarks, and Bates numbers are painted into exported copies only. `{page}` in a header or footer expands to the exported page number, while Bates values use six-digit padding.

## M5 — Annotations, comments, stamps, measurement, and XFDF

- **Annotation model:** Highlights, sticky-note comments, predefined text stamps, and linear measurements live in the browser-local object layer, so undo/redo and automatic recovery apply consistently.
- **Exchange:** XFDF is generated and parsed entirely in the browser. It preserves PDFForge-created annotation geometry and content; unsupported third-party XFDF annotation types are ignored.
- **PDF export:** M5 writes standard PDF annotation dictionaries for the four supported annotation types, while the local viewer renders a matching object-layer representation.

## M4 — In-place editing and inserted objects

- **Editing model:** Double-clicking an extracted text run places a metric-sized editable overlay on top of it. The exported PDF paints a white cover and replacement text because arbitrary existing PDF content streams cannot be safely rewritten with pdf-lib.
- **Font fidelity:** Built-in Helvetica, Times, and Courier families are matched directly; unfamiliar embedded fonts are exported with Helvetica and visibly labelled as a fallback.
- **Insert scope:** Text, PNG/JPEG images, rectangle shapes, simple tables, and URI links are visible in the object layer and included by the export engine. Rich formatting, positioning handles, and arbitrary table layouts remain future work.

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

M1 through M6 are complete. M7 through M11 remain planned exactly as specified in the task brief.

## M2 — Browser-local rendering and navigation

- **Renderer:** pdf.js renders PDF bytes held in memory only. Its worker is bundled by Vite and does not fetch a document or any external asset.
- **Performance:** The main document viewer waits to render offscreen pages until they approach the viewport. The first two pages are immediately available, keeping a long PDF responsive during initial load.
- **Selection and search:** pdf.js generates the selectable text layer; search extracts text locally, uses case-insensitive matching, and navigates to the first matching page.
- **Outline:** Outline destinations are resolved locally through pdf.js and scroll the active page into view. Documents without bookmarks say so plainly.
