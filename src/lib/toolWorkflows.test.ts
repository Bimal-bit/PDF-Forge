import { describe, expect, it } from 'vitest';
import { PDFArray, PDFDocument, PDFRawStream, StandardFonts, decodePDFRawStream } from 'pdf-lib';
import { parsePageRanges, extractDisplayedPages } from './pageRanges';
import { prepareFormValues } from './formImport';
import { assertToolSession } from './toolSession';
import { detectFormFields } from './formFields';
import type { FormObject, OpenDocument, PageSettings } from '../types';

const field = (id: string, kind: FormObject['kind'] = 'text'): FormObject => ({
  id,
  type: 'form',
  kind,
  page: 1,
  x: 40,
  y: 40,
  width: 100,
  height: 24,
  label: id,
  value: '',
});
const settings: PageSettings = {
  order: [1],
  rotations: {},
  header: '',
  footer: '',
  watermark: '',
  batesStart: null,
};
const document = (bytes: Uint8Array): OpenDocument => ({
  id: 'tools',
  name: 'tools.pdf',
  size: bytes.byteLength,
  modifiedAt: 0,
  data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
});
function streams(pdf: PDFDocument, index: number) {
  const contents = pdf.getPage(index).node.Contents() as PDFArray;
  return Array.from({ length: contents.size() }, (_, i) =>
    new TextDecoder().decode(decodePDFRawStream(contents.lookup(i, PDFRawStream)).decode()),
  ).join('\n');
}

describe('page extraction ranges', () => {
  it('retains requested order, descending ranges, and deliberate duplicates', () => {
    expect(parsePageRanges(' 1, 3-5, 4-2, 1 ', 8)).toEqual([1, 3, 4, 5, 4, 3, 2, 1]);
  });
  it('rejects invalid, empty, fractional, and out-of-document ranges', () => {
    for (const value of ['', '0', '-1', '1.5', '2,', '2-9', '1,,2', 'all', '1e2'])
      expect(() => parsePageRanges(value, 8)).toThrow();
    expect(() => parsePageRanges('1', 0)).toThrow('load');
  });
  it('bounds expansion before allocating a huge result', () => {
    expect(() => parsePageRanges('1-2001', 10000)).toThrow('2000');
    expect(() => parsePageRanges('1,'.repeat(501), 10)).toThrow('1000');
    expect(parsePageRanges('1-2000', 2000)).toHaveLength(2000);
  });
  it('retains current display marks, edited values, rotations, and metadata in a reordered extraction', async () => {
    const pdf = await PDFDocument.create();
    pdf.setTitle('Range metadata');
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    for (let index = 0; index < 3; index += 1)
      pdf.addPage([400, 600]).drawText(`Source ${index + 1}`, { x: 40, y: 500, font, size: 14 });
    const customer = pdf.getForm().createTextField('Customer');
    customer.setText('Original');
    customer.addToPage(pdf.getPage(1), { x: 40, y: 300, width: 150, height: 20 });
    const source = document(await pdf.save()),
      fields = await detectFormFields(source);
    const plan = {
      ...settings,
      order: [3, 2, 1, 2],
      rotations: { 2: 90 },
      header: 'Page {page}',
      batesStart: 10,
    };
    const result = await PDFDocument.load(
      await extractDisplayedPages(source, [{ ...fields[0], value: 'Changed' }], plan, [4, 2, 1, 2]),
    );
    expect(result.getTitle()).toBe('Range metadata');
    expect(result.getPageCount()).toBe(4);
    expect(result.getPages().map((page) => page.getRotation().angle)).toEqual([90, 90, 0, 90]);
    expect(streams(result, 0)).toContain('506167652034');
    expect(streams(result, 1)).toContain('506167652032');
    expect(
      result
        .getForm()
        .getFields()
        .map((entry) => result.getForm().getTextField(entry.getName()).getText()),
    ).toEqual(['Changed', 'Changed', 'Changed']);
  });
  it('rejects invalid programmatic extraction requests', async () => {
    const pdf = await PDFDocument.create();
    pdf.addPage([300, 400]);
    const source = document(await pdf.save());
    for (const pages of [[], [0], [2], [1.5]])
      await expect(extractDisplayedPages(source, [], settings, pages)).rejects.toThrow('valid');
  });
});

describe('form import preparation', () => {
  it('prepares multiple typed values and checkbox states together', () => {
    expect(
      prepareFormValues([field('Name'), field('Accepted', 'checkbox'), field('Amount')], {
        Name: 'Ada',
        Accepted: 'TRUE',
        Amount: 12,
      }),
    ).toEqual([
      { id: 'Name', value: 'Ada' },
      { id: 'Accepted', checked: true },
      { id: 'Amount', value: '12' },
    ]);
  });
  it('validates all supplied values before a transaction can commit', () => {
    expect(() =>
      prepareFormValues(
        [field('Name'), { ...field('Choice', 'dropdown'), options: ['Yes', 'No'] }],
        { Name: 'Ada', Choice: 'Missing' },
      ),
    ).toThrow('available option');
    expect(() => prepareFormValues([{ ...field('Code'), maxLength: 3 }], { Code: 'Long' })).toThrow(
      '3',
    );
    expect(() => prepareFormValues([field('Accepted', 'checkbox')], { Accepted: 'maybe' })).toThrow(
      'true/false',
    );
    expect(() => prepareFormValues([field('Amount')], { Amount: Infinity })).toThrow(
      'Invalid value',
    );
  });
  it('validates calendar dates and permits clearing a selection', () => {
    expect(() => prepareFormValues([field('Date', 'date')], { Date: '2026-02-30' })).toThrow(
      'valid YYYY-MM-DD',
    );
    expect(
      prepareFormValues(
        [field('Date', 'date'), { ...field('Choice', 'radio'), value: 'Yes', options: ['Yes'] }],
        { Date: '2028-02-29', Choice: '' },
      ),
    ).toEqual([
      { id: 'Date', value: '2028-02-29' },
      { id: 'Choice', value: '' },
    ]);
  });
  it('respects read-only and reset fields and ignores unknown or unchanged values', () => {
    expect(
      prepareFormValues(
        [
          { ...field('Name'), value: 'Ada' },
          { ...field('Locked'), readOnly: true },
          field('Reset', 'button'),
        ],
        { Name: 'Ada', Locked: 'Changed', Reset: 'Changed', Unknown: 'Ignored' },
      ),
    ).toEqual([]);
    expect(() => prepareFormValues([field('Name')], [])).toThrow('JSON object');
  });
  it('matches duplicate labels by their exported ID keys', () => {
    expect(
      prepareFormValues(
        [
          { ...field('a'), label: 'Name' },
          { ...field('b'), label: 'Name' },
        ],
        { 'Name#a': 'Ada', 'Name#b': 'Bea' },
      ),
    ).toEqual([
      { id: 'a', value: 'Ada' },
      { id: 'b', value: 'Bea' },
    ]);
  });
});

describe('tool sessions', () => {
  it('rejects changed document, object, and page-plan snapshots while allowing navigation', () => {
    const snapshot = {
      document: document(new Uint8Array()),
      objects: [],
      pageSettings: settings,
      selectedPage: 1,
    };
    expect(() => assertToolSession(snapshot, { ...snapshot, selectedPage: 2 })).not.toThrow();
    for (const changed of [
      { document: { ...snapshot.document } },
      { objects: [] },
      { pageSettings: { ...settings } },
    ])
      expect(() => assertToolSession(snapshot, { ...snapshot, ...changed })).toThrow('changed');
  });
});
