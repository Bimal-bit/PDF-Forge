import forge from 'node-forge';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { signPdf, verifyPdfSignatures } from './signatures';

export function testCertificate() {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const certificate = forge.pki.createCertificate(); certificate.publicKey = keys.publicKey;
  certificate.serialNumber = '01'; certificate.validity.notBefore = new Date('2025-01-01'); certificate.validity.notAfter = new Date('2035-01-01');
  const subject = [{ name: 'commonName', value: 'PDFForge Test Signer' }];
  certificate.setSubject(subject); certificate.setIssuer(subject); certificate.sign(keys.privateKey, forge.md.sha256.create());
  const p12 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [certificate], 'test-password', { algorithm: 'aes256' });
  return Uint8Array.from(forge.asn1.toDer(p12).getBytes(), (character) => character.charCodeAt(0));
}

describe('local certificate signing', () => {
  it('creates a verifiable CMS signature and detects tampered signed bytes', async () => {
    const source = await PDFDocument.create(); source.addPage();
    const bytes = await signPdf(await source.save(), testCertificate(), 'test-password', 'Testing');
    const reports = await verifyPdfSignatures(bytes);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({ valid: true, coversWholeFile: true, certificateCurrent: true });
    const tampered = bytes.slice();
    // A one-byte encoding keeps character offsets aligned with PDF byte offsets.
    const index = new TextDecoder('latin1').decode(tampered).indexOf('Testing');
    expect(index).toBeGreaterThan(0);
    tampered[index] = 'X'.charCodeAt(0);
    expect((await verifyPdfSignatures(tampered))[0].valid).toBe(false);
  }, 30000);
});
