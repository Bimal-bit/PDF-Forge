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

## M13 - Reference landing before file selection

- The user's follow-up explicitly requests the supplied website as the pre-file experience. This supersedes M12's interpretation of the welcome screen. The complete landing layout includes navigation, the dotted hero, large Newsreader headline, floating editor illustration, export formats, marquee, feature cards, three-step walkthrough, privacy call to action, and footer.
- The landing appears while there is no opened or recovered document. Selecting or dropping a PDF enters the existing editor. Automatic browser-local recovery continues to restore a saved workspace.
- The reference HTML supplies visual content only. Its bundled scripts are excluded. Typed React and scoped CSS recreate its intro, floating elements, animated text treatment, hover effects, and scrolling reveals using the existing local fonts. Reduced-motion preferences disable these animations.
- Every open action uses the same browser-local picker. Features, How it works, and Privacy navigate to page sections. Watch the tour navigates to the three-step walkthrough. Docs downloads the bundled user guide, including offline. The footer's Source label is plain text pending a repository URL.
- Product descriptions reflect the implemented double-click text editing, typed/certificate signatures, searchable OCR, flattened secure redaction, and PDF repacking. The editor illustration remains decorative and hidden from assistive technology.
- Validation completed with npm run build and npm run test:all, including lint, strict TypeScript, 45 unit tests, and 34 Chromium browser tests. Landing layout, all picker entry points, file drop, invalid input, navigation, guide download, reduced motion, and production offline recovery have browser coverage. Screens at 1440px, 900px, and 390px were visually inspected against the reference, including the animated desktop state.

## M14 - Design8 theme and shared dark mode

- The supplied Design8 board provides the editor, outer website, and inside-app theme reference. Its exact light palette and dark palette now define shared local CSS variables. Dark surfaces use App #14141A, Panel #1C1C24, Sunken #17171E, Border #2C2C37, Text #F2EFE8, Muted #A5A2B0, Accent #8E83F0, and Accent soft #2A2652.
- The editor follows the reference's 52px title bar, 38px tabs, 88px grouped ribbon, 180px page rail, 292px properties panel, segmented navigation, rounded inputs, warm surfaces, and Inter/Newsreader interface typography. Existing formatting controls retain their labels and values. Heading, Body, and Caption buttons apply the existing supported text styles.
- A shared theme toggle is available in the landing navigation and editor title bar. Light mode is the initial default. The chosen mode persists locally, carries into opened/recovered documents, and restores after refresh. Browsers that restrict preference storage retain working theme changes for the current session.
- The dark outer website extends the supplied inside-app dark palette across the hero, navigation, preview chrome, feature cards, buttons, footer, and privacy section. Document papers and thumbnails stay white. The outer dark card colors are adapted from the reference's pastel card colors because the board supplies a light outer website.
- The reference HTML supplies visual data. Its scripts and sample document content are excluded from the application. Functional controls expose supported operations. The existing landing navigation and reduced-motion behavior continue to apply.
- Verification completed with npm run build and npm run test:all, including lint, strict TypeScript, 45 unit tests, and 39 Chromium browser tests. Coverage includes theme persistence, landing-to-editor continuity, blocked preference storage, style preset integration, responsive dark layouts, offline theme recovery, and 300-page navigation. Both editor modes and landing modes were visually inspected at 1440px, with dark landing checks at 900px, 390px, and 320px. The taller ribbon's thumbnail rail uses the available panel height so the final page stays reachable above the footer.

## M15 - Correctness audit and workflow regressions

- Interpret the follow-up as validating and repairing the available product workflows against the supplied task. The full original specification remains unfinished; the feature checklist and known limits continue to distinguish implemented behavior from pending scope.
- The existing 45 unit tests and 39 browser tests passed before this audit. Four added browser regressions reproduced lost edits/page operations in optimization, stale source-text search, uncleared form values/limits, and source-only comparison/accessibility.
- Optimization now repacks an exported current-workspace snapshot and compares sizes against that snapshot. Search, comparison, accessibility, and text conversion share the effective text model; covered source runs are excluded and inserted link labels are included. Table exports apply page operations and use actual inserted table cells. Multiple tables receive unique XLSX sheet names.
- Text comparison remains case-insensitive and punctuation-insensitive, but detects word-order changes and missing blank pages. This is still a text comparison, with visual comparison pending.
- Existing form detection retains maximum length. Clearing a choice or text limit writes that change to the exported AcroForm. Repeating export marks use the bundled Unicode font when standard fonts cannot encode them.
- Recovery scrolls after the selected page has rendered so asynchronous page sizing does not leave the viewer at the wrong position. OCR applies results only when document, object, and page-setting references still match its starting snapshot, preventing concurrent edits from being overwritten.
- Certificate signing compares the page-plan length with the original page count before reusing unchanged bytes. Deleting trailing pages therefore signs the edited sequence. The tampering regression uses one-byte text decoding so binary PDF bytes cannot shift the mutation offset.
- Browser tests use two workers to bound concurrent Chromium, production-build, and OCR memory usage. The machine's six-worker default produced initial-render timeouts during this audit.
- Final validation passed with npm run test:all and npm run build, including lint, strict TypeScript, 48 unit tests, and 48 Chromium browser tests. The production offline-recovery workflow passed. Existing dependency annotation and bundle-size warnings remain in the production build.
