import { ArrowRight, FileText, LockKeyhole } from 'lucide-react';
import { useRef, type ChangeEvent, type DragEvent } from 'react';
import guideUrl from '../../USER_GUIDE.md?url';
import { toPdfDocument } from '../lib/file';
import { useAppStore } from '../store/useAppStore';
import { LandingFeatures, LandingSteps } from './LandingFeatures';
import { LandingPreview } from './LandingPreview';
import { ThemeToggle } from './ThemeToggle';
import '../landing.css';
import '../landing-theme.css';

export function Welcome() {
  const { setDocument, setNotice, isDragging, setDragging } = useAppStore();
  const picker = useRef<HTMLInputElement>(null);
  const openFile = async (file: File) => {
    try {
      setDocument(await toPdfDocument(file));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to open that file.');
    }
  };
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
  const openPicker = () => picker.current?.click();

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
        accept="application/pdf,.pdf"
        onChange={choose}
        tabIndex={-1}
      />
      <header className="landing-nav landing-container">
        <a className="landing-brand" href="#welcome">
          <span>
            <FileText size={19} aria-hidden="true" />
          </span>
          PDFForge
        </a>
        <nav aria-label="Main navigation">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#privacy">Privacy</a>
          <a href={guideUrl} download="PDFForge-User-Guide.md">
            Docs
          </a>
        </nav>
        <div className="landing-nav-actions">
          <ThemeToggle />
          <button className="landing-editor-button" onClick={openPicker}>
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
              Double-click a line and just type. A calm, Word-style workspace for editing, signing,
              redacting and converting.
            </p>
            <div className="landing-actions landing-rise">
              <button className="landing-primary" onClick={openPicker}>
                Open a PDF
              </button>
              <a className="landing-secondary" href="#how-it-works">
                Watch the tour
              </a>
            </div>
            <p className="landing-footnote">No account · Works offline · Open source</p>
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
            <button className="landing-primary" onClick={openPicker}>
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
      {isDragging && (
        <div className="landing-drop" role="status">
          Drop PDF to open
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
