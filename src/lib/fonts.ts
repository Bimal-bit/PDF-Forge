import type { PDFFont, PDFDocument } from 'pdf-lib';

let unicodeBytes: Promise<ArrayBuffer> | undefined;
export function unicodeFontBytes(): Promise<ArrayBuffer> {
  unicodeBytes ??= fetch('/fonts/NotoSans-Regular.ttf').then((response) => {
    if (!response.ok) throw new Error('The bundled Unicode font could not be loaded.');
    return response.arrayBuffer();
  }).catch((error: unknown) => { unicodeBytes = undefined; throw error; });
  return unicodeBytes;
}

export async function unicodeFont(pdf: PDFDocument): Promise<PDFFont> {
  const { default: fontkit } = await import('@pdf-lib/fontkit');
  pdf.registerFontkit(fontkit);
  return pdf.embedFont(await unicodeFontBytes(), { subset: true });
}
