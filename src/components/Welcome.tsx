import { ArrowUpRight, FileText, LockKeyhole, PenLine, ShieldCheck, Upload } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { toPdfDocument } from '../lib/file';
import { useAppStore } from '../store/useAppStore';

export function Welcome() {
  const { setDocument, setNotice } = useAppStore();
  const open = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { setDocument(await toPdfDocument(file)); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to open that file.'); }
    event.target.value = '';
  };
  return <div className="welcome">
    <div className="privacy-pill"><span /> YOUR FILES. YOUR DEVICE.</div>
    <div className="paper-stage" aria-hidden="true">
      <div className="welcome-orb violet-orb" /><div className="welcome-orb peach-orb" />
      <div className="paper-scene"><div className="floating-paper paper-back" /><div className="floating-paper paper-middle" />
        <div className="floating-paper paper-front"><FileText size={25} /><span className="paper-eyebrow">A FRESH START</span><span className="paper-heading">Room for<br /><em>your ideas.</em></span><i /><i /><i /><div className="paper-signature">Make it yours.</div></div>
      </div>
      <span className="floating-badge"><ShieldCheck size={15} /> Private by design</span>
      <span className="paper-spark spark-one">&#10022;</span><span className="paper-spark spark-two">&#10022;</span>
    </div>
    <h1>Open a PDF to begin</h1>
    <p className="welcome-description">A little less paperwork. <em>A lot more possibility.</em><br />Drop a PDF here and make it yours.</p>
    <label className="welcome-open"><Upload size={17} /> Choose a PDF <ArrowUpRight size={17} /><input aria-label="Choose a PDF" type="file" accept="application/pdf,.pdf" onChange={open} /></label>
    <p className="welcome-footnote"><LockKeyhole size={12} /> Files stay in your browser. No account needed.</p>
    <div className="welcome-capabilities"><span><PenLine size={14} /> Edit & annotate</span><span><FileText size={14} /> Arrange & convert</span><span><ShieldCheck size={14} /> Sign & protect</span></div>
  </div>;
}

export function BrandIntro() {
  return <div className="brand-intro" aria-hidden="true"><div className="intro-content"><span className="intro-logo"><FileText size={32} /></span><span>PDFForge</span><div className="intro-line"><i /></div><small>A little less paperwork.</small></div></div>;
}
