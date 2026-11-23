import { LayoutToolbar } from './LayoutToolbar';
import { Download, FileText, Search, FilePlus2, Redo2, Undo2 } from 'lucide-react';
import { lazy, Suspense, useEffect, useState, type ChangeEvent } from 'react';
import type { RibbonTab } from '../types';
import { useAppStore } from '../store/useAppStore';
import { documentAccept } from '../lib/openDocument';
import { useLocalDocumentOpen } from './useLocalDocumentOpen';
import { useViewStore } from '../store/useViewStore';
import { downloadPdf, exportPdf } from '../lib/export';
import {
  checkAccessibility,
  localDocumentInsight,
  type AccessibilityReport,
} from '../lib/accessibility';
import { editedTextPages } from '../lib/conversion';
import { TextFormatting } from './TextFormatting';
import { ProductivityPanels } from './ProductivityPanels';
import { ThemeToggle } from './ThemeToggle';
import { ReviewToolbar } from './ReviewToolbar';
import { InsertToolbar } from './InsertToolbar';
import { ViewToolbar } from './ViewToolbar';
import { ToolsToolbar } from './ToolsToolbar';
import { useToolRunner, type ToolRunner } from './useToolRunner';
import { useAddText } from './useAddText';

const OcrPanel = lazy(() => import('./OcrPanel').then((module) => ({ default: module.OcrPanel })));
const CertificatePanel = lazy(() =>
  import('./CertificatePanel').then((module) => ({ default: module.CertificatePanel })),
);

const tabs: RibbonTab[] = ['Home', 'Insert', 'Layout', 'Review', 'View', 'Tools'];
const tabLabels: Record<'en' | 'es', Record<RibbonTab, string>> = {
  en: {
    File: 'File',
    Home: 'Home',
    Insert: 'Insert',
    Layout: 'Layout',
    Review: 'Review',
    View: 'View',
    Tools: 'Tools',
  },
  es: {
    File: 'Archivo',
    Home: 'Inicio',
    Insert: 'Insertar',
    Layout: 'Diseño',
    Review: 'Revisar',
    View: 'Ver',
    Tools: 'Herramientas',
  },
};

export function Ribbon() {
  const {
    activeTab,
    setTab,
    setNotice,
    undo,
    redo,
    history,
    future,
    document,
    objects,
    pageSettings,
  } = useAppStore();
  const ocrPanel = useViewStore((view) => view.ocrOpen);
  const mobileToolsOpen = useViewStore((view) => view.mobileToolsOpen);
  const setOcrPanel = (ocrOpen: boolean) => useViewStore.setState({ ocrOpen, ocrEditable: false });
  const opener = useLocalDocumentOpen();
  const [certificatePanel, setCertificatePanel] = useState(false);
  const [report, setReport] = useState<AccessibilityReport>();
  const [assistantText, setAssistantText] = useState<string>();
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const runner = useToolRunner();
  const textInsertion = useAddText();
  useEffect(() => {
    setReport(undefined);
    setAssistantText(undefined);
  }, [document, objects, pageSettings]);
  const runAccessibility = () => {
    if (!document) return setNotice('Open a PDF before running an accessibility check.');
    void runner.run(
      'Checking accessibility',
      (snapshot) => checkAccessibility(snapshot.document!, snapshot.objects, snapshot.pageSettings),
      (result) => {
        setAssistantText(undefined);
        setReport(result);
      },
    );
  };
  const runAssistant = () => {
    if (!document) return setNotice('Open a PDF before using the local AI panel.');
    void runner.run(
      'Analyzing document text',
      (snapshot) => editedTextPages(snapshot.document!, snapshot.objects, snapshot.pageSettings),
      (pages) => {
        setReport(undefined);
        setAssistantText(localDocumentInsight(pages));
      },
    );
  };
  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await opener.openFile(file);
    event.target.value = '';
  };
  return (
    <header className={`ribbon${mobileToolsOpen ? '' : ' tools-collapsed'}`} aria-label="Editor ribbon">
      <div className="titlebar">
        <div className="brand">
          <span className="brand-mark">
            <FileText size={19} />
          </span>
          <span>PDFForge</span>
          <span className="document-name">
            {useAppStore.getState().document?.name ?? 'Untitled document'}
          </span>
        </div>
        <div className="title-actions">
          <button
            className="action-search"
            aria-label="Search actions"
            onClick={() =>
              window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
            }
          >
            <Search size={14} />
            <span>Search actions</span>
            <kbd>Ctrl K</kbd>
          </button>
          <button aria-label="Undo" title="Undo (Ctrl+Z)" onClick={undo} disabled={!history.length}>
            <Undo2 size={16} />
          </button>
          <button aria-label="Redo" title="Redo (Ctrl+Y)" onClick={redo} disabled={!future.length}>
            <Redo2 size={16} />
          </button>
          <label className="open-button" title="Open a PDF or image">
            <FilePlus2 size={16} /> Open PDF
            <input
              aria-label="Open PDF"
              type="file"
              accept={documentAccept}
              disabled={opener.busy}
              onChange={openFile}
            />
          </label>
          <button
            aria-label="Export PDF"
            title="Export PDF"
            disabled={!document || Boolean(runner.busy)}
            aria-busy={runner.busy === 'Exporting PDF'}
            onClick={() => {
              if (document)
                void runner.run('Exporting PDF',
                  (snapshot) => exportPdf(snapshot.document!, snapshot.objects, snapshot.pageSettings),
                  (bytes, snapshot) => {
                    downloadPdf(bytes, snapshot.document!.name);
                    setNotice('Edited PDF downloaded.');
                  });
            }}
          >
            <Download size={16} />
            <span>{runner.busy === 'Exporting PDF' ? 'Exporting…' : 'Export'}</span>
          </button>
          <label className="language-picker">
            Language
            <select
              aria-label="Language"
              value={language}
              onChange={(event) => {
                const next = event.target.value as 'en' | 'es';
                setLanguage(next);
                globalThis.document.documentElement.lang = next;
              }}
            >
              <option value="en">English</option>
              <option value="es">Español</option>
            </select>
          </label>
          <ThemeToggle />
        </div>
      </div>
      <nav className="tabs" aria-label="Ribbon tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={activeTab === tab ? 'active' : ''}
            aria-current={activeTab === tab ? 'page' : undefined}
            onClick={() => setTab(tab)}
          >
            {tabLabels[language][tab]}
          </button>
        ))}
      </nav>
      <RibbonTools
        runner={runner}
        onOcr={() => setOcrPanel(true)}
        onCertificate={() => setCertificatePanel(true)}
        tab={activeTab}
        onAccessibility={runAccessibility}
        onAssistant={runAssistant}
      />
      {ocrPanel && (
        <Suspense fallback={<span>Loading OCR tools...</span>}>
          <OcrPanel onClose={() => setOcrPanel(false)} />
        </Suspense>
      )}
      {certificatePanel && (
        <Suspense fallback={<span>Loading signing tools...</span>}>
          <CertificatePanel key={document?.id} onClose={() => setCertificatePanel(false)} />
        </Suspense>
      )}
      <ProductivityPanels
        report={report}
        assistantText={assistantText}
        onClose={() => {
          setReport(undefined);
          setAssistantText(undefined);
        }}
        onAccessibility={runAccessibility}
        onAssistant={runAssistant}
        onAddText={textInsertion.addText}
        canAddText={textInsertion.ready}
        onExportText={() => setTab('Tools')}
        onOcr={() => setOcrPanel(true)}
      />
    </header>
  );
}

function RibbonTools({
  tab,
  runner,
  onAccessibility,
  onAssistant,
  onCertificate,
  onOcr,
}: {
  tab: RibbonTab;
  runner: ToolRunner;
  onAccessibility: () => void;
  onAssistant: () => void;
  onCertificate: () => void;
  onOcr: () => void;
}) {
  return (
    <div className="tool-strip" aria-label={`${tab} tools`}>
      {tab === 'Home' && <TextFormatting />}
      {tab === 'View' && <ViewToolbar />}
      {tab === 'Insert' && <InsertToolbar />}
      {tab === 'Review' && <ReviewToolbar />}
      {tab === 'Layout' && <LayoutToolbar />}
      {tab === 'Tools' && (
        <ToolsToolbar
          runner={runner}
          onOcr={onOcr}
          onCertificate={onCertificate}
          onAccessibility={onAccessibility}
          onAssistant={onAssistant}
        />
      )}
    </div>
  );
}
