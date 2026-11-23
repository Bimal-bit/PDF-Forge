import { ArrowRight, FileText, LockKeyhole, Menu } from 'lucide-react';
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react';
import guideUrl from '../../USER_GUIDE.md?url';
import { documentAccept } from '../lib/openDocument';
import { useLocalDocumentOpen } from './useLocalDocumentOpen';
import { useAppStore } from '../store/useAppStore';
import { LandingFeatures, LandingSteps } from './LandingFeatures';
import { LandingPreview } from './LandingPreview';
import { ThemeToggle } from './ThemeToggle';
import { LandingTools } from './LandingTools';
import '../landing.css';
import '../landing-theme.css';

export function Welcome() {
  const { isDragging, setDragging } = useAppStore();
  const { openFile, createBlank, busy } = useLocalDocumentOpen();
  const [menu, setMenu] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const imagePicker = useRef<HTMLInputElement>(null);
  const navigation = useRef<HTMLElement>(null);
  const menuToggle = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!menu) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !navigation.current?.contains(event.target)) setMenu(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenu(false); menuToggle.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [menu]);
  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void openFile(file);
    event.target.value = '';
  };
  const drop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void openFile(file);
  };
  const dragOver = (event: DragEvent<HTMLElement>) => {
    if (!event.dataTransfer.types.includes('Files')) return;
    event.preventDefault();
    setDragging(true);
  };
  const dragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
  };
  const openPicker = () => { if (!busy) picker.current?.click(); };

  return (
    <div
      className="landing"
      id="welcome"
      onDragOver={dragOver}
      onDragLeave={dragLeave}
      onDrop={drop}
    >
      <BrandIntro />
      <div className="landing-progress" aria-hidden="true" />
      <input
        ref={picker}
        className="landing-file-input"
        aria-label="Open PDF"
        type="file"
        accept={documentAccept}
        disabled={busy}
        onChange={choose}
        tabIndex={-1}
      />
      <input ref={imagePicker} className="landing-file-input" aria-label="Open image for OCR" type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={choose} disabled={busy} tabIndex={-1} />
      <a className="skip-link" href="#toolbox">Skip to tools</a>
      <header ref={navigation} className={`landing-nav landing-container${menu ? ' menu-open' : ''}`}>
        <a className="landing-brand" href="#welcome">
          <span>
            <FileText size={19} aria-hidden="true" />
          </span>
          PDFForge
        </a>
        <nav id="landing-menu" aria-label="Main navigation" onClick={() => setMenu(false)}>
          <a href="#toolbox">Tools</a>
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
          <a href={guideUrl} download="PDFForge-User-Guide.md">
            Docs
          </a>
        </nav>
        <div className="landing-nav-actions">
          <ThemeToggle />
          <button ref={menuToggle} className="landing-menu-toggle" aria-label="Toggle navigation" aria-expanded={menu} aria-controls="landing-menu" onClick={() => setMenu(!menu)}><Menu size={20} /></button>
          <button className="landing-editor-button" onClick={openPicker} disabled={busy}>
            Open editor
          </button>
        </div>
      </header>
      <main>
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-container landing-hero-content">
            <div className="landing-private landing-rise">
              <span>PRIVATE</span>Edits happen on your device, never on a server
            </div>
            <h1 id="landing-title" className="landing-rise">
              Your PDFs, finally{' '}
              <em>
                editable.
                <svg viewBox="0 0 300 16" preserveAspectRatio="none" fill="none" aria-hidden="true">
                  <path d="M3 11C60 3 140 3 297 9" />
                </svg>
              </em>
            </h1>
            <p className="landing-description landing-rise">
              Click a line and just type. A calm, Word-style workspace for editing, signing,
              redacting and converting.
            </p>
            <div className="landing-actions landing-rise">
              <button className="landing-primary" onClick={openPicker} disabled={busy}>
                Open a PDF
              </button>
              <a className="landing-secondary" href="#how-it-works">
                Watch the tour
              </a>
            </div>
            <p className="landing-footnote">No account · Works offline · PDF, PNG, JPG &amp; WebP</p>
            <LandingPreview />
            <div className="landing-exports">
              <span>Export to</span>
              {['DOCX', 'PNG', 'JPG', 'CSV', 'Markdown'].map((format) => (
                <span className="landing-format" key={format}>
                  {format}
                </span>
              ))}
            </div>
          </div>
        </section>
        <div className="landing-marquee" aria-hidden="true">
          <div>
            {[0, 1].map((copy) => (
              <span className="landing-marquee-copy" key={copy}>
                {['Edit', 'Sign', 'Redact', 'Scan', 'Merge', 'Compress', 'Convert'].map((word) => (
                  <span key={word}>
                    {word}
                    <i>✦</i>
                  </span>
                ))}
              </span>
            ))}
          </div>
        </div>
        <LandingFeatures />
        <LandingTools onOpen={openPicker} onImage={() => imagePicker.current?.click()} onBlank={() => void createBlank()} busy={busy} />
        <LandingSteps />
        <section
          className="landing-container landing-privacy-section"
          id="privacy"
          aria-labelledby="privacy-title"
        >
          <div className="landing-privacy">
            <div className="landing-sweep" aria-hidden="true" />
            <div className="landing-orb landing-orb-violet" aria-hidden="true" />
            <div className="landing-orb landing-orb-peach" aria-hidden="true" />
            <span className="landing-lock">
              <LockKeyhole size={26} aria-hidden="true" />
            </span>
            <h2 id="privacy-title">
              Your files never <em>leave your device.</em>
            </h2>
            <p>No servers, no accounts, no waiting for an upload.</p>
            <button className="landing-primary" onClick={openPicker} disabled={busy}>
              Open a PDF <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        </section>
      </main>
      <footer className="landing-footer landing-container">
        <span>© PDFForge. Built in the open.</span>
        <div>
          <a href="#privacy">Privacy</a>
          <a href={guideUrl} download="PDFForge-User-Guide.md">
            Docs
          </a>
          <span>Source</span>
        </div>
      </footer>
      {busy && <div className="local-open-status" role="status">Opening your file locally…</div>}
      {isDragging && (
        <div className="landing-drop" role="status">
          Drop a PDF or image to open
        </div>
      )}
    </div>
  );
}

function BrandIntro() {
  return (
    <div className="brand-intro" aria-hidden="true">
      <div className="intro-content">
        <span className="intro-logo">
          <FileText size={36} />
        </span>
        <span>PDFForge</span>
        <div className="intro-line">
          <i />
        </div>
      </div>
    </div>
  );
}
