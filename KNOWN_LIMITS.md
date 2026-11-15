# Known limits

M4 supports single-run overlay editing and basic inserted text, images, shapes, tables, and links. Rich document-wide reflow, advanced typography, freeform object manipulation, redaction/security, OCR/conversion, and advanced accessibility features remain scheduled for later milestones.

This M2 build intentionally contains the foundation plus local PDF rendering, thumbnail navigation, outline navigation, text selection, and text search. The following requested capabilities are not yet in the UI because their scheduled milestones have not been implemented:

- Redaction/security, OCR/conversion, and advanced accessibility features (M8–M10).
- Full end-user documentation, fixture suite, and complete feature checklist (M11).

- Thumbnail generation currently favors a simple one-canvas-per-page implementation; extremely large documents may take longer to populate the thumbnail rail even though the main viewer renders lazily.

- M5 annotation placement uses deliberate default positions rather than drag handles or freehand drawing. XFDF exchange supports PDFForge highlights, notes, stamps, and measurements; other vendor annotation types are ignored.

- M6 split exports the currently selected page. Range-based splitting and batch-folder processing remain future work.

- M7 supports PDFForge-created text and checkbox AcroForm fields, local CSV mail merge, and visible typed signatures. It does not yet validate existing third-party fields, create a PKCS#7/CMS signature dictionary, use a certificate, or provide certificate validation.
