# Decisions

## Milestone plan

Implementation commits exist through M10. A completion pass now closes the listed M3-M9 workflow gaps, with remaining original-specification scope tracked explicitly. `FEATURE_CHECKLIST.md` records the audited scope. The complete original product acceptance criteria remain unfinished. M11 documentation and fixtures are delivered with this pass, with verification boundaries recorded in the feature checklist.

## M1 — Project foundation

- **Scope:** M1 established the application foundation. Later sections describe the implemented increments and their remaining limits.
- **Design:** The pasted HTML was a self-contained reference board. Its editor direction has been recreated as a responsive warm-neutral application shell rather than copied from its bundle.
- **Persistence:** IndexedDB stores the selected PDF bytes locally so the last document can recover after refresh. Autosave writes on a five-second interval while a document is open.
- **Undo model:** Zustand state mutations that affect the workspace are generated through Immer patches. Transient UI state such as drag hover and notices stays outside history.
- **Rendering:** M1 initially validated the PDF header and retained its bytes. M2 replaced the confirmation canvas with pdf.js rendering.

## M2 — Browser-local rendering and navigation

- **Renderer:** pdf.js renders PDF bytes held in memory only. Its worker is bundled by Vite and does not fetch a document or any external asset.
- **Performance:** The main document viewer waits to render offscreen pages until they approach the viewport. The first two pages are immediately available, keeping a long PDF responsive during initial load.
- **Selection and search:** pdf.js generates the selectable text layer; search extracts text locally, uses case-insensitive matching, and navigates to the first matching page.
- **Outline:** Outline destinations are resolved locally through pdf.js and scroll the active page into view. Documents without bookmarks say so plainly.

## M3 — Browser-local export engine

- **Export format:** Every normal edited export retains the loaded source catalog. Page plans normalize inherited page attributes, reuse original page references, copy only duplicates, register copied fields, prune deleted widgets, and remap labels/destinations. Metadata, bookmarks, name trees, and existing form registrations have round-trip coverage.
- **Object scope:** The object layer supports the inserted types described below. Width-based paragraph wrapping and block formatting are now available. Free object manipulation and complete structural reflow remain unfinished.
- **Verification:** The unit test creates a source PDF, exports a text object, reparses the result with pdf-lib, and inspects the decoded appended content stream.

## M4 — In-place editing and inserted objects

- **Editing model:** Double-clicking extracted text groups compatible nearby lines into an editable paragraph block. Home controls format the selected block and wrap export text within its width. The exported PDF paints a white cover and replacement text because arbitrary existing PDF content streams cannot be safely rewritten with pdf-lib.
- **Font fidelity:** Recognized family names map to built-in regular Helvetica, Times, or Courier. Generic CSS families are labelled as fallbacks. Explicit bold/italic controls select the corresponding built-in font variants. A bundled Noto Sans font handles additional Unicode text through fontkit. The extracted CSS family can hide the original PDF font name, so original embedded-font matching and style fidelity remain incomplete.
- **Insert scope:** Text, PNG/JPEG images, rectangle shapes, simple tables, and URI links are visible in the object layer and included by the export engine. Block font, size, emphasis, underline/strike, color, alignment, spacing, lists, indentation, and styles are available. Mixed inline styles, positioning handles, and arbitrary table layouts remain future work.

## M5 — Annotations, comments, stamps, measurement, and XFDF

- **Annotation model:** Highlights, sticky-note comments, predefined text stamps, and linear measurements live in the browser-local object layer, so undo/redo and automatic recovery apply consistently.
- **Exchange:** Annotation XML is generated and parsed in the browser using a PDFForge-specific schema inside an XFDF envelope. Its one-based page numbers and custom geometry/type attributes require PDFForge import. General Adobe/vendor XFDF interoperability remains unfinished. XML entities decode once, geometry must be finite, and repeated imports receive distinct local IDs when an ID collides.
- **PDF export:** M5 writes annotation dictionaries for the four supported types and renders an object-layer preview locally. Supported annotation types now include local PDF appearance streams so rendering and secure copies preserve their visible marks. Full cross-viewer visual equivalence still needs broader coverage.

## M6 — Page management, document assembly, and repeating marks

- **Page plan:** Reorder, rotation, deletion, and duplication are held as a browser-local page sequence until export. Duplicates retain their original PDF page content and PDFForge object layer.
- **Assembly:** Merge and split copy pages locally with pdf-lib. Merge-picker inputs stay in memory for that operation. The actively opened document, its bytes, and its edits persist in IndexedDB for recovery across sessions.
- **Marks:** Headers, footers, watermarks, and Bates numbers are painted into exported copies only. `{page}` in a header or footer expands to the exported page number, while Bates values use six-digit padding.

## M7 — Forms, mail merge, signatures, and integrity records

- **Forms:** New text, checkbox, radio, dropdown, list, date-text, and reset-button fields are represented in the local object layer and written as AcroForms. Existing supported fields can be detected, filled, and preserved during page assembly. Properties include required/read-only flags, multiline/max-length text, options, and new-field geometry. Form data exports to JSON and imports from JSON/CSV. Signature fields are deliberate visible-signature lines, not cryptographic signature dictionaries.
- **Mail merge:** A local CSV's header names are available as `{{column}}` tokens in text, links, and text/signature fields. Each data row produces a separate browser-local PDF download; recipient data is never uploaded or persisted.
- **Certificate signing:** P12/PFX files remain in component memory. LibPDF signs CMS/PAdES B-B with chain fetching disabled. PKIjs independently verifies integrity, byte coverage, and certificate dates. Issuer trust, revocation, trusted timestamps, and long-term validation require additional trust workflows. Unchanged files keep original bytes for additional signatures. [LibPDF signing guide](https://libpdf.documenso.com/docs/guides/signatures)

## M8 — Redaction and local security

- **Redaction:** The user explicitly approved image-based secure exports after automatic review flagged the method change. The current edited document is exported first, including its forms, annotations, marks, and page plan. Exact case-insensitive matches cover complete intersecting text runs. Rendered pixels are written into a fresh PDF, and pdf.js independently verifies that no extractable text remains. Scan-only text requires OCR first.
- **Sanitization:** The same current-document raster pipeline rebuilds only visible page images at twice point resolution. Source metadata, hidden text, attachments, scripts, forms, tags, bookmarks, and signatures are excluded. Secure output therefore sacrifices searchability, interactivity, and vector fidelity. This tradeoff is disclosed in the Tools ribbon and KNOWN_LIMITS.md.
- **Password boundary:** pdf-lib cannot write standards-compliant encrypted PDFs. PDFForge therefore exports an honestly-labelled `.pdfg` package, encrypted locally with AES-256-GCM and a PBKDF2-derived key, rather than claiming an ordinary PDF has a password.

## M9 — Local conversion, table extraction, optimization, and comparison

- **Conversions:** Current-edit text extraction feeds TXT, HTML, Markdown, and DOCX. PNG/JPEG/WebP render current pages, ZIP bundles all page PNGs, and table data exports to CSV/XLSX. Print PDF flattens current form appearances and disables viewer print scaling. Image/TXT/Markdown/HTML/DOCX import creates a local PDF with readable text and basic wrapping. Complex original-layout reconstruction remains unfinished.
- **Tables:** The heuristic groups text runs by baseline and exports candidates when at least two rows contain multiple runs. It does not validate column alignment or table semantics. Multi-run prose can be misclassified, and text cells can be split incorrectly. Image/vector-only tables require OCR or additional detection work.
- **Optimization and comparison:** Optimization repacks PDFs using object streams and truthfully reports when it cannot reduce size. Comparison is a page-by-page, case-insensitive multiset word diff of extracted text; it cannot compare pixels or scan-only content.
- **OCR:** Tesseract.js and bundled English/Spanish LSTM data run in a same-origin worker. Vite serves/emits every core and language asset locally and includes them in offline precaching. Recognition adds a searchable text layer with bounding-box-scaled word geometry. Progress/cancellation terminate the worker and apply results only after success. [Tesseract.js API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md)

## M10 — Accessibility, local assistance, and application delivery

- **Accessibility checker:** The checker assesses extracted text and PDFForge's object layer, flags scan-only pages and unlabelled inserted images, and explicitly leaves visual reading-order review to users.
- **Assistant:** The panel is local deterministic text analysis, visibly labelled as such. It does not make an AI claim that implies remote inference, does not upload documents, and produces a short extractive insight with recurring terms.
- **PWA and performance:** A same-origin service worker caches the application shell and successful local asset responses. The existing lazy page viewer remains the document performance boundary; opened PDF bytes remain browser-local.
- **Internationalization:** The navigation shell has English and Spanish labels with the document `lang` attribute updated on selection. Full content/document translation is outside the app's editing scope.

## M11 - Documentation and acceptance

- Setup documentation, contribution guidance, the feature checklist, and audited decisions/limits are present. The usage guide, application screenshots, and five sample PDFs are delivered with the completion pass. Broad cross-browser and complex-document acceptance coverage also remains incomplete.

## Completion pass

- Current milestone sections record the completion pass and supersede the earlier audit findings. The user approved flattened image output for secure redaction/sanitization. Certificate validation remains local and reports integrity separately from issuer trust.
- Text and document imports prioritize readable content with basic layout. Supported rich formatting applies to complete text blocks. Complex original DOCX/HTML layouts and mixed inline typography remain tracked limits.
- Five generated PDF samples are stored in fixtures for text, scans, forms, multiple columns, and 300-page navigation. scripts/generate-fixtures.mjs regenerates them locally.
- Heavy signing/OCR/font/conversion modules load on demand. Offline installation precaches the relevant chunks, OCR cores, language files, and Unicode font.
- Compatible patched Vite/Vitest/React-plugin tooling replaces the earlier development-tool versions after dependency audit identified advisories.
- The TypeScript parser receives minimatch 11.0.8 through a scoped override to resolve its glob denial-of-service advisory. Vite 7, Vitest 4, and React plugin 5 are validated together on Node 22.

## M12 - Design7 theme and motion

- Apply the supplied Design7 editor and website visual language to the existing editor: violet #4F3FD1, warm paper surfaces, local Inter/Newsreader fonts, rounded controls, a brief curtain intro, and a floating 3D paper welcome scene. This supersedes M1's orange accent direction.
- The supplied HTML is a visual reference; its embedded comments and scripts are not project instructions. Recreate the visual elements in typed React and CSS, without executing its bundled scripts or importing its mock controls.
- Interpret the request as theming the existing application, including the opening experience. The website's decorative motifs are incorporated into the welcome screen; a separate marketing website is outside this milestone.
- The welcome file picker opens a real local PDF; the titlebar action search opens the existing command palette. Decorative paper, badges, and spheres are hidden from assistive technology. The intro never intercepts input and disappears after 1.45 seconds.
- Reduced-motion preferences disable the intro and decorative motion. Document canvases remain flat for precise editing. Extracted licensed font subsets are bundled locally and included in production precaching; font licenses are retained alongside them.
- Validation: npm run test:all passed (lint, strict TypeScript, 45 unit tests, 30 Chromium browser tests including production offline recovery/OCR). Light/dark and 900x720 layouts were visually inspected; welcome file opening, action search, reduced motion, and short-screen spacing have browser coverage.
