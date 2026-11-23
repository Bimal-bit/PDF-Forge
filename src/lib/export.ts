import { PDFArray, PDFDocument, PDFName, PDFString, PDFHexString, PDFFont, StandardFonts, degrees, rgb } from 'pdf-lib';
import type { AnnotationObject, EditorObject, FormObject, OpenDocument, PageSettings } from '../types';
import { writeFormField } from './formFields';
import { applyPagePlan } from './pagePlan';
import { prunePageFields, registerPageFields } from './formAssembly';
import { drawTextBlock } from './textLayout';
import { unicodeFont } from './fonts';
import { annotationAppearance } from './annotationAppearance';
import { layoutTextFrames } from './textFlow';
import { drawTextFlow } from './drawTextFlow';
import { drawDiagram } from './diagrams';
import { drawEquation } from './equations';
import { embedTextFont, prepareTextFont } from './textFonts';
import { drawOriginalFont } from './sourceFontResource';
import { drawTable, insertUnicodeFont } from './tableLayout';
import { normalizeLinkUrl } from './insertion';
import { pdfColor } from './color';
import { annotationBox, measurementLabel } from './annotations';
import { preservesOcrPixels } from './ocrAppearance';
import { pushGraphicsState, popGraphicsState, concatTransformationMatrix } from 'pdf-lib';
export { measurementLabel } from './annotations';

const emptySettings: PageSettings = { order: [], rotations: {}, header: '', footer: '', watermark: '', batesStart: null };

export async function exportDocument(document: OpenDocument, objects: EditorObject[], settings: PageSettings): Promise<OpenDocument> {
  const bytes = await exportPdf(document, objects, settings);
  return { ...document, size: bytes.byteLength, data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer };
}

export async function exportPdf(document: OpenDocument, objects: EditorObject[], settings: PageSettings = emptySettings): Promise<Uint8Array> {
  const source = await PDFDocument.load(document.data.slice(0), { updateMetadata: false });
  const order = settings.order.length ? settings.order : Array.from({ length: source.getPageCount() }, (_, index) => index + 1);
  await Promise.all(objects.filter((object) => object.type === 'text').map(prepareTextFont));
  const frameLayouts = layoutTextFrames(objects, order);
  if ([...frameLayouts.values()].some((layout) => layout.overflow)) throw new Error('Text overflows a story. Enlarge its boxes or add a continuation in Layout before exporting.');
  const pdf = source;
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const fonts = new Map<string, PDFFont>([['Helvetica', font]]);
  const markFont = await supportedFont(pdf, fonts, settings.header + settings.footer + settings.watermark, font);
  const diagramFont = await supportedFont(pdf, fonts, objects.filter((object) => object.type === 'shape').map((object) => object.label ?? '').join(''), font);
  for (const object of objects) {
    if (object.type === 'form' && object.existingName && object.kind !== 'signature') {
      const form = pdf.getForm();
      const fieldFont = await supportedFont(pdf, fonts, object.value + (object.options ?? []).join(''), font);
      writeFormField(form, pdf.getPage(object.page - 1), object, fieldFont, object.page - 1);
    }
  }
  await applyPagePlan(pdf, order);
  for (const [outputIndex, sourcePage] of order.entries()) {
    const page = pdf.getPage(outputIndex);
    const rotation = settings.rotations[sourcePage] ?? 0;
    if (rotation) page.setRotation(degrees((page.getRotation().angle + rotation) % 360));
    drawPageMarks(page, markFont, outputIndex + 1, settings);
    for (const object of objects.filter((entry) => entry.page === sourcePage)) {
    if (object.type === 'text') {
      if (preservesOcrPixels(object)) {
        let hiddenFont = await embedTextFont(pdf, object, fonts);
        hiddenFont = await supportedFont(pdf, fonts, object.text, hiddenFont);
        page.pushOperators(pushGraphicsState(), concatTransformationMatrix(object.sourceLayout?.horizontalScale ?? 1, 0, 0, 1, object.x, object.y));
        page.drawText(object.text, { x: 0, y: 0, size: object.fontSize, font: hiddenFont, opacity: 0 });
        page.pushOperators(popGraphicsState());
        continue;
      }
      if (object.cover) page.drawRectangle({ x: (object.cover.x ?? object.x) - 2, y: (object.cover.y ?? object.y) - 2, width: object.cover.width, height: object.cover.height, color: pdfColor(object.cover.color??'#ffffff'),rotate:degrees(object.cover.rotation??0) });
      if (!frameLayouts.has(object.id) && drawOriginalFont(page,object)) continue;
      let textFont = await embedTextFont(pdf, object, fonts);
      const layout = frameLayouts.get(object.id);
      textFont = await supportedFont(pdf, fonts, layout?.visibleText ?? object.text, textFont);
      if (layout) drawTextFlow(page, object, layout, textFont);
      else drawTextBlock(page, object, textFont);
    }
    if (object.type === 'shape' || object.type === 'connector') drawDiagram(page, object, objects, diagramFont);
    if (object.type === 'equation') await drawEquation(pdf, page, object, fonts);
    if (object.type === 'table') await drawTable(pdf, page, object, font, fonts);
    if (object.type === 'image') { const bytes = await fetch(object.dataUrl).then((response) => response.arrayBuffer()); const image = object.dataUrl.startsWith('data:image/png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes); page.drawImage(image, { x: object.x, y: object.y, width: object.width, height: object.height }); }
    if (object.type === 'link') {
      const linkFont = object.fontFamily ? await insertUnicodeFont(pdf, fonts) : await supportedFont(pdf, fonts, object.label, font);
      const url = normalizeLinkUrl(object.url);
      page.drawText(object.label, { x: object.x, y: object.y, size: object.fontSize, font: linkFont, color: rgb(0, .28, .68) });
      const annotation = pdf.context.obj({ Type: 'Annot', Subtype: 'Link', Rect: [object.x, object.y, object.x + linkFont.widthOfTextAtSize(object.label, object.fontSize), object.y + object.fontSize], Border: [0, 0, 0], A: { Type: 'Action', S: 'URI', URI: PDFString.of(url) } });
      const annotations = page.node.Annots() ?? pdf.context.obj([]) as PDFArray; annotations.push(pdf.context.register(annotation)); page.node.set(PDFName.of('Annots'), annotations);
    }
    if (object.type === 'form') {
      const form = pdf.getForm();
      const fieldFont = await supportedFont(pdf, fonts, object.value + object.label + (object.options ?? []).join(''), font);
      if (object.kind === 'signature') addFormField(form, page, object, fieldFont);
      else if (!object.existingName) writeFormField(form, page, object, fieldFont, outputIndex);
    }
    if (object.type === 'highlight' || object.type === 'note' || object.type === 'stamp' || object.type === 'measure') addPdfAnnotation(pdf, page.node, object, font);
    }
  }
  return pdf.save();
}

async function supportedFont(pdf: PDFDocument, fonts: Map<string, PDFFont>, text: string, preferred: PDFFont) {
  try { preferred.encodeText(text.replace(/[\r\n]/g, '')); return preferred; }
  catch {
    const fallback = fonts.get('Unicode') ?? await unicodeFont(pdf);
    fonts.set('Unicode', fallback);
    return fallback;
  }
}

function addFormField(form: ReturnType<PDFDocument['getForm']>, page: ReturnType<PDFDocument['getPage']>, object: FormObject, font: PDFFont) {
  const options = { x: object.x, y: object.y, width: object.width, height: object.height, textColor: rgb(.18, .16, .14), borderColor: rgb(.65, .55, .35), borderWidth: 1, font, fontSize: 10 };
  if (object.kind === 'checkbox') { const field = form.createCheckBox(`PDFForge.${object.id}`); if (object.checked) field.check(); field.addToPage(page, options); return; }
  if (object.kind === 'signature') {
    page.drawLine({ start: { x: object.x, y: object.y + 5 }, end: { x: object.x + object.width, y: object.y + 5 }, color: rgb(.4, .37, .33), thickness: 1 });
    page.drawText(object.value || 'Sign here', { x: object.x + 4, y: object.y + 10, size: Math.min(16, object.height - 12), font, color: rgb(.18, .29, .4) });
    return;
  }
  const field = form.createTextField(`PDFForge.${object.id}`); field.setText(object.value); field.addToPage(page, options);
}

function drawPageMarks(page: ReturnType<PDFDocument['getPage']>, font: PDFFont, number: number, settings: PageSettings) {
  const { width, height } = page.getSize();
  const text = (value: string, x: number, y: number, size = 9, opacity = 1) => { if (value) page.drawText(value.split('{page}').join(String(number)), { x, y, size, font, color: rgb(.3, .28, .25), opacity }); };
  text(settings.header, 36, height - 24);
  text(settings.footer, 36, 16);
  if (settings.batesStart !== null) text(String(settings.batesStart + number - 1).padStart(6, '0'), width - 78, 16);
  if (settings.watermark) page.drawText(settings.watermark, { x: width * .2, y: height * .48, size: Math.min(48, width / 8), font, color: rgb(.72, .25, .18), opacity: .18, rotate: degrees(35) });
}

export async function mergePdfs(documents: OpenDocument[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const document of documents) {
    const input = await PDFDocument.load(document.data.slice(0));
    const pages = await merged.copyPages(input, input.getPageIndices());
    pages.forEach((page) => merged.addPage(page));
    registerPageFields(merged, pages);
  }
  prunePageFields(merged, merged.getPages());
  return merged.save({ updateFieldAppearances: false });
}

export async function splitPdf(document: OpenDocument, pageNumbers: number[], objects: EditorObject[] = [], settings: PageSettings = emptySettings): Promise<Uint8Array> {
  return exportPdf(document, objects, { ...settings, order: pageNumbers });
}

function addPdfAnnotation(pdf: PDFDocument, page: ReturnType<PDFDocument['getPage']>['node'], annotation: AnnotationObject, font: PDFFont) {
  const box = annotationBox(annotation);
  const state = (annotation.type === 'note' || annotation.type === 'highlight') && annotation.resolved !== undefined ? { State: PDFString.of(annotation.resolved ? 'Completed' : 'None'), StateModel: PDFString.of('Review') } : {};
  const base = { Type: 'Annot', P: pdf.context.getObjectRef(page), NM: PDFString.of(annotation.id), F: 4, Rect: [box.x, box.y, box.x + box.width, box.y + box.height], ...state, AP: { N: annotationAppearance(pdf, annotation, font) } };
  let value: Record<string, unknown>;
  if (annotation.type === 'highlight') { const color = pdfColor(annotation.color); value = { ...base, Subtype: 'Highlight', QuadPoints: [annotation.x, annotation.y + annotation.height, annotation.x + annotation.width, annotation.y + annotation.height, annotation.x, annotation.y, annotation.x + annotation.width, annotation.y], C: [color.red, color.green, color.blue], CA: .35, Contents: PDFHexString.fromText(annotation.comment), T: PDFHexString.fromText(annotation.author) }; }
  else if (annotation.type === 'note') value = { ...base, Subtype: 'Text', Contents: PDFHexString.fromText(annotation.comment), T: PDFHexString.fromText(annotation.author), Name: 'Comment' };
  else if (annotation.type === 'stamp') value = { ...base, Subtype: 'Stamp', Rect: [annotation.x, annotation.y, annotation.x + 110, annotation.y + 32], Contents: PDFString.of(annotation.label), Name: annotation.label };
  else value = { ...base, Subtype: 'Line', L: [annotation.x, annotation.y, annotation.x + annotation.width, annotation.y + annotation.height], Contents: PDFString.of(measurementLabel(annotation)), T: PDFString.of('PDFForge') };
  const annotations = page.Annots() ?? pdf.context.obj([]) as PDFArray;
  annotations.push(pdf.context.register(pdf.context.obj(value as never)));
  page.set(PDFName.of('Annots'), annotations);
}

export function downloadPdf(bytes: Uint8Array, name: string): void {
  const link = document.createElement('a');
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  link.href = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }));
  link.download = name.replace(/\.pdf$/i, '') + '-edited.pdf';
  link.click();
  URL.revokeObjectURL(link.href);
}
