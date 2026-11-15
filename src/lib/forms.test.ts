import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { exportMailMerge, fillMergeTokens, mergeObjects, parseCsv } from './forms';

describe('local mail merge', () => {
  it('parses quoted CSV cells and replaces named tokens', () => {
    expect(parseCsv('name,city\nAda,"New York"')).toEqual([{ name: 'Ada', city: 'New York' }]);
    expect(fillMergeTokens('Hello {{ name }} from {{city}}', { name: 'Ada', city: 'New York' })).toBe('Hello Ada from New York');
    expect(mergeObjects([{ id: 'field', type: 'form', kind: 'text', page: 1, x: 1, y: 1, width: 20, height: 12, label: 'Name', value: '{{name}}' }], { name: 'Ada' })[0]).toMatchObject({ value: 'Ada' });
  });

  it('exports one browser-local PDF for every recipient', async () => {
    const source = await PDFDocument.create(); source.addPage([200, 200]); const bytes = await source.save();
    const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
    const documents = await exportMailMerge({ id: 'source', name: 'letter.pdf', size: data.byteLength, modifiedAt: 0, data }, [{ id: 'recipient', type: 'form', kind: 'text', page: 1, x: 20, y: 20, width: 100, height: 20, label: 'Recipient', value: '{{name}}' }], { order: [], rotations: {}, header: '', footer: '', watermark: '', batesStart: null }, [{ name: 'Ada' }, { name: 'Lin' }]);
    expect(documents.map((entry) => entry.name)).toEqual(['letter-Ada.pdf', 'letter-Lin.pdf']);
    await expect(PDFDocument.load(documents[0].bytes)).resolves.toBeDefined();
  });
});
