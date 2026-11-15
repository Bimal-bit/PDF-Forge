import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFNumber, PDFRef, PDFString } from 'pdf-lib';

/** Keep the source catalog and original page references when assembling a page plan. */
export async function applyPagePlan(pdf: PDFDocument, order: number[]): Promise<void> {
  const original = [...pdf.getPages()];
  if (!order.length || order.some((number) => !Number.isInteger(number) || number < 1 || number > original.length)) {
    throw new Error('The page plan contains an invalid page number.');
  }
  if (order.length === original.length && order.every((number, index) => number === index + 1)) return;
  const seen = new Set<number>();
  const pages = [];
  for (const [index, number] of order.entries()) {
    const source = original[number - 1];
    if (seen.has(number)) {
      const [copy] = await pdf.copyPages(pdf, [number - 1]);
      registerCopiedFields(pdf, copy.node.Annots(), index + 1, copy.ref);
      pages.push(copy);
    } else {
      for (const key of ['Resources', 'MediaBox', 'CropBox', 'Rotate']) {
        const name = PDFName.of(key);
        const value = source.node.getInheritableAttribute(name);
        if (value) source.node.set(name, value);
      }
      pages.push(source);
      seen.add(number);
    }
  }
  remapLabels(pdf, order);
  for (let index = original.length - 1; index >= 0; index -= 1) pdf.removePage(index);
  pages.forEach((page) => pdf.addPage(page));
  const pageRefs = new Set(pages.map((page) => page.ref.toString()));
  const annotationRefs = new Set<string>();
  for (const page of pages) {
    const annotations = page.node.Annots();
    for (let index = 0; index < (annotations?.size() ?? 0); index += 1) annotationRefs.add(annotations!.get(index).toString());
  }
  const fields = pdf.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict)?.lookupMaybe(PDFName.of('Fields'), PDFArray);
  if (fields) pruneFields(pdf, fields, annotationRefs);
  const sourceToOutput = new Map(order.map((number, index) => [number - 1, index]));
  for (const [, object] of pdf.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue;
    for (const key of ['Dest', 'D']) {
      const destination = pdf.context.lookup(object.get(PDFName.of(key)));
      if (!(destination instanceof PDFArray) || !destination.size()) continue;
      const first = destination.get(0);
      if (first instanceof PDFRef && original.some((page) => page.ref === first) && !pageRefs.has(first.toString())) {
        destination.set(0, pages[0].ref);
      }
      if (first instanceof PDFNumber) destination.set(0, PDFNumber.of(sourceToOutput.get(first.asNumber()) ?? 0));
    }
  }
}

function registerCopiedFields(pdf: PDFDocument, annotations: PDFArray | undefined, copyNumber: number, page: PDFRef) {
  const roots = new Set<string>();
  for (let index = 0; index < (annotations?.size() ?? 0); index += 1) {
    let ref = annotations!.get(index);
    let node = pdf.context.lookup(ref);
    if (!(node instanceof PDFDict) || node.get(PDFName.of('Subtype')) !== PDFName.of('Widget')) continue;
    node.set(PDFName.of('P'), page);
    while (node.has(PDFName.of('Parent'))) {
      ref = node.get(PDFName.of('Parent'))!;
      node = pdf.context.lookup(ref);
      if (!(node instanceof PDFDict)) throw new Error('The copied form field has an invalid parent.');
    }
    if (!(ref instanceof PDFRef) || roots.has(ref.toString())) continue;
    roots.add(ref.toString());
    const rawName = pdf.context.lookup(node.get(PDFName.of('T')));
    const name = rawName instanceof PDFString || rawName instanceof PDFHexString ? rawName.decodeText() : 'Field';
    node.set(PDFName.of('T'), PDFHexString.fromText(`${name}_copy_${copyNumber}`));
    let form = pdf.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
    if (!form) {
      form = pdf.context.obj({ Fields: [] });
      pdf.catalog.set(PDFName.of('AcroForm'), pdf.context.register(form));
    }
    const fields = form.lookupMaybe(PDFName.of('Fields'), PDFArray) ?? pdf.context.obj([]);
    fields.push(ref);
    form.set(PDFName.of('Fields'), fields);
  }
}

function pruneFields(pdf: PDFDocument, fields: PDFArray, annotations: Set<string>) {
  for (let index = fields.size() - 1; index >= 0; index -= 1) {
    const reference = fields.get(index);
    const node = pdf.context.lookup(reference, PDFDict);
    if (node.get(PDFName.of('Subtype')) === PDFName.of('Widget')) {
      if (!annotations.has(reference.toString())) fields.remove(index);
      continue;
    }
    const children = node.lookupMaybe(PDFName.of('Kids'), PDFArray);
    if (!children) continue;
    pruneFields(pdf, children, annotations);
    if (!children.size()) fields.remove(index);
  }
}

function remapLabels(pdf: PDFDocument, order: number[]) {
  const labels = pdf.catalog.lookupMaybe(PDFName.of('PageLabels'), PDFDict);
  if (!labels) return;
  const ranges: { start: number; value: PDFDict }[] = [];
  const visit = (node: PDFDict) => {
    const values = node.lookupMaybe(PDFName.of('Nums'), PDFArray);
    for (let index = 0; index < (values?.size() ?? 0); index += 2) {
      ranges.push({ start: values!.lookup(index, PDFNumber).asNumber(), value: values!.lookup(index + 1, PDFDict) });
    }
    const children = node.lookupMaybe(PDFName.of('Kids'), PDFArray);
    for (let index = 0; index < (children?.size() ?? 0); index += 1) visit(children!.lookup(index, PDFDict));
  };
  visit(labels);
  ranges.sort((left, right) => left.start - right.start);
  const numbers = pdf.context.obj([]);
  order.forEach((number, outputIndex) => {
    const range = ranges.filter((entry) => entry.start <= number - 1).at(-1);
    const value = range?.value.clone() ?? pdf.context.obj({ S: 'D' });
    const start = value.lookupMaybe(PDFName.of('St'), PDFNumber)?.asNumber() ?? 1;
    value.set(PDFName.of('St'), PDFNumber.of(start + number - 1 - (range?.start ?? 0)));
    numbers.push(PDFNumber.of(outputIndex)); numbers.push(value);
  });
  pdf.catalog.set(PDFName.of('PageLabels'), pdf.context.obj({ Nums: numbers }));
}
