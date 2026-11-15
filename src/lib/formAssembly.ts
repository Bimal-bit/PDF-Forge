import { PDFArray, PDFDict, PDFDocument, PDFHexString, PDFName, PDFRef, PDFString, type PDFPage } from 'pdf-lib';

/** Register the form trees copied with pages, retaining shared widgets and unique names. */
export function registerPageFields(pdf: PDFDocument, pages: PDFPage[], copyNumber?: number) {
  let form = pdf.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict);
  const fields = form?.lookupMaybe(PDFName.of('Fields'), PDFArray) ?? pdf.context.obj([]);
  const registered = new Set(fields.asArray().map((ref) => ref.toString()));
  const names = new Set(fields.asArray().map((ref) => fieldName(pdf.context.lookup(ref, PDFDict))));
  for (const page of pages) {
    const annotations = page.node.Annots();
    for (const annotation of annotations?.asArray() ?? []) {
      let ref = annotation;
      let node = pdf.context.lookup(ref);
      if (!(node instanceof PDFDict) || node.get(PDFName.of('Subtype')) !== PDFName.of('Widget')) continue;
      node.set(PDFName.of('P'), page.ref);
      const visited = new Set<PDFDict>();
      while (node.has(PDFName.of('Parent'))) {
        if (visited.has(node)) throw new Error('The copied form field has a cyclic parent.');
        visited.add(node);
        ref = node.get(PDFName.of('Parent'))!;
        node = pdf.context.lookup(ref);
        if (!(node instanceof PDFDict)) throw new Error('The copied form field has an invalid parent.');
      }
      if (!(ref instanceof PDFRef) || registered.has(ref.toString())) continue;
      registered.add(ref.toString());
      const original = fieldName(node);
      const base = copyNumber === undefined ? original : `${original}_copy_${copyNumber}`;
      let name = base;
      for (let suffix = 2; names.has(name); suffix += 1) name = `${base}_${suffix}`;
      names.add(name);
      if (name !== original) node.set(PDFName.of('T'), PDFHexString.fromText(name));
      fields.push(ref);
    }
  }
  if (!fields.size()) return;
  if (!form) {
    form = pdf.context.obj({});
    pdf.catalog.set(PDFName.of('AcroForm'), pdf.context.register(form));
  }
  form.set(PDFName.of('Fields'), fields);
}

function fieldName(node: PDFDict): string {
  const name = node.lookup(PDFName.of('T'));
  return name instanceof PDFString || name instanceof PDFHexString ? name.decodeText() : 'Field';
}

export function prunePageFields(pdf: PDFDocument, pages: PDFPage[]) {
  const annotations = new Set(pages.flatMap((page) => page.node.Annots()?.asArray().map((ref) => ref.toString()) ?? []));
  const fields = pdf.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict)?.lookupMaybe(PDFName.of('Fields'), PDFArray);
  if (fields) pruneFields(pdf, fields, annotations);
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
