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

M1 through M8 are complete. M9 through M11 remain planned exactly as specified in the task brief.

## M10 — Accessibility, local assistance, and application delivery

- **Accessibility checker:** The checker assesses extracted text and PDFForge's object layer, flags scan-only pages and unlabelled inserted images, and explicitly leaves visual reading-order review to users.
- **Assistant:** The panel is local deterministic text analysis, visibly labelled as such. It does not make an AI claim that implies remote inference, does not upload documents, and produces a short extractive insight with recurring terms.
- **PWA and performance:** A same-origin service worker caches the application shell and successful local asset responses. The existing lazy page viewer remains the document performance boundary; opened PDF bytes remain browser-local.
- **Internationalization:** The navigation shell has English and Spanish labels with the document `lang` attribute updated on selection. Full content/document translation is outside the app's editing scope.

## M9 — Local conversion, table extraction, optimization, and comparison

- **Conversions:** Browser-local pdf.js text extraction produces TXT and semantic, escaped HTML; current-page PNG exports are rendered into an in-memory canvas. No conversion service receives document content.
- **Tables:** Only pages with at least two multi-column text rows are exported to CSV. This conservative geometry-based heuristic declines prose and non-text/vector tables rather than fabricating cells.
- **Optimization and comparison:** Optimization repacks PDFs using object streams and truthfully reports when it cannot reduce size. Comparison is a page-by-page, case-insensitive multiset word diff of extracted text; it cannot compare pixels or scan-only content.
- **OCR boundary:** No OCR control is exposed until an offline recognition engine and language data can ship with the app; calling text extraction OCR would be misleading for image-only PDFs.

## M2 — Browser-local rendering and navigation

- **Renderer:** pdf.js renders PDF bytes held in memory only. Its worker is bundled by Vite and does not fetch a document or any external asset.
- **Performance:** The main document viewer waits to render offscreen pages until they approach the viewport. The first two pages are immediately available, keeping a long PDF responsive during initial load.
- **Selection and search:** pdf.js generates the selectable text layer; search extracts text locally, uses case-insensitive matching, and navigates to the first matching page.
- **Outline:** Outline destinations are resolved locally through pdf.js and scroll the active page into view. Documents without bookmarks say so plainly.

## M7 — Forms, mail merge, signatures, and integrity records

- **Forms:** PDFForge text and checkbox fields are held in the local object layer and written as standard AcroForm controls on export. Signature fields are deliberate visible-signature lines, not cryptographic signature dictionaries.
- **Mail merge:** A local CSV's header names are available as `{{column}}` tokens in text, links, and text/signature fields. Each data row produces a separate browser-local PDF download; recipient data is never uploaded or persisted.
- **Signing boundary:** Certificate-backed digital PDF signatures require user-held certificates and a standards-compliant incremental-signing implementation. PDFForge does not expose a misleading “digitally signed” action until that is available.

## M8 — Redaction and local security

- **Redaction:** The tool only accepts exact text found in plain PDF content streams. It creates a new PDF, removes matching literal/hex text content, drops annotations, and verifies the target cannot be extracted from the resulting content streams before download. It intentionally refuses a redaction when it cannot verify removal.
- **Sanitization:** Sanitized exports are rebuilt browser-locally without annotations, forms, catalog actions, name trees, embedded metadata, or inherited document metadata.
- **Password boundary:** pdf-lib cannot write standards-compliant encrypted PDFs. PDFForge therefore exports an honestly-labelled `.pdfg` package, encrypted locally with AES-256-GCM and a PBKDF2-derived key, rather than claiming an ordinary PDF has a password.
