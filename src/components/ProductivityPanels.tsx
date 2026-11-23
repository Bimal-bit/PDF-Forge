import { useEffect, useState } from 'react';
import type { AccessibilityReport } from '../lib/accessibility';
import { CommandPalette } from './CommandPalette';

interface Props {
  report?: AccessibilityReport;
  assistantText?: string;
  onClose: () => void;
  onAccessibility: () => void;
  onAssistant: () => void;
  onAddText: () => void;
  canAddText: boolean;
  onExportText: () => void;
  onOcr: () => void;
}

export function ProductivityPanels({ report, assistantText, onClose, onAccessibility, onAssistant, onAddText, canAddText, onExportText, onOcr }: Props) {
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k' && !document.querySelector('dialog[open]')) {
        event.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const commands = [{ label: 'Check accessibility', run: onAccessibility }, { label: 'Open local AI panel', run: onAssistant }, { label: 'Add text overlay', run: onAddText, disabled: !canAddText }, { label: 'Open export tools', run: onExportText }, { label: 'Scan image text (Offline OCR)', run: onOcr }];
  return <>{(report || assistantText) && <aside className="productivity-panel" aria-label={report ? 'Accessibility report' : 'Local AI panel'}><button className="panel-dismiss" aria-label="Close panel" onClick={onClose}>×</button>{report ? <><p className="panel-label">ACCESSIBILITY CHECK</p><p>{report.pages} pages · {report.words} words</p>{report.issues.map((issue, index) => <p key={index} className={`issue-${issue.severity}`}>{issue.message}</p>)}</> : <><p className="panel-label">AI PANEL · ON-DEVICE</p><p className="assistant-boundary">Heuristic text insight; no document data leaves this browser.</p><p>{assistantText}</p></>}</aside>}{palette && <CommandPalette commands={commands} onClose={() => setPalette(false)} />}</>;
}
