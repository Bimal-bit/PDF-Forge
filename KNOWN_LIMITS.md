# Known limits

M4 supports single-run overlay editing and basic inserted text, images, shapes, tables, and links. Rich document-wide reflow, advanced typography, freeform object manipulation, annotations, page tools, forms/signatures, redaction/security, OCR/conversion, and advanced accessibility features remain scheduled for M5–M10.

This M2 build intentionally contains the foundation plus local PDF rendering, thumbnail navigation, outline navigation, text selection, and text search. The following requested capabilities are not yet in the UI because their scheduled milestones have not been implemented:

- Editing and export, annotations, page tools, forms/signatures, redaction/security, OCR/conversion, and advanced accessibility features (M3–M10).
- Full end-user documentation, fixture suite, and complete feature checklist (M11).

- Thumbnail generation currently favors a simple one-canvas-per-page implementation; extremely large documents may take longer to populate the thumbnail rail even though the main viewer renders lazily.
