import { describe, expect, it } from 'vitest';
import { localDocumentInsight } from './accessibility';

describe('local document assistant', () => {
  it('summarizes text without remote inference', () => {
    expect(localDocumentInsight(['PDFForge keeps content local. PDFForge checks local content.'])).toContain('Key terms: pdfforge');
  });
  it('handles image-only documents clearly', () => {
    expect(localDocumentInsight([''])).toContain('does not send');
  });
});
