# Known limits

Updated on 15 November 2026. The requested completion pass adds rich block editing, catalog-preserving page assembly, advanced forms, local certificate signing, offline OCR, current-edit security exports, and additional formats. The full original product checklist is maintained in `FEATURE_CHECKLIST.md`.

## Editing and document structures

- Home formats whole text blocks with regular/bold/italic font variants, underline, strikeout, color, alignment, spacing, indentation, lists, and styles. Paragraph grouping uses text geometry and can need manual correction in complex columns. Reflow wraps within a block width. Mixed formatting inside one block, cross-page document reflow, format painter, superscript/subscript, and original embedded-font reuse remain unfinished.
- Normal edited exports retain the source document catalog. Reorder and duplication preserve original page references, metadata, bookmarks, name trees, field registrations, and page labels. Deleted-page destinations are redirected to the first surviving page. Duplicate pages share the PDFForge source-page object layer and rotation, while existing PDF form fields receive independent copied registrations.
- Complex PDF structures such as article threads, structure-tree parent indices, portfolios, XFA, and certification permissions still need broader assembly validation. Editing an already signed PDF can invalidate prior signatures. Signing an unchanged file uses the original bytes to preserve earlier incremental signatures.
- Merge preserves supported AcroForm registrations and shared widgets, renaming colliding field trees so their values stay independent. Combining source catalogs, document-level actions, and default form resources across merged inputs still needs broader independent-viewer validation.
- Main pages and thumbnails render lazily. Visited canvases remain allocated, so sustained scrolling through large scans still needs memory benchmarking.

## Forms and signing

- New text, checkbox, radio, dropdown, list, ISO-date text, and reset-button fields export as AcroForms. Existing supported AcroForms can be detected and filled. Required/read-only flags, multiline text, maximum length, new-field geometry, JSON export, and JSON/CSV import are available.
- Explicit tab-order editing, layout-based field detection on flat PDFs, XFA editing, FDF exchange, multi-selection list values, custom button actions, and existing radio-widget geometry editing remain unfinished.
- P12/PFX signing creates a CMS/PAdES B-B signature locally. Verification checks CMS integrity, byte coverage, and embedded certificate dates. Issuer trust, revocation, trusted timestamps, and long-term validation require additional trust data or an external validation workflow. These network-dependent services are excluded by the app's browser-local requirement.
- Typed visible signatures remain available. Drawn, uploaded/camera, saved-signature, and audit-trail workflows remain unfinished.
- CSV cells retain edge trimming. Large mail merges prepare recipient exports concurrently and use separate downloads, so memory and browser download permissions can limit large batches.

## Redaction and sanitization

- The user approved rebuilding secure exports from rendered images. Both operations first export all pending edits, form values, annotations, marks, rotations, and the page plan.
- Text redaction covers the complete text runs intersecting an exact case-insensitive match. It then writes fresh page images and independently verifies the result has no extractable text. This removes hidden source text, annotations, forms, attachments, scripts, and source metadata from the output. Neighboring content within the same matched run can also be covered.
- Secure copies are flattened images at twice PDF point resolution. Searchability, interactive fields, vector fidelity, accessibility tags, bookmarks, and certificate signatures are removed by that operation. Scan-only text needs OCR before text matching. Area/regex redaction, arbitrary image-text recognition during redaction, and adversarial visual-leakage testing remain unfinished.
- Password-protected `.pdfg` packages remain available. Standard encrypted PDF output and PDF permission controls remain unfinished.

## OCR and formats

- OCR uses bundled English and Spanish LSTM models, including a combined language mode. It runs in a local worker with progress and cancellation. Recognition accuracy depends on scan quality. Extra languages, deskew controls, confidence correction, handwriting recognition, and deduplication on already searchable pages remain unfinished.
- TXT, HTML, Markdown, DOCX, page PNG/JPEG/WebP, detected-table CSV/XLSX, and a ZIP of all page PNGs are available. Text-oriented exports use current object edits and the page plan. DOCX preserves supported block formatting where it can associate extracted lines with blocks. Exact reconstruction of original page layout, images, complex tables, and mixed typography in DOCX remains unfinished.
- PNG/JPEG/WebP, TXT, Markdown, HTML, and DOCX import create PDFs locally. Text/document imports preserve readable text with basic wrapping; HTML retains paragraph, line-break, and table-cell text boundaries. Original DOCX/HTML layout, embedded images in those document formats, complete Markdown syntax, and arbitrary HTML styling remain unfinished.
- Source-table extraction is a geometry heuristic and can misclassify prose or split cells. Inserted tables export their actual cells, following the current page plan. XLSX uses literal text cells and unique sheet names. Human review remains necessary for complex source tables.
- Optimization repacks the current edited export, including forms, annotations, marks, rotations, and the page plan. Print PDF flattens forms and sets print scaling. Image downsampling levels and linearization remain unfinished.
- Search, text comparison, accessibility, and local insight use the current page plan and supported text objects, excluding source runs covered by replacement blocks. This is a geometry-based model, not a visual reading-order analysis. Comparison detects word-order changes and missing blank pages but still ignores letter case and punctuation; visual comparison remains unfinished. Undetected source-form values, repeating export marks, and annotation comments are not part of this text analysis.
- OCR discards its results if document content changes during recognition, preserving the newer edits. Run recognition again after finishing those edits.

## Other product and acceptance work

- Annotation placement uses default positions. PDF annotation appearance streams are included for supported highlights, notes, stamps, and measurements. Freehand drawing, threaded comments, and general vendor XFDF interchange remain unfinished. PDFForge annotation XML uses its own schema.
- Range splitting, batch watermark/compression/stamping, object drag handles, comprehensive Word shortcuts, a complete command registry, document version history, full localization, WCAG AA verification, and the other unfinished checklist rows remain tracked separately.
- Empty File and Layout ribbon tabs are hidden pending implemented commands. File opening and export are available in the title bar; page operations remain in Tools.
- Production precaching includes OCR cores, language models, and the Unicode font, increasing offline installation size. Cross-version PWA updates, install icons, and cross-browser acceptance still need additional coverage.
- The automated suite uses Chromium and generated PDFs. Complex real-world PDFs and independent viewer validation remain ongoing acceptance work.

- The bundled Noto Sans font covers additional Latin, Greek, and Cyrillic text. Full CJK and specialized-script font coverage, and styled Unicode fallback fonts, require additional font assets.

- The Design8 website is implemented as the landing page before a PDF opens, including its intro and 3D visual motifs. The landing and editor share light/dark mode with a locally saved preference. The outer dark palette adapts the board's inside-app dark colors. Watch the tour opens the three-step walkthrough, and Docs downloads the local Markdown user guide. The footer's Source label awaits a repository URL. Decorative motion is disabled when the browser requests reduced motion.
