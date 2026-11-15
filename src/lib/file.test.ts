import { describe, expect, it } from 'vitest';
import { toPdfDocument } from './file';

describe('PDF file validation', () => {
  it('accepts a PDF header', async () => {
    const file = { name: 'sample.pdf', type: 'application/pdf', size: 16, arrayBuffer: async () => new TextEncoder().encode('%PDF-1.7 minimal').buffer } as File;
    await expect(toPdfDocument(file)).resolves.toMatchObject({ name: 'sample.pdf' });
  });
  it('rejects another file type', async () => {
    await expect(toPdfDocument(new File(['hello'], 'note.txt'))).rejects.toThrow('Choose a PDF');
  });
});
