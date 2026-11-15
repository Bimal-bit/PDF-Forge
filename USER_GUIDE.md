# Using PDFForge

PDFForge processes documents in your browser. The application bundles its PDF renderer, OCR workers, language models, and Unicode font. Use the latest supported Node 22 release for development.

## Open, recover, and export

1. Run `npm install` and `npm run dev`, then open the URL printed by Vite.
2. Choose **Open PDF** or drop a PDF onto the document canvas.
3. Use the thumbnails or outline to navigate. View changes zoom from 10 to 500 percent.
4. The footer changes to **Saved locally** after the five-second recovery save completes. Reload restores the saved bytes, edits, and page settings.
5. Choose the download icon in the title bar to export an edited PDF.

The current browser profile owns the recovery data. Clearing its site storage removes that recovery data. Unsaved edits inside the five-second interval can be lost on a crash.

Opening validates the PDF before replacing your workspace. A damaged or password-protected file reports an error and keeps your current edits. Unlock password-protected PDFs before opening them.

Find in document searches the current page sequence, including supported replacement text, inserted text, links, tables, and detected field values. Covered source text is excluded from this search. Matching ignores case; replace, regex, and result cycling remain unfinished.

## Edit text and formatting

Double-click document text to edit a geometry-grouped paragraph. Click outside the editor to commit it. The object sidebar also edits text directly and supports multiline values.

Home selects the text block to format. Change font family, size, bold, italic, underline, strikeout, color, alignment, style, block width, line spacing, character spacing, list style, or indentation. Scroll the ribbon horizontally to reach controls toward its end. Clear formatting resets the supported block properties.

![Home formatting and the object sidebar](docs/images/formatting.png)

Reflow wraps within the block width. Inserted blocks grow upward from their bottom position. Geometry-based paragraph grouping can need correction in complex columns. Normal edits cover source content visually, while the original source layer remains in an ordinary edited export.

## Insert objects and annotations

Insert adds text, images, rectangles, tables, links, form fields, and typed signature lines. Objects use default geometry, with field geometry available in the form properties. The sidebar edits supported values and removes objects.

Review adds highlights, notes, predefined stamps, and linear measurements. Supported annotations include PDF appearance streams. PDFForge XFDF import/export exchanges its own annotation XML schema. Other vendor schemas require additional interoperability work.

## Manage pages

Tools moves the selected page up or down, rotates it, deletes it, duplicates it, or splits it into a separate PDF. Merge PDFs combines selected files locally. Header/footer text accepts `{page}`, and Tools also sets watermark and Bates numbering.

Merged files retain supported form fields. If inputs use the same field names, PDFForge renames the colliding form trees so their values remain independent. Open the downloaded merge and choose Detect form fields to fill them.

Ordinary page plans retain source metadata, bookmarks, names, page labels, and form registrations. Deleted-page destinations point to the first surviving page. Duplicated pages share the PDFForge source-page edit layer and rotation. Existing copied form fields receive independent registrations.

## Fill and create forms

Tools, then Detect form fields loads supported existing AcroForms into the sidebar. Insert creates text, checkbox, radio, dropdown, list, date, reset-button, and visible signature fields.

The sidebar sets values, choice options, required/read-only flags, multiline text, maximum character count, and new-field geometry. Date fields store an ISO date. Reset buttons reset fields in PDF readers that support standard ResetForm actions.

Select Choose to clear a radio, dropdown, or list selection. Clear Maximum characters to remove an existing text-field limit.

Tools exports form values as JSON. Import form data accepts a JSON object or the first data row of a CSV. Keys use the existing PDF field name or the new field label. Duplicate labels receive an ID suffix in exported data so both values survive.

Mail merge CSV replaces `{{column}}` tokens in text, links, and form values and downloads one PDF per row. Quoted multiline cells and escaped quotes are supported. Cell edges are trimmed.

## Sign with a certificate

Open Tools, then Certificate signing. Select a P12/PFX certificate, enter its password and a reason, and choose Sign and download. The generated PDF includes the current edits and a CMS/PAdES B-B signature.

Verification reports signed-byte integrity, coverage, and certificate validity dates. Issuer trust and revocation need your trusted reader or trust store. The app keeps certificate material in session memory and clears the password after a successful signature. Additional signatures on an unchanged file use its original bytes. Changes to signed content can invalidate earlier signatures.

## Recognize scanned pages

Tools, then Offline OCR supports English, Spanish, and a combined mode. Recognize document adds a searchable text layer with local worker progress. Cancel OCR stops the operation and discards partial results.

If you edit the document while recognition runs, PDFForge preserves those edits and discards the stale OCR result. Run recognition again to include the updated content.

Recognition depends on scan quality. Inspect the recognized text before relying on it. Already searchable pages can receive duplicate text when OCR is applied again. The first offline installation caches the bundled engines and models and therefore downloads more application assets than the basic editor.

## Redact and sanitize current edits

Enter exact text in Tools and choose Export redacted copy. Matching covers whole intersecting text runs. Scan-only pages need OCR before text matching. Sanitize PDF uses the same rendered-copy pipeline without text masks.

Both operations export the current edits, form values, annotations, marks, rotations, and page sequence first. They then build fresh page images at twice point resolution and verify the result has no extractable text. Source metadata, scripts, attachments, and hidden text are excluded by construction.

Secure output is flattened. It loses searchable text, interactive fields, tags, bookmarks, vector fidelity, and certificate signatures. Normal edited export preserves the supported editable structures. Review the secure copy visually before distribution.

## Convert and import

Tools exports TXT, HTML, Markdown, DOCX, PNG, JPEG, WebP, table CSV/XLSX, and a ZIP of all page PNGs. Export print PDF flattens form appearances and sets viewer print scaling to None. Text/document and image exports include the supported current edits and page plan.

Import document accepts PNG, JPEG, WebP, TXT, Markdown, HTML, and DOCX. Document imports preserve readable text with basic layout. HTML retains paragraph, line-break, and table-cell text boundaries. Original complex layouts, embedded images in DOCX/HTML, and mixed typography need further conversion work. Table detection is heuristic and can misclassify prose.

Optimize PDF repacks the current edited PDF and reports its size change against that edited export. Compare PDF checks current page text against another local PDF, including word order and page count. It ignores case and punctuation and does not compare visual layout.

## Samples and validation

The fixtures directory contains `text.pdf`, `scanned.pdf`, `form.pdf`, `multi-column.pdf`, and `large.pdf`. The large sample has 300 pages. Regenerate samples with `node scripts/generate-fixtures.mjs`.

Run `npm run test:all` for lint, strict type checks, unit tests, and browser workflows. Run `npm run build` for the production bundle. The browser suite also builds a production preview and checks offline recovery. Broader real-world and cross-browser acceptance limits are listed in [KNOWN_LIMITS.md](KNOWN_LIMITS.md).
