import { PDFButton, PDFCheckBox, PDFDocument, PDFDropdown, PDFName, PDFOptionList, PDFRadioGroup, PDFTextField, rgb, type PDFField, type PDFFont, type PDFForm, type PDFPage } from 'pdf-lib';
import type { FormObject, OpenDocument } from '../types';

export function writeFormField(form: PDFForm, page: PDFPage, object: FormObject, font: PDFFont, outputIndex: number) {
  const name = object.existingName ?? `PDFForge.${object.id}.${outputIndex + 1}`;
  const existing = object.existingName ? form.getFieldMaybe(name) : undefined;
  const options = { x: object.x, y: object.y, width: object.width, height: object.height, textColor: rgb(.18, .16, .14), borderColor: rgb(.65, .55, .35), borderWidth: 1, font, fontSize: 10 };
  let field: PDFField;
  if (object.kind === 'checkbox') {
    const checkbox = existing instanceof PDFCheckBox ? existing : form.createCheckBox(name);
    if (object.checked) checkbox.check(); else checkbox.uncheck();
    if (!existing) checkbox.addToPage(page, options);
    field = checkbox;
  } else if (object.kind === 'dropdown') {
    const dropdown = existing instanceof PDFDropdown ? existing : form.createDropdown(name);
    if (!existing) dropdown.addOptions(object.options ?? ['Option 1', 'Option 2']);
    if (object.value && dropdown.getOptions().includes(object.value)) dropdown.select(object.value); else dropdown.clear();
    if (!existing) dropdown.addToPage(page, options);
    field = dropdown;
  } else if (object.kind === 'list') {
    const list = existing instanceof PDFOptionList ? existing : form.createOptionList(name);
    if (!existing) list.addOptions(object.options ?? ['Option 1', 'Option 2']);
    if (object.value && list.getOptions().includes(object.value)) list.select(object.value); else list.clear();
    if (!existing) list.addToPage(page, options);
    field = list;
  } else if (object.kind === 'radio') {
    const group = existing instanceof PDFRadioGroup ? existing : form.createRadioGroup(name);
    if (!existing) {
      const choices = object.options ?? ['Yes', 'No'];
      const spacing = object.width / Math.max(1, choices.length);
      choices.forEach((value, index) => {
        const x = object.x + index * spacing;
        group.addOptionToPage(value, page, { ...options, x, width: 18, height: 18 });
        const size = Math.max(4, Math.min(10, (spacing - 24) / Math.max(1, font.widthOfTextAtSize(value, 1))));
        page.drawText(value, { x: x + 23, y: object.y + 5, size, font });
      });
    }
    if (object.value && group.getOptions().includes(object.value)) group.select(object.value); else group.clear();
    field = group;
  } else if (object.kind === 'button') {
    const button = existing instanceof PDFButton ? existing : form.createButton(name);
    if (!existing) button.addToPage(object.value || object.label, page, options);
    if (!existing) for (const widget of button.acroField.getWidgets()) widget.dict.set(PDFName.of('A'), form.doc.context.obj({ S: 'ResetForm' }));
    field = button;
  } else {
    const text = existing instanceof PDFTextField ? existing : form.createTextField(name);
    if (object.multiline) text.enableMultiline(); else text.disableMultiline();
    // Clear the previous limit before applying a new one or a longer value.
    text.removeMaxLength();
    text.setText('');
    if (object.maxLength && object.maxLength > 0) text.setMaxLength(object.maxLength);
    text.setText(object.value);
    if (!existing) text.addToPage(page, options);
    field = text;
  }
  if (object.required) field.enableRequired(); else field.disableRequired();
  if (object.readOnly) field.enableReadOnly(); else field.disableReadOnly();
  field.defaultUpdateAppearances(font);
}

export async function detectFormFields(document: OpenDocument): Promise<FormObject[]> {
  const pdf = await PDFDocument.load(document.data.slice(0));
  const pages = pdf.getPages();
  const objects: FormObject[] = [];
  for (const field of pdf.getForm().getFields()) {
    let kind: FormObject['kind']; let value = ''; let checked = false; let options: string[] | undefined;
    if (field instanceof PDFTextField) { kind = 'text'; value = field.getText() ?? ''; }
    else if (field instanceof PDFCheckBox) { kind = 'checkbox'; checked = field.isChecked(); }
    else if (field instanceof PDFRadioGroup) { kind = 'radio'; value = field.getSelected() ?? ''; options = field.getOptions(); }
    else if (field instanceof PDFDropdown) { kind = 'dropdown'; value = field.getSelected()[0] ?? ''; options = field.getOptions(); }
    else if (field instanceof PDFOptionList) { kind = 'list'; value = field.getSelected()[0] ?? ''; options = field.getOptions(); }
    else if (field instanceof PDFButton) kind = 'button';
    else continue;
    const widget = field.acroField.getWidgets()[0];
    if (!widget) continue;
    const pageIndex = pages.findIndex((page) => page.ref === widget.P() || page.node.Annots()?.asArray().some((reference) => pdf.context.lookup(reference) === widget.dict));
    if (pageIndex < 0) continue;
    const rectangle = widget.getRectangle();
    objects.push({ id: crypto.randomUUID(), type: 'form', kind, page: pageIndex + 1, ...rectangle, label: field.getName(), existingName: field.getName(), value, checked, options, required: field.isRequired(), readOnly: field.isReadOnly(), multiline: field instanceof PDFTextField && field.isMultiline(), maxLength: field instanceof PDFTextField ? field.getMaxLength() : undefined });
  }
  return objects;
}

export function formData(objects: FormObject[]): Record<string, string | boolean> {
  return Object.fromEntries(formDataEntries(objects).map(({ object, key }) => [key, object.kind === 'checkbox' ? !!object.checked : object.value]));
}

export function formDataEntries(objects: FormObject[]) {
  const names = objects.map((object) => object.existingName ?? object.label);
  const counts = new Map<string, number>();
  names.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));
  return objects.map((object, index) => ({ object, key: counts.get(names[index])! > 1 ? `${names[index]}#${object.id}` : names[index] }));
}
