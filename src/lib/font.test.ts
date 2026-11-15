import { describe, expect, it } from 'vitest';
import { matchPdfFont } from './font';

describe('PDF font matching', () => {
  it('keeps a compatible built-in font without a fallback warning', () => {
    expect(matchPdfFont('Arial, sans-serif')).toEqual({ family: 'Helvetica', fallback: false });
  });

  it('uses Helvetica and marks an unknown embedded font as a fallback', () => {
    expect(matchPdfFont('g_d0_f1')).toEqual({ family: 'Helvetica', fallback: true });
  });

  it('discloses fallback when only a generic family or unsupported font style is available', () => {
    expect(matchPdfFont('sans-serif')).toEqual({ family: 'Helvetica', fallback: true });
    expect(matchPdfFont('serif')).toEqual({ family: 'Times-Roman', fallback: true });
    expect(matchPdfFont('monospace')).toEqual({ family: 'Courier', fallback: true });
    expect(matchPdfFont('Helvetica-Bold')).toEqual({ family: 'Helvetica', fallback: true });
  });
});
