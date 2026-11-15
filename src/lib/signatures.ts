import { PDFDocument, PDFDict, PDFName, PDFArray, PDFNumber, PDFHexString } from 'pdf-lib';
import { fromBER } from 'asn1js';
import { ContentInfo, SignedData, Certificate, CryptoEngine, setEngine } from 'pkijs';

export interface SignatureReport {
  name: string; valid: boolean; coversWholeFile: boolean; subject: string; validFrom: string; validUntil: string; certificateCurrent: boolean;
}

function cryptoEngine() {
  setEngine('PDFForge', crypto, new CryptoEngine({ name: 'PDFForge', crypto, subtle: crypto.subtle }));
}

export async function signPdf(bytes: Uint8Array, certificate: Uint8Array, password: string, reason: string): Promise<Uint8Array> {
  const { PDF, P12Signer } = await import('@libpdf/core');
  const signer = await P12Signer.create(certificate, password, { buildChain: false });
  const pdf = await PDF.load(bytes);
  const signed = await pdf.sign({ signer, level: 'B-B', reason, fieldName: `PDFForgeCertificate_${Date.now()}` });
  const reports = await verifyPdfSignatures(signed.bytes);
  if (!reports.at(-1)?.valid) throw new Error('The new certificate signature did not pass local integrity verification.');
  return signed.bytes;
}

export async function verifyPdfSignatures(bytes: Uint8Array): Promise<SignatureReport[]> {
  cryptoEngine();
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  const reports: SignatureReport[] = [];
  for (const [, dictionary] of pdf.context.enumerateIndirectObjects()) {
    if (!(dictionary instanceof PDFDict) || !dictionary.has(PDFName.of('ByteRange'))) continue;
    const ranges = dictionary.lookup(PDFName.of('ByteRange'), PDFArray).asArray().map((number) => (number as PDFNumber).asNumber());
    if (ranges.length !== 4 || ranges[0] !== 0 || ranges.some((value) => !Number.isSafeInteger(value) || value < 0) || ranges[1] > ranges[2] || ranges[2] + ranges[3] > bytes.length) throw new Error('Invalid PDF signature byte range.');
    const contents = dictionary.lookup(PDFName.of('Contents'), PDFHexString).asBytes();
    const decoded = fromBER(contents);
    if (decoded.offset === -1) throw new Error('Invalid CMS signature data.');
    const info = new ContentInfo({ schema: decoded.result });
    const cms = new SignedData({ schema: info.content });
    const data = new Uint8Array(ranges[1] + ranges[3]);
    data.set(bytes.subarray(0, ranges[1])); data.set(bytes.subarray(ranges[2], ranges[2] + ranges[3]), ranges[1]);
    let valid = false;
    try { valid = await cms.verify({ signer: 0, data: data.buffer, checkChain: false }); } catch { valid = false; }
    const certificate = cms.certificates?.find((entry): entry is Certificate => entry instanceof Certificate);
    const now = Date.now();
    reports.push({ name: `Signature ${reports.length + 1}`, valid, coversWholeFile: ranges[2] + ranges[3] === bytes.length,
      subject: certificate?.subject.typesAndValues.map((entry) => String(entry.value.valueBlock.value)).join(', ') ?? 'Unknown signer',
      validFrom: certificate?.notBefore.value.toISOString() ?? '', validUntil: certificate?.notAfter.value.toISOString() ?? '',
      certificateCurrent: !!certificate && certificate.notBefore.value.getTime() <= now && certificate.notAfter.value.getTime() >= now });
  }
  return reports;
}
