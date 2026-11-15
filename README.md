# PDFForge

PDFForge is a browser-local PDF editor built with React, TypeScript, pdf.js, and pdf-lib. It supports local opening/rendering, paragraph-block formatting and reflow, inserted objects, annotations, catalog-preserving page operations, advanced AcroForms, local P12 certificate signing, offline OCR, and document/image conversions. The full specification remains unfinished. See [FEATURE_CHECKLIST.md](FEATURE_CHECKLIST.md) for the audited scope.

Use Node 22.12 or newer. The illustrated workflows are documented in [USER_GUIDE.md](USER_GUIDE.md).

![PDFForge block formatting](docs/images/formatting.png)

## Run

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. Choose **Open PDF** or drop a PDF onto the workspace. Double-click text to edit a paragraph block, then use Home for formatting and wrapping. Change inserted text, comments, fields, and signer values in the right sidebar. Page operations and conversion tools are in **Tools**. The download icon exports the edited PDF.

IndexedDB saves source bytes, object edits, and page settings every five seconds. The footer reports save success or failure. The last saved workspace recovers after reload.

## Validate and preview

```sh
npx playwright install chromium
npm run test:all
npm run build
npm run preview
```

Individual commands are `dev`, `build`, `preview`, `lint`, `typecheck`, `test`, `test:e2e`, and `test:all`. The validation suite runs ESLint, TypeScript, Vitest, and Chromium Playwright tests. The production build is a separate check.

Tests include export/reparse, font selection, history, search, security restrictions, recovery after refresh, editing after reorder, duplicated form export, generated 300-page navigation, a tablet-width screenshot, and production offline recovery. Browser tests start the development server and build/launch an isolated production preview. Remaining complex-document, cross-browser, update-lifecycle, and security acceptance gaps are recorded in the checklist.

## Privacy

Opening a PDF reads it in the browser only. Autosave uses that browser’s IndexedDB; no upload or server is involved.

In-place edits paint overlays over source text. Original text remains extractable. Redaction and sanitization use the approved rendered-image method and include all pending edits and page settings. Secure copies lose searchable text, interactive fields, tags, bookmarks, and signatures. Password protection creates `.pdfg` packages. Tools provides P12/PFX signing and local integrity verification. Issuer trust/revocation checks and standard encrypted PDF output remain unfinished.

Text/document and page-image exports include the supported current edits and page plan. Imports of DOCX, HTML, Markdown, text, and images produce basic readable PDFs. Some legacy analysis/optimization tools remain source-based. Review [KNOWN_LIMITS.md](KNOWN_LIMITS.md) for the remaining conversion and security limitations.

## New workflows

- Choose Tools, then Offline OCR for English, Spanish, or combined recognition. Recognition uses bundled data and adds searchable text. Cancel OCR discards partial results.
- Insert supports radio, dropdown, list, date, and reset-button fields. Tools detects existing forms and imports JSON/CSV field values. Edit properties in the object sidebar.
- Tools, then Certificate signing accepts a P12/PFX file and password. Sign and download includes current edits. Verification reports signed-byte integrity, coverage, and certificate dates. Issuer trust requires your trusted PDF reader or trust store.
- Tools exports DOCX, Markdown, JPEG, WebP, XLSX, and ZIP alongside PDF, TXT, HTML, PNG, and CSV. Import document accepts images, TXT, Markdown, HTML, and DOCX.
- Sample PDFs are in fixtures. Run node scripts/generate-fixtures.mjs to regenerate them.
