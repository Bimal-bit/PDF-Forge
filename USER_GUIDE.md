# Using PDFForge

PDFForge processes documents in your browser. The application bundles its PDF renderer, OCR workers, language models, and Unicode font. Use the latest supported Node 22 release for development.

## Open, recover, and export

1. Run `npm install` and `npm run dev`, then open the URL printed by Vite.
2. Choose **Open PDF** or drop a PDF, PNG, JPEG or WebP onto the document canvas. Images open as proportional PDF pages with Offline OCR ready. The landing page also offers **Start a blank PDF** for a new A4 document.
3. Use the thumbnails or outline to navigate. View changes zoom from 10 to 500 percent.
4. The footer changes to **Saved locally** after the five-second recovery save completes. Reload restores the saved bytes, edits, and page settings.
5. Choose the download icon in the title bar to export an edited PDF.

The current browser profile owns the recovery data. Clearing its site storage removes that recovery data. Committed changes also save when you hide or leave the page. A crash or forced browser shutdown can still interrupt a save; finish a text edit and export a copy for safekeeping.

**Search actions** or Ctrl+K / ⌘K opens the command search. Type to filter, use Up/Down to choose, and press Enter to run. Tab stays inside the dialog; Escape, its Close button, or a click outside dismisses it and restores focus. An empty search result offers suggested terms. The quick text command uses the same current-page placement and Undo behavior as Home. The first keyboard link skips directly to the document.

Opening validates the PDF before replacing your workspace. A damaged or password-protected file reports an error and keeps your current edits. Unlock password-protected PDFs before opening them.

Find in document searches the current page sequence, including supported replacement text, inserted text, links, tables, and detected field values. Covered source text is excluded from this search. Document search ignores case. Home provides literal replacement within selected text blocks or runs. Regex matching and individual-occurrence highlighting remain pending.

## Use on a phone

The page fits your screen automatically. **Pages** and **Inspector** above the document open one panel at a time; tap the same button or the dimmed area to close it. **Find text** and **Scan text** open search and OCR directly. Swipe command groups or the document view bar horizontally to reach additional controls. **Tools** above the page hides or shows ribbon commands; it starts collapsed on short landscape screens to leave room to read. Tap document text to edit it, and export using the download icon in the title bar.

The landing menu opens Features, Tools, How it works, Privacy and the bundled guide. Escape closes the menu and returns focus to its button; tapping outside also closes it. The first keyboard link skips to the starting tools. Interface text uses local Inter consistently. Document fonts remain independently editable. Browser gesture zoom, additional OCR languages and automatic camera/deskew capture remain outside the implemented controls.

## View and read

The bar above the document contains the single set of zoom, automatic-fit, and page-navigation controls. It stays available as you change ribbon tabs. **View** contains workspace visibility and reading options.

- Enter **Zoom percent** and press Enter or leave the field to apply it. Values are bounded to 10–500%. **100%** uses one CSS pixel per PDF point. **Fit width** and **Fit page** adapt to the active page's crop and rotation, window size, and visible panels, within the same zoom bounds. The plus/minus controls or a custom percentage leave automatic fit.
- Use first/previous/next/last page or enter a **Page number**. Numbers follow the displayed page order, including duplicates. Scrolling updates the current page and highlighted thumbnail. Entering the active page again reveals its top. Properties shows the current page-plan count.
- Toggle **Navigation**, **Properties**, and **Document search** independently. **Reading focus** hides both panels and search; Escape or **Exit reading focus** restores your chosen layout. The ribbon remains available.
- **Night reading** inverts the main document's on-screen colors, including images and overlays. Thumbnails retain their normal colors. Downloads retain their original colors and text. Night reading works independently of the application theme.
- Home's **Find** or Ctrl+F / ⌘F reveals and focuses document search. Enter / Shift+Enter or the arrow buttons cycle forward/backward through matching pages, wrapping at the ends. The counter includes all occurrences; navigation operates by page. Hiding search retains its query until another document opens.

Viewing changes do not consume document Undo or clear Redo. These viewing preferences last for the app session; recovery continues saving the selected page every five seconds. Split views, document tabs, presentation mode, user bookmarks, selection zoom, and a magnifier are still pending.

The left **Navigate** panel switches between **Pages** and **Outline**, including with Left/Right arrow keys while a tab has focus. Page previews retain the page's proportions and follow the selected page. Outline displays embedded bookmarks with expandable sections, filtering, page badges, and Expand/Collapse all. Destinations follow reordered pages; a bookmark to a duplicated source page stays on the active copy when possible. Missing/deleted/external destinations remain unavailable. PDFs without bookmarks show a clear empty state.

Drag either panel edge to resize it. A focused resize handle supports Left/Right arrows; Home or a double-click restores the default width. Navigation supports 180–340 px and the inspector supports 240–440 px. Widths last for this app session.

The right **Inspector** has **Objects** and **Document** sections. Search object text/labels or choose Current page/All pages. Click an object heading to select and reveal it. Cards show the object's displayed pages and keep the existing editing and Remove/Undo workflow. Document shows the file name, page count, source size, and recovery information. Choice/date fields use their dedicated editors, without a second generic value input.

## Insert content

The **Insert** tab groups Content, Tables & links, Shapes & equations, and Fillable forms. Use **Place at** to choose the top, center, or bottom of the current page. New quick inserts stagger slightly to stay distinguishable. Existing page content does not move. Inserted objects are selected and revealed in the document scroller.

- **Text box** adds a block you can type into and format in Home. **Today's date** adds the current local date as fixed YYYY-MM-DD text.
- **Image** accepts a local PNG, JPEG, or WebP (up to 20 MB and 16 million pixels). Its proportions and transparency are preserved. Use Layout > Image tools for cropping, rotation, masks, and tone adjustments.
- **Add table** opens a cell editor. Choose 1-10 rows and 1-6 columns, enter values, optionally shade the first row, and set width, height, and position in points. The grid retains overlapping cells when resized. Text wraps and scales between 6 and 10 pt. Enlarge the table or shorten values when a cell needs more room. Select a table in the Insert **Object** picker and choose **Edit table** to revise it.
- **Add link** accepts https://, http://, mailto:, and tel: destinations. A www. address uses HTTPS. Set display text or leave it blank to display the destination. Select the link in **Object** and choose **Edit link** to update it. Links remain clickable in exported PDFs.
- Choose Rectangle, Ellipse, Diamond, or Terminator and press **Add shape**. **Shapes & connectors** opens the existing diagram editor; **Equation editor** opens the vector math editor. These advanced editors provide their own position controls.
- Form buttons add text fields, checkboxes, radio groups, dropdowns, lists, date fields, reset buttons, or a visible signature line. Edit values and properties in the object sidebar. The signature line is a visual name, while certificate signing remains in Tools.

**Import CSV** in the table dialog loads a local UTF-8 file, including its first row. Quoted commas, quotes, line breaks, and empty cells/rows are preserved. Import supports up to 256 KB, 10 rows, 6 columns, and 2000 characters per cell. Review or edit the cells before saving. **Download table CSV** saves the current draft cells.

Select an inserted object in the Insert **Object** picker and choose **Object tools** to move it using point coordinates. Images, shapes, tables, and new form fields also expose width and height. **Keep image proportions** locks the opening aspect ratio. **Duplicate object** creates an independent copy nearby. **Remove object** removes the selected object and its attached diagram connectors. Both actions support Undo. Existing connectors follow moved shapes.

Each insert or table/link save is one Undo step. Changes recover locally and export with the current page plan. All preparation happens in the browser, including when offline after the app has been cached.

## Edit text and formatting

Click document text to place a normal caret and type directly on the page. The editing surface has no visible box. Each clicked run retains its supported source font, size, bold, italic, underline, color, spacing, and baseline. Home shows its formatting. Click outside to commit changes, or press Escape to cancel. Leaving unchanged text creates no replacement. Click previously edited text to edit it again. Enter also opens focused text. The object sidebar supports multiline values.

Home selects the text block to format. Change font family, size, bold, italic, underline, strikeout, color, alignment, style, block width, line spacing, character spacing, list style, or indentation. Scroll the ribbon horizontally to reach controls toward its end. Clear formatting resets the supported block properties.

Paragraph alignment, lists, indentation, and block width apply to inserted text boxes and Layout frames. Native source runs retain their original positions; those layout controls are disabled with a note. Font, emphasis, color, line/character spacing, and supported text styles remain available for source runs. Paragraph previews and exports share their line geometry, including wrapping and justification.

Choose **Replace text** in Home to replace a literal phrase in the selected block or selected source runs. Use **Select all text** first to include offscreen pages. The dialog shows matches and before/after values. **Match case** controls capitalization matching. Replacement searches each block separately and applies to complete selected runs/blocks. Each application is one Undo step and participates in tracked text changes.

Choose **Clean up text** to collapse repeated spaces/tabs, trim each line, or remove empty lines. Review the preview before applying. Supported formatting and placement are retained. Home inserts new text near the visible page's bottom margin and reveals it for editing, including on cropped or rotated pages.

Numeric fields accept ordinary typing, including fractional font sizes, decimal spacing, and negative character spacing. Valid values preview as you type. Press Enter or leave the field to clamp an out-of-range value. Font size is 6–144 pt, indent 0–200 pt, width 20–2000 pt, line spacing 0.8–4, and character spacing −2–20 pt. Clearing an input and leaving it restores the previous value.

To select multiple lines, drag across the text on the page, including from an active caret editor into neighboring lines. You can also enable **Home → Select text** first. Use **Select all text** or **Ctrl+A** (**Command+A** on macOS) to select editable text throughout the active document, including offscreen pages. In search boxes, form controls, sidebar text fields, and dialogs, the shortcut retains its usual input behavior.

With text selected, Home's font, size, emphasis, color, paragraph controls, saved styles, and Paste formatting apply to the selected lines/blocks together. The selection stays highlighted when you use the ribbon. Formatting applies to complete intersected source runs or existing blocks, including partially selected boundary runs. Each operation has one Undo step. **Change case** updates the selected blocks together and participates in tracked changes. **Ctrl+C** copies the selected current text without covered original text or editor labels. Press **Escape** or toggle **Select text** off to return to caret editing. Selecting several lines does not combine them into one typing box.

Use **Home → Add text** to insert a block on the current page, or **Find** to focus document search. New text and inserted snippets are brought into the visible document canvas. The size buttons increase or decrease the selected block by one point, within 6–144 pt. **Change case** transforms the whole selected block to uppercase, lowercase, Title Case, or Sentence case. Title/sentence capitalization is a simple text transformation; review names and abbreviations afterward. Text changes support undo, redo, tracked changes, and local recovery.

The selection bar below the commands stays visible while the ribbon scrolls. It shows the current block and its whitespace-delimited word count and character count (Unicode code points). Choosing a block from another active page takes you to that page.

To reuse formatting immediately, select a block and choose **Copy formatting**, select the target, and choose **Paste formatting**. This copies supported font and paragraph settings while retaining the target's text, position, width, and flow links. Pasting also applies to an active Smart text match group. Undo reverses the paste in one step. For a source-only font, choose a bundled font or import its matching font before copying. Copied formatting lasts until you leave Home or change documents. Use **Styles & snippets** for persistent cross-file presets.

The font picker includes 100 bundled families with regular, bold, italic, and bold-italic faces. These fonts work offline and are embedded into exported PDFs. Source edits reuse the original PDF font and glyph codes when possible, including unembedded fonts. Embedded font programs also recover with your edits. When a subset lacks new letters, the bundled full family can supply them. Missing glyphs or variants can require **Home → Import font** with its matching `.ttf` or `.otf`, or a bundled font selection.

![Home formatting and the object sidebar](docs/images/formatting.png)

Inserted blocks wrap within their width. Source runs retain their original anchors and neighboring styles. Longer replacements can overlap neighbors until repositioned. Underline detection supports nearby thin vector rules. Scan-only text needs OCR. Normal edits cover source content visually, while the original source layer remains in an ordinary edited export.

### Match similar text

Select a text block in Home and choose **Smart text match**. The button shows the number of matching blocks across current pages. Font family, bold/italic, and size within 5% or 0.5 points determine the group. Choose formatting or apply a saved style to update the group together. Undo reverses each group formatting operation in one step. Click the matched-block button to leave the group.

Matching uses the supported fallback font families and groups compatible source lines into paragraphs. Source ink colors and embedded-font identity can change during replacement. Blocks whose covers would overlap unmatched text are skipped. Angled source text and vertical writing require manual editing. Changing text, selection, page order, history, or ribbon tabs ends the group.

### Save styles and snippets

Choose **Home → Styles & snippets**. In **Styles**, enter a name, choose Paragraph or Character, and select **Save selected style**. Paragraph presets capture font and paragraph settings. Character presets apply font settings to entire blocks and preserve alignment, indentation, lists, and line spacing. Apply a saved style to the selected block or active matched group.

Reusable entries need a bundled font or a matching imported font face. A source-only font can be reused inside its original PDF without being transferable to another file; select a bundled font or import its matching TTF/OTF before saving that style/snippet. Older unsupported entries report this requirement before application/insertion. Inserting a snippet exits text-selection mode and selects the new block for formatting.

In **Snippets**, enter a name and text, or choose **Use selected text**. **Save snippet** stores its text and current formatting. Set X, Y, and Width in PDF points measured from the bottom left, then choose **Insert** beside a saved snippet. It inserts on the current page and supports workspace undo, recovery, and export.

The library is shared across files in this browser profile and site. Saves and deletions persist immediately. Each save creates a separate record. Clearing site storage removes the library along with recovery data. Signature snippets store reusable text.

## Insert objects and annotations

Insert adds text, images, rectangles, tables, links, form fields, and typed signature lines. Objects use default geometry, with field geometry available in the form properties. The sidebar edits supported values and removes objects.

The **Review** ribbon groups comments/highlights, stamps/measurement, mark management, tracked changes, and local annotation exchange. **Highlight** adds a rectangle using the selected color. **Add comment** places a note. Choose Approved, Draft, or Confidential before adding a stamp. **Measure** adds a straight measurement. New marks respect the page crop/rotation and are selected/revealed. The author in **Tracked changes** is also used for new comments and highlights.

Choose a mark in the Review context bar or click/keyboard-select it on the page, then choose **Edit mark**. Edit the comment, author, resolution, color, point position, dimensions, stamp label, or measurement units as applicable. Measurement width/height are signed endpoint deltas, so negative values are allowed. **Save review mark** validates the current crop bounds and saves one Undo step; **Cancel** discards the draft. Measurements report PDF-point distances in points, inches, or centimeters and do not calibrate architectural drawing scales.

**Comments & marks** searches text/authors and filters all/current pages, mark type, and open/resolved comments. **Resolve comment** and **Reopen comment** retain the mark on the page. **Go to mark** closes the dialog and reveals it; navigate to a mark on another page before editing its geometry. Deletion supports Undo. Copies of a page share its source marks.

**Export PDFForge XFDF** saves surviving-page marks with Unicode comment/author text and resolution status in PDFForge's XML schema. Page numbers refer to the original source document, even after reordering. Import into the matching source-document bytes. Imports support 1 MB/2000 marks, 5000 characters per comment, and 100 per author; malformed entries or missing source pages reject the entire file. Importing the same IDs again creates independent copies. Other vendor schemas and reading annotations already embedded in a source PDF remain pending. PDF exports include annotation appearance streams, chosen highlight colors, and supported resolution metadata.

## Layout and arrangement

The **Layout** ribbon groups text frames, object arrangement, graphics, page rotation, and page order. The context bar shows the active page and rotation. Use **Object** to select and reveal an object on that page. **Object tools** opens its supported position, size, duplication, and removal controls.

Choose **Align & distribute** and check the objects to arrange. Use **Page** with a point inset or **Selection bounds**, then choose left/center/right or top/middle/bottom alignment. Distribution needs at least three objects and makes equal gaps. **Center group on page** preserves the objects' relative spacing. The numbered preview updates before the document changes. **Reset preview** restores its starting positions; **Apply arrangement** saves all moves in one Undo step. Directions follow the visible page rotation, including cropped pages. Insufficient space reports an error so you can reduce the inset or object sizes.

**Rotate left/right**, **Move page up/down**, **Duplicate page**, and **Delete page** act on the active page. They support Undo, recovery, and PDF export. Copies share source-page object edits and rotation. Arrangement supports inserted content; source replacements retain their source-text editing controls.

## Text flow, columns, and drop caps

Choose **Layout → Text flow & columns**. Choose a **New frame preset** (compact, page frame, two-column, or three-column) and select **Add text box**. The frame fits the current crop bounds and is selected/revealed. Select a box to edit its text, position, width, height, column count/gap, and drop cap. Positions use PDF points from the bottom left. Two/three-column text balances within the frame height. Unsupported frame controls are disabled for native source runs, which retain their original placement path.

Create another box, select the first box, choose the continuation target, and select **Link text boxes**. Targets can be on another page. A story combines each box's stored text in chain order. Edit a box's contribution in the dialog or sidebar. **Unlink continuation** retains the original contributions. Removing a page reflows a story through its surviving frames. Removing a box deletes its contribution.

Matched source paragraphs grow with their content. Their height field becomes available after choosing columns, a drop cap, or a linked continuation. Native source runs keep their own placement controls.

A red plus marks overflow, and Layout reports how much text remains. Enlarge the frames or add a continuation until it fits to export the full story. Unicode fallback widths are approximate. Moving replacement text keeps its source cover at the original location.

## Shapes, connectors, and equations

Choose **Insert → Shapes & connectors** to add process rectangles, decision diamonds, ellipses, or oval terminators. Set a label, color, position, and size. Choose two shapes on the current page and select **Connect shapes**. Drag shapes or use arrow keys to move them. Shift increases keyboard movement to ten points. Connectors follow both shapes through movement, zoom, page rotation, undo, and PDF export. Deleting a shape also deletes its connectors.

Choose **Insert → Equation editor** to enter supported LaTeX and preview it. **Insert equation** adds it on the current page. Select an existing equation to change its input, font size, color, or position, then choose **Update selected equation**. Equations export as vector font glyphs and rules.

Examples include `x^2 + y_1`, `\frac{a}{b}`, `\sqrt{x}`, and `\sum_{i=1}^{n} i`. Fractions, roots, scripts, Greek letters, common operators/functions, and plain text are supported. Matrices, custom macros, packages, automatic delimiter sizing, and full TeX typography remain pending. Invalid or unsupported input shows an error before insertion.

## Image editing

Insert a PNG, JPEG, or WebP, then choose **Layout → Image tools**. Select the image and set crop percentages, clockwise quarter-turn rotation, mask, brightness, and contrast. **Remove background** clears pixels connected to the image edges that match the selected color and tolerance. It works best with uniform backgrounds.

Choose **Preview image edits**, then **Apply image edits** to save the result as a transparent PNG in the document. Crop and rotation update its display dimensions. Closing the dialog cancels a pending operation; reopening starts a fresh draft. Undo restores the previous image in the current session. Edited images recover locally and export with transparency. Editing supports up to 16 million pixels per image.

## Tracked text changes

Choose **Review → Tracked changes**, enable tracking, and enter an author name. Edits to one block accumulate into one pending change until reviewed, retaining its original/current text, contributing authors, and timestamps. Pending records keep following further edits until accepted or rejected.

The review dialog filters pending, accepted, rejected, or all changes. **Go to changed text** selects its block/page. **Accept change** retains the current text. **Reject change** restores the original text or removes a tracked insertion/source replacement. Review actions support Undo and Redo. Settings and review records recover with the workspace. PDF export uses the current text, and review metadata stays in the local workspace.

Use **Search** to match an author or before/after text, and **Pages** to limit the list to the current page. **Accept visible** and **Reject visible** affect pending changes matching these filters in one Undo step. Other pending records remain unchanged. Counts show the scope before applying a batch. **Go to changed text** closes the dialog and reveals the selected block. Removed-page records remain under All pages and cannot be navigated to until their page is restored.

Tracking covers whole-block text. Inline revision markup, formatting/object changes, authenticated author identities, and review-data interchange remain pending.

## Manage pages

The **Tools** ribbon groups Convert documents; Text, images & tables; Pages & assembly; Forms & data; Scan, sign & inspect; Repeating marks; and Privacy & protection. Use **Tool group** to jump to a group, or scroll the command row horizontally. The context bar shows the current page and any running tool. Document tools stay disabled until the page plan is ready.

Layout moves the selected page up or down, rotates it, deletes it, or duplicates it. Tools extracts selected displayed pages into a separate PDF. **Extract pages** opens a range editor with a preview. Enter `1,3-5` or use All/Odd/Even/Current page presets. `5-3` reverses those pages; repeated numbers create copies. Numbers refer to the current displayed page order. The output retains current edits, supported form fields, rotation, metadata, and repeating marks, including the displayed page numbers and Bates values. Range input supports up to 1000 characters and 2000 output pages. Closing the dialog discards a pending download.

**Merge PDFs** combines the files selected in its picker. Header/footer text accepts `{page}`, and Tools also sets watermark and Bates numbering. Leave **Bates start** blank to turn numbering off; committed values are whole numbers from 0 to 999999999.

Merged files retain supported form fields. If inputs use the same field names, PDFForge renames the colliding form trees so their values remain independent. Open the downloaded merge and choose Detect form fields to fill them.

Ordinary page plans retain source metadata, bookmarks, names, page labels, and form registrations. Deleted-page destinations point to the first surviving page. Duplicated pages share the PDFForge source-page edit layer and rotation. Existing copied form fields receive independent registrations.

## Fill and create forms

Tools, then Detect form fields loads supported existing AcroForms into the sidebar. Insert creates text, checkbox, radio, dropdown, list, date, reset-button, and visible signature fields.

The sidebar sets values, choice options, required/read-only flags, multiline text, maximum character count, and new-field geometry. Date fields store an ISO date. Reset buttons reset fields in PDF readers that support standard ResetForm actions.

Select Choose to clear a radio, dropdown, or list selection. Clear Maximum characters to remove an existing text-field limit.

Tools exports surviving-page form values as JSON. **Import form data** accepts a JSON object or a CSV with exactly one data row, up to 1 MB. Keys use the existing PDF field name or the new field label. Duplicate labels receive an ID suffix in exported data so both values survive. Import validates options, text limits, checkbox values (true/false or 1/0), and ISO dates before applying all changes in one Undo step. Read-only fields and reset buttons are skipped. Unknown names do not change the document. Detecting existing fields adds new surviving-page fields in one Undo step and leaves previously detected values intact.

Mail merge CSV replaces `{{column}}` tokens in text, links, and form values and downloads one PDF per row. Quoted multiline cells and escaped quotes are supported. Cell edges are trimmed.

## Sign with a certificate

Open Tools, then Certificate signing. Select a P12/PFX certificate, enter its password and a reason, and choose Sign and download. The generated PDF includes the current edits and a CMS/PAdES B-B signature.

Opening another document clears the selected certificate, password, and reports. Closing signing tools discards pending results. If the document changes while signing or exporting, PDFForge discards that output and asks you to run the operation again with the current edits.

Verification reports signed-byte integrity, coverage, and certificate validity dates. Issuer trust and revocation need your trusted reader or trust store. The app keeps certificate material in session memory and clears the password after a successful signature. Additional signatures on an unchanged file use its original bytes. Changes to signed content can invalidate earlier signatures.

## Recognize scanned pages

Tools, then Offline OCR supports English, Spanish, and a combined mode. Choose **All pages** or **Current page**. **Searchable PDF** preserves the scan appearance and adds a searchable text layer with local worker progress. **Cancel OCR** or closing the dialog stops the operation and discards partial results.

For text inside images embedded in a PDF, choose **Tools → Edit text in images**. **Images inside PDF** recognizes each ordinary raster-image region separately at higher resolution, keeping PDF text outside those regions. Expand **Recognition options** to choose **Whole pages** for unusual image encodings, **Scattered text**, **Paragraph** or **Single line** to control layout, and **Improve faint text** for low-contrast or dark backgrounds. Automatic layout retries weak detection with another segmentation mode. Whole-page recognition can also recognize existing PDF text.

Review detected lines and confidence, correct mistakes, and optionally **Download text** as TXT. **Apply editable text** creates editable regions while leaving unchanged image lettering visually intact. Tap a region to type or edit **Overlay text** in the Inspector. Only a text/format/position change repaints the line. Export adds invisible searchable text for unchanged regions and visible text for edited ones. An empty review line is skipped.

Image pixels do not contain usable font metadata. Replacement lettering is compared against all 100 bundled families in regular, bold, italic and bold-italic styles, plus PDF standard faces. The app uses compact local glyph fingerprints to shortlist faces, then compares the complete line using actual local fonts. Unavailable source faces and blurry images still require manual review.

Before applying, choose **Compare / change font** under a detected line. Compare **Original image lettering** with **Replacement preview**, try suggested matches or any bundled family, adjust emphasis/size/width, or **Import original TTF/OTF**. The selected real font is used by both the editor and PDF writer. Apply waits until a pending font load finishes. An unavailable imported bold/italic variant reports an error rather than silently substituting a different font.

For a line you have already edited, select it in Home and choose **Match image font**. This reads the original source image, keeps your changed wording and placement, and applies the font correction in one undoable step. The comparison controls and original-font import are also available there.

Editing does not automatically shrink the font to fit a longer replacement; long values can overlap neighbors. Unchanged lines preserve their actual original pixels, including after Undo and recovery. Complex backgrounds, arbitrary rotations, mixed fonts within one detected line and exact identification of unbundled fonts remain limited. The source image remains beneath ordinary covers, so this is not secure redaction. Applying OCR materializes prior edits/marks; one Undo restores the complete previous workspace.

If you edit the document while recognition runs, PDFForge preserves those edits and discards the stale OCR result. Run recognition again to include the updated content.

Recognition depends on scan quality. Inspect the recognized text before relying on it. Already searchable pages can receive duplicate text when OCR is applied again. The first offline installation caches the bundled engines and models and therefore downloads more application assets than the basic editor.

## Redact and sanitize current edits

Enter exact text in Tools and choose Export redacted copy. Matching covers whole intersecting text runs. Scan-only pages need OCR before text matching. Sanitize PDF uses the same rendered-copy pipeline without text masks.

Both operations export the current edits, form values, annotations, marks, rotations, and page sequence first. They then build fresh page images at twice point resolution and verify the result has no extractable text. Source metadata, scripts, attachments, and hidden text are excluded by construction.

Secure output is flattened. It loses searchable text, interactive fields, tags, bookmarks, vector fidelity, and certificate signatures. Normal edited export preserves the supported editable structures. Review the secure copy visually before distribution.

## Convert and import

Tools exports TXT, HTML, Markdown, DOCX, PNG, JPEG, WebP, table CSV/XLSX, and a ZIP of all page PNGs. Export print PDF flattens form appearances and sets viewer print scaling to None. Text/document and image exports include the supported current edits and page plan.

Import document accepts PNG, JPEG, WebP, TXT, Markdown, HTML, and DOCX. Document imports preserve readable text with basic layout. HTML retains paragraph, line-break, and table-cell text boundaries. Original complex layouts, embedded images in DOCX/HTML, and mixed typography need further conversion work. Table detection is heuristic and can misclassify prose.

Optimize PDF repacks the current edited PDF and reports its size change against that edited export. **Compare PDF** checks current page text against another local PDF, including word order and page count. After comparison, choose **Comparison report** in the context bar to inspect changed pages, added/removed words, and unchanged pages. **Go to current page** closes the report and reveals that display page. **Download comparison report** saves JSON. Comparison ignores case and punctuation; scans need OCR and visual differences need manual review.

Tools runs one shared conversion/import/export operation at a time. If document bytes, objects, or page settings change while an operation runs, its result is discarded with a retry message. This prevents delayed imports from replacing newer work. Ordinary page navigation remains available. Protected packages are parsed as PDFs before opening, and failed passwords or damaged contents keep the current document. Package export clears its password field after success.

Document import supports up to 20 MB, with up to 16 million pixels for images. Unsupported image encoders report an error instead of downloading a file with the wrong format. CSV/XLSX extraction reports when no table candidates are found. Mail merge accepts up to 1 MB and 200 recipients per operation; separate recipient downloads still depend on browser download permissions.

## Samples and validation

The fixtures directory contains `text.pdf`, `scanned.pdf`, `form.pdf`, `multi-column.pdf`, and `large.pdf`. The large sample has 300 pages. Regenerate samples with `node scripts/generate-fixtures.mjs`.

Run `npm run test:all` for lint, strict type checks, unit tests, and browser workflows. Run `npm run build` for the production bundle. The browser suite also builds a production preview and checks offline recovery. See the [README limitations](README.md#important-limitations) for important export, security, and compatibility constraints.
