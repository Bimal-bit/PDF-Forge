export interface FontMatch { family: 'Helvetica' | 'Times-Roman' | 'Courier'; fallback: boolean }

export function matchPdfFont(family: string): FontMatch {
  const value = family.toLowerCase();
  if (value.includes('helvetica') || value.includes('arial') || value.includes('sans-serif')) return { family: 'Helvetica', fallback: false };
  if (value.includes('times') || value.includes('serif')) return { family: 'Times-Roman', fallback: false };
  if (value.includes('courier') || value.includes('mono')) return { family: 'Courier', fallback: false };
  return { family: 'Helvetica', fallback: true };
}
