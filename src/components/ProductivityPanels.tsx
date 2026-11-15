import { useEffect, useState } from 'react';
import type { AccessibilityReport } from '../lib/accessibility';

interface Props {
  report?: AccessibilityReport;
  assistantText?: string;
  onClose: () => void;
  onAccessibility: () => void;
  onAssistant: () => void;
  onAddText: () => void;
  onExportText: () => void;
}

export function ProductivityPanels({ report, assistantText, onClose, onAccessibility, onAssistant, onAddText, onExportText }: Props) {
  const [palette, setPalette] = useState(false);
  const [query, setQuery] = useState('');
  useEffect(() => { const key = (event: KeyboardEvent) => { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setPalette(true); } if (event.key === 'Escape') setPalette(false); }; window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key); }, []);
  const commands = [{ label: 'Check accessibility', run: onAccessibility }, { label: 'Open local AI panel', run: onAssistant }, { label: 'Add text overlay', run: onAddText }, { label: 'Open export tools', run: onExportText }];
  const matches = commands.filter((command) => command.label.toLocaleLowerCase().includes(query.toLocaleLowerCase().trim()));
  return <>{(report || assistantText) && <aside className="productivity-panel" aria-label={report ? 'Accessibility report' : 'Local AI panel'}><button className="panel-dismiss" aria-label="Close panel" onClick={onClose}>×</button>{report ? <><p className="panel-label">ACCESSIBILITY CHECK</p><p>{report.pages} pages · {report.words} words</p>{report.issues.map((issue, index) => <p key={index} className={`issue-${issue.severity}`}>{issue.message}</p>)}</> : <><p className="panel-label">AI PANEL · ON-DEVICE</p><p className="assistant-boundary">Heuristic text insight; no document data leaves this browser.</p><p>{assistantText}</p></>}</aside>}{palette && <div className="command-backdrop" role="presentation" onClick={() => setPalette(false)}><section className="command-palette" role="dialog" aria-modal="true" aria-label="Command palette" onClick={(event) => event.stopPropagation()}><input autoFocus aria-label="Search commands" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a command…" /><p className="panel-label">COMMANDS</p>{matches.map((command) => <button key={command.label} onClick={() => { command.run(); setPalette(false); }}>{command.label}</button>)}</section></div>}</>;
}
