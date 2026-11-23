import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import { ConversionTools } from './ConversionTools';
import { FormDataTools } from './FormDataTools';
import { ExtractPagesDialog } from './ExtractPagesDialog';
import { ComparisonReport, type ComparisonResult } from './ComparisonReport';
import { RepeatingMarkTools } from './RepeatingMarkTools';
import { useToolsActions } from './useToolsActions';
import type { ToolRunner } from './useToolRunner';
import type { ToolSession } from '../lib/toolSession';
import '../tools.css';
import { useViewStore } from '../store/useViewStore';

function Group({
  name,
  id,
  columns,
  children,
}: {
  name: string;
  id: string;
  columns: number;
  children: ReactNode;
}) {
  return (
    <div
      id={`tools-${id}`}
      className="tools-command-group"
      role="group"
      aria-label={name}
      style={{ gridTemplateColumns: `repeat(${columns}, max-content)` }}
    >
      {children}
      <span className="tools-group-label">{name}</span>
    </div>
  );
}

function FileTool({
  label,
  disabled,
  accept,
  multiple,
  onFiles,
}: {
  label: string;
  disabled: boolean;
  accept: string;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) {
  return (
    <label className={`tools-file${disabled ? ' disabled' : ''}`}>
      {label}
      <input
        aria-label={label}
        type="file"
        disabled={disabled}
        accept={accept}
        multiple={multiple}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length) onFiles(files);
        }}
      />
    </label>
  );
}

export function ToolsToolbar({
  runner,
  onOcr,
  onCertificate,
  onAccessibility,
  onAssistant,
}: {
  runner: ToolRunner;
  onOcr: () => void;
  onCertificate: () => void;
  onAccessibility: () => void;
  onAssistant: () => void;
}) {
  const state = useAppStore();
  const [redaction, setRedaction] = useState('');
  const [password, setPassword] = useState('');
  const [extract, setExtract] = useState<ToolSession>();
  const [report, setReport] = useState<ComparisonResult>();
  const [reportOpen, setReportOpen] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const actions = useToolsActions(runner, (result) => {
    setReport(result);
  });
  const count = state.pageSettings.order.length;
  const blocked = !state.document || !count || Boolean(runner.busy);
  const forms = state.objects.filter(
    (object) =>
      object.type === 'form' &&
      object.kind !== 'button' &&
      state.pageSettings.order.includes(object.page),
  );
  useEffect(() => {
    setPassword('');
    setRedaction('');
  }, [state.document?.id]);
  useEffect(() => {
    setReport(undefined);
    setReportOpen(false);
  }, [state.document, state.objects, state.pageSettings]);
  const command = (name: string, action?: () => void, disabled = blocked) => (
    <button key={name} disabled={disabled} onClick={action ?? (() => void actions.run(name))}>
      {name}
    </button>
  );
  return (
    <div className="tools-toolbar" aria-label="Tools controls">
      <div ref={scroll} className="tools-command-scroll">
        <Group name="Convert documents" id="convert" columns={4}>
          <ConversionTools runner={runner} />
        </Group>
        <Group name="Text, images & tables" id="exports" columns={2}>
          {['Export text', 'Export HTML', 'Export page PNG', 'Extract tables CSV'].map((name) =>
            command(name),
          )}
        </Group>
        <Group name="Page extraction & assembly" id="pages" columns={1}>
          {command('Extract pages', () => setExtract(useAppStore.getState()), blocked || !count)}
          <FileTool
            label="Merge PDFs"
            disabled={Boolean(runner.busy)}
            accept="application/pdf,.pdf"
            multiple
            onFiles={(files) => void actions.merge(files)}
          />
        </Group>
        <Group name="Forms & data" id="forms" columns={2}>
          {command('Detect form fields')}
          {command('Export form JSON', undefined, blocked || !forms.length)}
          <FormDataTools runner={runner} />
          <FileTool
            label="Mail merge CSV"
            disabled={blocked}
            accept=".csv,text/csv"
            onFiles={([file]) => void actions.mailMerge(file)}
          />
        </Group>
        <Group name="Scan, sign & inspect" id="inspect" columns={4}>
          {command('Offline OCR', onOcr)}
          {command('Edit text in images', () => useViewStore.setState({ ocrOpen: true, ocrEditable: true }))}
          {command('Certificate signing', onCertificate)}
          {command('Check accessibility', onAccessibility)}
          {command('Open AI panel', onAssistant)}
          {command('Compare PDF', actions.compare)}
          {command('Optimize PDF')}
        </Group>
        <Group name="Repeating marks" id="marks" columns={2}>
          <RepeatingMarkTools disabled={blocked} />
        </Group>
        <Group name="Privacy & protection" id="privacy" columns={4}>
          <label className="tools-field">
            Redact text
            <input
              aria-label="Redact text"
              disabled={blocked}
              value={redaction}
              placeholder="Exact text"
              onChange={(event) => setRedaction(event.target.value)}
            />
          </label>
          {command(
            'Export redacted copy',
            () => void actions.secure(redaction),
            blocked || !redaction.trim(),
          )}
          <label className="tools-field">
            Package password
            <input
              aria-label="Package password"
              autoComplete="new-password"
              type="password"
              disabled={blocked}
              value={password}
              placeholder="8+ characters"
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {command(
            'Export protected package',
            () => void actions.protect(password, () => setPassword('')),
            blocked || password.length < 8,
          )}
          {command('Sanitize PDF', () => void actions.secure())}
          <FileTool
            label="Open protected package"
            disabled={Boolean(runner.busy)}
            accept=".pdfg,application/octet-stream"
            onFiles={([file]) => void actions.openProtected(file)}
          />
        </Group>
      </div>
      <div className="tools-context">
        <label>
          Tool group
          <select
            aria-label="Jump to tool group"
            defaultValue="convert"
            onChange={(event) => {
              const group = scroll.current?.querySelector<HTMLElement>(
                `#tools-${event.target.value}`,
              );
              if (group && scroll.current) scroll.current.scrollLeft = group.offsetLeft - 12;
            }}
          >
            <option value="convert">Convert documents</option>
            <option value="exports">Text, images & tables</option>
            <option value="pages">Page extraction & assembly</option>
            <option value="forms">Forms & data</option>
            <option value="inspect">Scan, sign & inspect</option>
            <option value="marks">Repeating marks</option>
            <option value="privacy">Privacy & protection</option>
          </select>
        </label>
        <span>
          Page {state.selectedPage} of {count || 1}
        </span>
        {report && (
          <button disabled={Boolean(runner.busy)} onClick={() => setReportOpen(true)}>
            Comparison report
          </button>
        )}
        <span className="tools-job" aria-live="polite">
          {runner.busy ? `${runner.busy}…` : 'Browser-local processing'}
        </span>
        <span className="tools-boundary">
          Secure copies flatten pages to images. Password packages use .pdfg. AI panel uses local
          text heuristics.
        </span>
      </div>
      {extract && <ExtractPagesDialog snapshot={extract} onClose={() => setExtract(undefined)} />}
      {report && reportOpen && (
        <ComparisonReport report={report} onClose={() => setReportOpen(false)} />
      )}
    </div>
  );
}
