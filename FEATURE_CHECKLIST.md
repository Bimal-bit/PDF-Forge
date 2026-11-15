# Specification audit

Reviewed on 15 November 2026 against the supplied PDFForge task. Milestone commit titles describe implementation increments. The complete requested product remains unfinished.

## Capability checklist

| Requested capability | Status | Current scope or remaining work |
| --- | --- | --- |
| Browser-local React/TypeScript application | Done | React 18, strict TypeScript, Vite, Zustand/Immer, IndexedDB, bundled PDF worker. No upload service. |
| Open and drag/drop | Done | Browser-local PDF file intake. |
| Undo and redo | Done within current scope | Patch-based history with no explicit count cap. Session-local. |
| Autosave/recovery | Partial | Source bytes, objects, page settings, and selected page every five seconds. Version history and recent-files UI are absent. |
| Rendering and text selection | Done | pdf.js canvas and selectable text layer. |
| 300-page navigation | Partial | Generated-document smoke test covers opening and last-page navigation. Lazy thumbnails share the viewer worker. Visited page canvases remain allocated. Complex scanned-document performance is unverified. |
| Zoom and view modes | Partial | 10–500% zoom. Fit width/page and two-page mode are absent. Ruler ticks are decorative. |
| Outline | Partial | Existing-bookmark navigation follows the page plan. No bookmark editor or page-label editor. |
| Find and replace | Partial | Case-insensitive source-text search and first-result navigation. No replacement, regex, whole-word option, result cycling, or overlay-text search. |
| PDF export | Done within current scope | Current edits and catalog-preserving reorder/duplication export. Metadata, bookmarks, names, labels, and existing field registrations have round-trip coverage. Specialized PDF structures need broader validation. |
| In-place editing | Partial | Geometry-based paragraph grouping and width-based reflow. Replacement overlays preserve the source layer. Embedded-font reuse, complex reading order, and cross-page reflow remain unfinished. |
| Rich formatting and styles | Partial | Block font/size, bold/italic, underline/strike, color, alignment/justify, line/character spacing, indent, bullets/numbering, styles, and clear formatting. Mixed inline styles, format painter, and super/subscript remain unfinished. |
| Basic insertion | Partial | Text, PNG/JPEG, rectangles, simple fixed tables, and links. Default geometry. No table-cell editor. |
| Advanced insertion | Missing | Lines, arrows, editable bookmarks, date fields, QR/barcodes, and equations. |
| Object manipulation and layers | Missing | Drag/resize handles, multi-select, grouping, alignment, guides, snapping, lock/hide, and z-order. |
| Keyboard and context commands | Partial | Application undo/redo and Ctrl+K. Native undo remains available in inputs. Most Word shortcuts, clipboard workflows, and context menus are absent. |
| Command palette | Partial | Search filters four actions. Most ribbon commands have no palette entry. Focus trap and arrow-key navigation are absent. |
| Spell/grammar tools | Missing | No local dictionary or complete spelling/grammar workflow. |
| Page operations | Partial | Move up/down, rotate, delete, duplicate, current-page split, merge. Thumbnails track the page plan. Copies share source-page edits and rotation. |
| Advanced page operations | Missing | Drag reorder, multi-select, blank/template insertion, range/size/bookmark split, interleave, crop, resize, deskew. |
| Repeating marks | Partial | Exported header/footer, watermark, Bates numbering, and `{page}`. No live preview, master templates, `{total}`, or `{date}`. |
| Batch processing | Partial | All-page PNG ZIP export. Batch watermark/compress/stamp and recipient ZIP bundling remain unfinished. |
| Metadata, attachments, OCG | Missing | No document metadata editor, embedded-file panel, or optional-content layer viewer. |
| Annotations | Partial | Highlights, notes, stamps, and measurements include PDF appearance streams. Drawing gestures and the remaining annotation types are unfinished. |
| Comments and exchange | Partial | Author/comment editing and PDFForge-specific XML in an XFDF envelope. General vendor interoperability is unfinished. No threads, replies, status/filters, summary export, JSON exchange, or flatten option. |
| Comparison | Partial | Page-level multiset word changes. Reordered words can compare equal. No visual/side-by-side comparison or change navigation. |
| Reading tools | Missing | Reading mode, text-to-speech, and focus ruler. |
| Forms | Partial | Text, checkbox, radio, dropdown, list, date, and reset-button creation. Existing-field detection/filling, properties, JSON export, and JSON/CSV import. Tab order, flat-field detection, XFA, and FDF remain unfinished. |
| Mail merge | Partial | CSV token substitution with quoted multiline cells, escaped quotes, and individual PDF downloads. Cells retain edge trimming. Large batches export concurrently and can hit memory/download limits. No JSON or ZIP bundling. |
| Visible signatures | Partial | Typed names on visible signature lines. No drawing, image/camera capture, saved signatures, required-field navigation, or audit trail. |
| Digital certificate signing | Done within local scope | P12/PFX CMS/PAdES B-B signing, local integrity/tamper checks, byte coverage, and certificate dates. Issuer trust, revocation, trusted timestamps, and long-term validation require additional trust workflows. |
| Redaction | Partial | Approved image-based output includes current edits and the page plan, masks complete matching text runs, and verifies no extractable text. Scan-only pages need OCR. Area/regex tools and adversarial visual testing remain unfinished. |
| Sanitization | Done within rendered-copy scope | Rebuilds current edited pages as fresh images, excluding source payloads and hidden text. Output loses searchable text, interactive fields, bookmarks, tags, and signatures. |
| Password/security | Partial | Local AES-256-GCM `.pdfg` packages and reopen. Standard encrypted PDF output, permission controls, and known-password PDF unlock are absent. |
| PDF/A/accessibility | Partial | Local text/object heuristic checks. No PDF/A validation, tag/reading-order editor, embedded-graphic contrast checking, document-language editing, or image alt-text editor. |
| OCR | Done within bundled-language scope | English, Spanish, and combined offline recognition, searchable text layer, worker progress, and cancellation. Extra languages and correction/deskew workflows remain unfinished. |
| Conversion | Partial | Current-edit TXT, HTML, Markdown, DOCX, PNG/JPEG/WebP page images, table CSV/XLSX, and PNG ZIP. Exact DOCX layout reconstruction and reliable complex-table detection remain unfinished. |
| Other exports/imports | Partial | Image, TXT, Markdown, HTML, and DOCX import with basic readable layout. Print PDF flattens forms and sets print scaling. Complex imported document layouts remain unfinished. |
| Compression | Partial | Object-stream repacking and size feedback. No quality levels, image downsampling, unused-object cleanup, or linearization. |
| AI | Partial | Deterministic local extractive insight. API keys, generative Q&A, rewriting, translation, grammar fixes, structured extraction, and image descriptions are absent. |
| PWA/offline | Partial | Production service worker, build-generated asset precaching, and manifest. A Chromium test covers offline reload and edit recovery with no external requests. Installation icons, explicit install UI, and cross-version update behavior remain unfinished. |
| URL intake | Missing | No open-from-URL workflow. |
| Themes/localization | Partial | Light/dark toggle and English/Spanish ribbon labels. High contrast, comprehensive dark styling, and three additional complete language samples are absent. |
| Accessibility/polish | Partial | Labels and tablet-width smoke coverage. Full keyboard navigation, modal focus management, WCAG AA audit, and first-run tour are unfinished. |
| Documentation | Done within current scope | Setup, usage guide, application screenshots, contributing guide, decisions, limits, and this checklist. |
| Fixtures | Done | Text, scanned, form, multi-column, and 300-page PDFs with a local regeneration script. |

## Verification boundaries

- Validation results are reported with the delivered changes. The production bundle still triggers Vite's size warning. Checks cover supported inputs and implemented scope.
- Regression tests exercise recovery after refresh, reordered in-place edits, duplicate-page forms and signatures, command filtering, redaction stream removal, large-document navigation, and tablet rendering.
- Many original browser tests check control availability. Complete outcome coverage for every requested feature remains unfinished.
- Tests use Chromium. A production offline-recovery smoke test is included. Firefox, WebKit, independent PDF viewers, complex real-world documents, cross-version updates, and security certification remain unverified.
- The generated 300-page smoke case measures initial rendering and basic navigation. Sustained-scroll memory, complex fonts/images, and the global performance target across supported hardware need a dedicated benchmark.

## Highest-priority remaining improvements

1. Complete object manipulation, mixed inline formatting, and complex document reflow.
2. Broaden independent viewer, trust-chain, and adversarial secure-export validation.
3. Improve OCR correction, extra language coverage, and complex DOCX/HTML layout conversion.
4. Finish tab-order tools, flat-form detection, range/batch page operations, and advanced annotations.
5. Extend cross-browser, accessibility, PWA-update, fixture, and sustained-performance coverage.
