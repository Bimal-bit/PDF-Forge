import { fontCatalog } from './fontCatalog';

const compact = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
const families = [...fontCatalog].sort((a, b) => b.family.length - a.family.length);

export function catalogFont(name: string) {
  const value = compact(name.replace(/^[A-Z]{6}\+/, ''));
  return families.find((font) => {
    const family = compact(font.family);
    return (
      value === family ||
      (value.startsWith(family) &&
        /^(regular|roman|medium|semibold|demibold|bold|black|heavy|light|thin|italic|oblique|extrabold|extralight|ps|mt|[0-9])/.test(
          value.slice(family.length),
        ))
    );
  });
}

export function originalFontFamily(name: string): string {
  return (
    catalogFont(name)?.family ??
    name
      .replace(/^[A-Z]{6}\+/, '')
      .replace(
        /[-,](regular|roman|medium|semi.?bold|demi.?bold|bold|black|heavy|light|thin|italic|oblique).*$/i,
        '',
      )
      .replace(/(PS)?(BoldItalic|BoldOblique|Bold|Italic|Oblique|Regular)?MT$/i, '')
      .trim()
  );
}

export const standardFamilies = ['Helvetica', 'Times-Roman', 'Courier'] as const;

export function fontIdentity(name: string): string {
  const known = catalogFont(name);
  if (known) return known.family;
  if (/^(arial|helvetica)/i.test(name)) return 'Helvetica';
  if (/^times/i.test(name)) return 'Times-Roman';
  if (/^courier/i.test(name)) return 'Courier';
  return originalFontFamily(name).toLowerCase();
}
