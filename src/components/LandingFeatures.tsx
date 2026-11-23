const steps = [
  { title: 'Open', text: 'Drop in a file from your computer. It stays right there.' },
  { title: 'Edit', text: 'Type, sign, highlight and redact with tools you already know.' },
  { title: 'Export', text: 'Save as PDF, Word, images or text.' },
];

export function LandingFeatures() {
  return (
    <section
      className="landing-container landing-features"
      id="features"
      aria-labelledby="features-title"
    >
      <div className="landing-section-heading">
        <p>EVERYTHING IN ONE PLACE</p>
        <h2 id="features-title">
          Powerful, <em>without the clutter.</em>
        </h2>
      </div>
      <div className="landing-bento">
        <article className="landing-card landing-card-edit">
          <h3>Edit text in place</h3>
          <p>
            Fonts, sizes and spacing are matched, with a clear note when a close substitute is used.
          </p>
          <div className="landing-edit-example" aria-hidden="true">
            Make the <mark>headline</mark> sing
            <span />
          </div>
        </article>
        <article className="landing-card landing-card-sign">
          <h3>Sign &amp; fill</h3>
          <p>Type a signature, fill forms or sign with a local certificate.</p>
          <div className="landing-sign-example" aria-hidden="true">
            Alex Morgan
          </div>
        </article>
        <article className="landing-card landing-card-redact">
          <h3>Redact for real</h3>
          <p>Content is removed from a flattened copy, then verified.</p>
          <div className="landing-redact-example" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </article>
        <article className="landing-card landing-card-scan">
          <h3>Scan to editable</h3>
          <p>Recognize image text, review it and turn it into editable text boxes.</p>
          <div className="landing-scan-example" aria-hidden="true">
            <i />
            <span>→</span>
            <span>Searchable text</span>
          </div>
        </article>
        <article className="landing-card landing-card-organize">
          <h3>Organize pages</h3>
          <p>Reorder, merge, split and rotate.</p>
          <div className="landing-organize-example" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </article>
        <article className="landing-card landing-card-convert">
          <div>
            <h3>Convert &amp; compress</h3>
            <p>
              Export to Word, images or text, and repack your PDF to reduce file size where
              possible.
            </p>
          </div>
          <div className="landing-convert-example" aria-hidden="true">
            <div>
              <span>Before</span>
              <i />
            </div>
            <div>
              <span>After</span>
              <i />
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}

export function LandingSteps() {
  return (
    <section
      className="landing-container landing-how"
      id="how-it-works"
      aria-labelledby="steps-title"
    >
      <h2 id="steps-title">
        Three steps. <em>That’s all.</em>
      </h2>
      <ol className="landing-steps">
        {steps.map((step, index) => (
          <li key={step.title}>
            <span className="landing-step-number" aria-hidden="true">
              {index + 1}
            </span>
            <div className="landing-step-line" aria-hidden="true" />
            <h3>{step.title}</h3>
            <p>{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
