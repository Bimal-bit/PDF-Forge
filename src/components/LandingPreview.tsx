import { Check, MousePointer2 } from 'lucide-react';

export function LandingPreview() {
  return (
    <div className="landing-stage" aria-hidden="true">
      <div className="landing-orb landing-orb-violet" />
      <div className="landing-orb landing-orb-peach" />
      <div className="landing-loose-page loose-page-left" />
      <div className="landing-loose-page loose-page-right" />
      <div className="landing-loose-page loose-page-top" />
      <div className="landing-preview">
        <div className="landing-preview-toolbar">
          <span>Home</span>
          <span>Insert</span>
          <span>Review</span>
          <span className="landing-preview-ai">On your device</span>
        </div>
        <div className="landing-preview-workspace">
          <div className="landing-preview-pages">
            <i />
            <i />
            <i />
          </div>
          <div className="landing-preview-canvas">
            <div className="landing-preview-paper">
              <div className="landing-preview-eyebrow">QUARTERLY REPORT</div>
              <div className="landing-preview-title">Growth, in plain sight</div>
              <div className="landing-preview-selection">
                Click any line to edit it <mark>in place</mark>, with the original typography
                preserved.
              </div>
              <div className="landing-preview-lines">
                <i />
                <i />
                <i />
              </div>
              <div className="landing-preview-chart">
                <i />
                <i />
                <i />
              </div>
              <MousePointer2
                className="landing-preview-cursor"
                size={22}
                fill="#1b1b22"
                stroke="white"
                strokeWidth={1.5}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="landing-float landing-font">
        <strong>FONT MATCHED</strong>
        <em>Newsreader</em>
      </div>
      <div className="landing-float landing-signed">
        <span>
          <Check size={20} />
        </span>
        <div>
          <strong>Signed and sealed</strong>
          <small>Just now</small>
        </div>
      </div>
      <div className="landing-float landing-redacted">
        <strong>REDACTED</strong>
        <i />
        <i />
      </div>
    </div>
  );
}
