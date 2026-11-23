import { ArrowUpRight, FilePlus2, ScanText, FilePenLine } from 'lucide-react';

export function LandingTools({
  onOpen,
  onImage,
  onBlank,
  busy,
}: {
  onOpen: () => void;
  onImage: () => void;
  onBlank: () => void;
  busy: boolean;
}) {
  return (
    <>
      <section
        className="landing-container landing-toolbox"
        id="toolbox"
        tabIndex={-1}
        aria-labelledby="toolbox-title"
      >
        <div className="landing-section-heading">
          <p>START YOUR NEXT TASK</p>
          <h2 id="toolbox-title">A little less paperwork.</h2>
          <p className="landing-toolbox-description">
            Choose a starting point. Everything happens right here, on your device.
          </p>
        </div>
        <div className="landing-tool-grid">
          <button onClick={onOpen} disabled={busy}>
            <span className="tool-icon">
              <FilePenLine size={24} />
            </span>
            <strong>Edit a PDF</strong>
            <span>Open, update, fill and export your document.</span>
            <ArrowUpRight size={20} aria-hidden="true" />
          </button>
          <button onClick={onImage} disabled={busy}>
            <span className="tool-icon">
              <ScanText size={24} />
            </span>
            <strong>Image to editable text</strong>
            <span>Open a PNG, JPG or WebP. Recognize and correct its text.</span>
            <ArrowUpRight size={20} aria-hidden="true" />
          </button>
          <button onClick={onBlank} disabled={busy}>
            <span className="tool-icon">
              <FilePlus2 size={24} />
            </span>
            <strong>Start a blank PDF</strong>
            <span>Create an A4 page with text, images, tables and forms.</span>
            <ArrowUpRight size={20} aria-hidden="true" />
          </button>
        </div>
      </section>
      <section
        className="landing-container landing-faq"
        id="questions"
        aria-labelledby="questions-title"
      >
        <div>
          <p className="landing-eyebrow">GOOD TO KNOW</p>
          <h2 id="questions-title">A few useful answers.</h2>
          <p>Private by design. Clear about the details.</p>
        </div>
        <div>
          {[
            [
              'Can I edit a picture of a document?',
              'Yes. Open a PNG, JPG or WebP, choose Editable text boxes in Offline OCR, and review the detected lines. Apply them, then tap a text box or edit it in the Inspector. Recognition supports English and Spanish.',
            ],
            [
              'Will the original font be preserved?',
              'PDF text uses its original font when it can be matched or reused, with a fallback note when needed. Unchanged image text keeps its original pixels; edited lines use an approximate font match with the detected size and colors. Home can choose or import another font. The interface uses locally bundled Inter.',
            ],
            [
              'Does this work on my phone?',
              'Yes. The page fits the screen automatically. Use Pages and Inspector above the document to switch panels, and swipe the ribbon horizontally for more tools. You can open files, edit, recognize text and export in your browser.',
            ],
            [
              'Where are my documents saved?',
              'Documents and automatic recovery stay in this browser on this device. Export a copy to keep it in your files. After the offline assets finish installing, you can reopen the app without a connection. Clearing browser storage removes local recovery.',
            ],
          ].map(([question, answer]) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}
