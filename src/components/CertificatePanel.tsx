import { useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import { useAppStore } from '../store/useAppStore';
import { downloadPdf, exportPdf } from '../lib/export';
import { signPdf, verifyPdfSignatures, type SignatureReport } from '../lib/signatures';

export function CertificatePanel({ onClose }: { onClose: () => void }) {
  const { document, objects, pageSettings, setNotice } = useAppStore();
  const [certificate, setCertificate] = useState<File>();
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('Document approval');
  const [busy, setBusy] = useState(false);
  const [reports, setReports] = useState<SignatureReport[]>();
  const sign = async () => {
    if (!document || !certificate) return;
    setBusy(true);
    try {
      const originalPageCount = (await PDFDocument.load(document.data.slice(0))).getPageCount();
      const unchanged = !objects.length && !pageSettings.header && !pageSettings.footer && !pageSettings.watermark && pageSettings.batesStart === null &&
        (!pageSettings.order.length || pageSettings.order.length === originalPageCount) &&
        Object.values(pageSettings.rotations).every((rotation) => !rotation) && pageSettings.order.every((page, index) => page === index + 1);
      const current = unchanged ? new Uint8Array(document.data.slice(0)) : await exportPdf(document, objects, pageSettings);
      const bytes = await signPdf(current, new Uint8Array(await certificate.arrayBuffer()), password, reason);
      setPassword('');
      setReports(await verifyPdfSignatures(bytes));
      downloadPdf(bytes, document.name.replace(/\.pdf$/i, '') + '-signed.pdf');
      setNotice('Certificate-signed PDF downloaded and its integrity verified locally.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Certificate signing failed.'); }
    finally { setBusy(false); }
  };
  const verify = async () => {
    if (!document) return;
    try { setReports(await verifyPdfSignatures(new Uint8Array(document.data))); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Signature verification failed.'); }
  };
  return <aside className="productivity-panel" aria-label="Certificate signing">
    <button aria-label="Close certificate panel" onClick={onClose}>Close</button>
    <h2>Certificate signing</h2>
    <label>PKCS#12 certificate<input aria-label="Signing certificate" type="file" accept=".p12,.pfx" onChange={(event) => setCertificate(event.target.files?.[0])} /></label>
    <label>Certificate password<input aria-label="Certificate password" type="password" autoComplete="off" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
    <label>Reason<input aria-label="Signing reason" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
    <button disabled={!document || !certificate || busy} onClick={() => void sign()}>{busy ? 'Signing…' : 'Sign and download'}</button>
    <button disabled={!document || busy} onClick={() => void verify()}>Verify opened PDF signatures</button>
    <p>Verification checks signed bytes, the embedded signing certificate, and certificate dates. Issuer trust and revocation require review in your PDF reader. Certificate files and passwords stay in this session.</p>
    {reports && !reports.length && <p>No certificate signatures found.</p>}
    {reports?.map((report, index) => <div key={index}><strong>{report.subject}</strong><p>{report.valid ? 'Signature integrity valid' : 'Signature integrity failed'}</p><p>{report.coversWholeFile ? 'Covers the current file' : 'Additional data follows this signature'}</p><p>{report.certificateCurrent ? 'Certificate dates current' : 'Certificate outside its validity dates'}</p><p>{report.validUntil}</p></div>)}
  </aside>;
}
