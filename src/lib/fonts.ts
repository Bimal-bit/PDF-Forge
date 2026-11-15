import type { PDFFont, PDFDocument } from 'pdf-lib';

let unicodeBytes: Promise<ArrayBuffer> | undefined;
export async function unicodeFont(pdf: PDFDocument): Promise<PDFFont> {
  const { default: fontkit } = await import('@pdf-lib/fontkit');
  pdf.registerFontkit(fontkit);
  unicodeBytes ??= fetch('/fonts/NotoSans-Regular.ttf').then((response) => {
    if (!response.ok) throw new Error('The bundled Unicode font could not be loaded.');
    return response.arrayBuffer();
  }).catch((error: unknown) => { unicodeBytes = undefined; throw error; });
  return pdf.embedFont(await unicodeBytes, { subset: true });
}
