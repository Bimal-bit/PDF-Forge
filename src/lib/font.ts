export interface FontMatch { family: 'Helvetica' | 'Times-Roman' | 'Courier'; fallback: boolean }

export function matchPdfFont(family: string): FontMatch {
  const value = family.toLowerCase();
  const styled = /bold|italic|oblique/.test(value);
  if (value.includes('helvetica') || value.includes('arial')) return { family: 'Helvetica', fallback: styled };
  if (value.includes('times')) return { family: 'Times-Roman', fallback: styled };
  if (value.includes('courier')) return { family: 'Courier', fallback: styled };
  if (value.includes('sans-serif')) return { family: 'Helvetica', fallback: true };
  if (value.includes('mono')) return { family: 'Courier', fallback: true };
  if (value.includes('serif')) return { family: 'Times-Roman', fallback: true };
  return { family: 'Helvetica', fallback: true };
}
