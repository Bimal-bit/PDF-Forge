import { Download, FileText, Search, FilePlus2, Redo2, Undo2 } from 'lucide-react';
import { lazy, Suspense, useState, type ChangeEvent } from 'react';
import type { RibbonTab } from '../types';
import { useAppStore } from '../store/useAppStore';
import { toPdfDocument } from '../lib/file';
import { downloadPdf, exportPdf, mergePdfs, splitPdf } from '../lib/export';
import { detectFormFields, formData } from '../lib/formFields';
import { exportMailMerge, parseCsv } from '../lib/forms';
import { annotationsFromXfdf, annotationsToXfdf } from '../lib/xfdf';
import { decryptPdfPackage, encryptPdfPackage } from '../lib/security';
import { compareDocuments, extractTables, optimizePdf, renderPagePng, tablesToCsv, textToHtml } from '../lib/advanced';
import { checkAccessibility, localDocumentInsight, type AccessibilityReport } from '../lib/accessibility';
import { FormDataTools } from './FormDataTools';
import { ConversionTools } from './ConversionTools';
import { editedTextPages } from '../lib/conversion';
import { secureExport } from '../lib/secureExport';
import { TextFormatting } from './TextFormatting';
import { ProductivityPanels } from './ProductivityPanels';
import { ThemeToggle } from './ThemeToggle';

const OcrPanel = lazy(() => import('./OcrPanel').then((module) => ({ default: module.OcrPanel })));
const CertificatePanel = lazy(() => import('./CertificatePanel').then((module) => ({ default: module.CertificatePanel })));

const tabs: RibbonTab[] = ['File', 'Home', 'Insert', 'Layout', 'Review', 'View', 'Tools'];
const tabLabels: Record<'en' | 'es', Record<RibbonTab, string>> = { en: { File: 'File', Home: 'Home', Insert: 'Insert', Layout: 'Layout', Review: 'Review', View: 'View', Tools: 'Tools' }, es: { File: 'Archivo', Home: 'Inicio', Insert: 'Insertar', Layout: 'Diseño', Review: 'Revisar', View: 'Ver', Tools: 'Herramientas' } };

export function Ribbon() {
  const { activeTab, setTab, setDocument, setNotice, undo, redo, history, future, document, objects, pageSettings } = useAppStore();
  const [ocrPanel, setOcrPanel] = useState(false);
  const [certificatePanel, setCertificatePanel] = useState(false);
  const [report, setReport] = useState<AccessibilityReport>();
  const [assistantText, setAssistantText] = useState<string>();
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const runAccessibility = () => { if (!document) return setNotice('Open a PDF before running an accessibility check.'); void checkAccessibility(document, objects).then((result) => { setAssistantText(undefined); setReport(result); }).catch(() => setNotice('Could not inspect this PDF for accessibility.')); };
  const runAssistant = () => { if (!document) return setNotice('Open a PDF before using the local AI panel.'); void editedTextPages(document, objects, pageSettings).then((pages) => { setReport(undefined); setAssistantText(localDocumentInsight(pages)); }).catch(() => setNotice('Could not analyze this PDF locally.')); };
  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try { setDocument(await toPdfDocument(file)); } catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to open that file.'); }
    event.target.value = '';
  };
  return <header className="ribbon" aria-label="Editor ribbon">
    <div className="titlebar">
      <div className="brand"><span className="brand-mark"><FileText size={19} /></span><span>PDFForge</span><span className="document-name">{useAppStore.getState().document?.name ?? 'Untitled document'}</span></div>
      <div className="title-actions"><button className="action-search" onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}><Search size={14} /><span>Search actions</span><kbd>Ctrl K</kbd></button>
        <button aria-label="Undo" title="Undo (Ctrl+Z)" onClick={undo} disabled={!history.length}><Undo2 size={16} /></button>
        <button aria-label="Redo" title="Redo (Ctrl+Y)" onClick={redo} disabled={!future.length}><Redo2 size={16} /></button>
        <label className="open-button"><FilePlus2 size={16} /> Open PDF<input aria-label="Open PDF" type="file" accept="application/pdf,.pdf" onChange={openFile} /></label>
        <button aria-label="Export PDF" title="Export PDF" disabled={!document} onClick={() => { if (document) void exportPdf(document, objects, pageSettings).then((bytes) => { downloadPdf(bytes, document.name); setNotice('Edited PDF downloaded.'); }).catch(() => setNotice('PDF export failed.')); }}><Download size={16} /><span>Export</span></button>
        <label className="language-picker">Language<select aria-label="Language" value={language} onChange={(event) => { const next = event.target.value as 'en' | 'es'; setLanguage(next); globalThis.document.documentElement.lang = next; }}><option value="en">English</option><option value="es">Español</option></select></label><ThemeToggle />
      </div>
    </div>
    <nav className="tabs" aria-label="Ribbon tabs">{tabs.map((tab) => <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setTab(tab)}>{tabLabels[language][tab]}</button>)}</nav>
    <RibbonTools onOcr={() => setOcrPanel(true)} onCertificate={() => setCertificatePanel(true)} tab={activeTab} onAccessibility={runAccessibility} onAssistant={runAssistant} />
    {ocrPanel && <Suspense fallback={<span>Loading OCR tools...</span>}><OcrPanel onClose={() => setOcrPanel(false)} /></Suspense>}
    {certificatePanel && <Suspense fallback={<span>Loading signing tools...</span>}><CertificatePanel onClose={() => setCertificatePanel(false)} /></Suspense>}
    <ProductivityPanels report={report} assistantText={assistantText} onClose={() => { setReport(undefined); setAssistantText(undefined); }} onAccessibility={runAccessibility} onAssistant={runAssistant} onAddText={() => useAppStore.getState().addTextObject()} onExportText={() => setTab('Tools')} />
  </header>;
}

function RibbonTools({ tab, onAccessibility, onAssistant, onCertificate, onOcr }: { tab: RibbonTab; onAccessibility: () => void; onAssistant: () => void; onCertificate: () => void; onOcr: () => void }) {
  const { setZoom, zoom, toggleRightPanel, addTextObject, addObject, document, setDocument, selectedPage, objects, importAnnotations, setNotice, movePage, rotatePage, deletePage, duplicatePage, pageSettings, updatePageSettings } = useAppStore();
  const [redactionText, setRedactionText] = useState('');
  const [password, setPassword] = useState('');
  const sourcePage = pageSettings.order[selectedPage - 1] ?? selectedPage;
  const tools: Record<RibbonTab, string[]> = {
    File: [], Home: [], Insert: ['Add text overlay', 'Add shape', 'Add table', 'Add link', 'Add text field', 'Add checkbox', 'Add radio', 'Add dropdown', 'Add list', 'Add date field', 'Add button field', 'Add signature field'], Layout: [], Review: ['Highlight', 'Add comment', 'Approved stamp', 'Measure'], View: ['Zoom out', 'Zoom in', 'Properties'], Tools: ['Offline OCR', 'Certificate signing', 'Detect form fields', 'Export form JSON', 'Check accessibility', 'Open AI panel', 'Export text', 'Export HTML', 'Export page PNG', 'Extract tables CSV', 'Optimize PDF', 'Compare PDF', 'Move page up', 'Move page down', 'Rotate page', 'Duplicate page', 'Delete page', 'Split current page'],
  };
  const activate = (tool: string) => {
    if (tool === 'Offline OCR') return onOcr();
    if (tool === 'Certificate signing') return onCertificate();
    if (tool === 'Detect form fields' && document) return void detectFormFields(document).then((fields) => { const names = new Set(objects.filter((object) => object.type === 'form').map((object) => object.existingName)); fields.filter((field) => !names.has(field.existingName)).forEach(addObject); setNotice(`${fields.length} existing fields detected.`); }).catch(() => setNotice('Could not detect existing fields.'));
    if (tool === 'Export form JSON') return download([JSON.stringify(formData(objects.filter((object): object is import('../types').FormObject => object.type === 'form')), null, 2)], 'form-data.json', 'application/json');
    const formKinds: Record<string, import('../types').FormObject['kind']> = { 'Add radio': 'radio', 'Add dropdown': 'dropdown', 'Add list': 'list', 'Add date field': 'date', 'Add button field': 'button' };
    if (tool in formKinds) return addObject({ id: crypto.randomUUID(), type: 'form', kind: formKinds[tool], page: sourcePage, x: 72, y: 140, width: 180, height: 32, label: formKinds[tool], value: '', options: ['Option 1', 'Option 2'] });
    if (tool === 'Check accessibility') return onAccessibility();
    if (tool === 'Open AI panel') return onAssistant();
    if (tool === 'Export text') return void exportText();
    if (tool === 'Export HTML') return void exportHtml();
    if (tool === 'Export page PNG') return void exportPng();
    if (tool === 'Extract tables CSV') return void exportTables();
    if (tool === 'Optimize PDF') return void optimize();
    if (tool === 'Compare PDF') return comparePicker();
    if (tool === 'Add text overlay') return addTextObject(sourcePage);
    if (tool === 'Add shape') return addObject({ id: crypto.randomUUID(), type: 'shape', page: sourcePage, x: 72, y: 72, width: 140, height: 80, color: '#d65737' });
    if (tool === 'Add table') return addObject({ id: crypto.randomUUID(), type: 'table', page: sourcePage, x: 72, y: 72, width: 220, height: 90, cells: [['Header 1', 'Header 2'], ['Cell 1', 'Cell 2']] });
    if (tool === 'Add link') return addObject({ id: crypto.randomUUID(), type: 'link', page: sourcePage, x: 72, y: 72, label: 'https://example.com', url: 'https://example.com', fontSize: 12 });
    if (tool === 'Add text field') return addObject({ id: crypto.randomUUID(), type: 'form', kind: 'text', page: sourcePage, x: 72, y: 72, width: 180, height: 24, label: 'Field', value: '' });
    if (tool === 'Add checkbox') return addObject({ id: crypto.randomUUID(), type: 'form', kind: 'checkbox', page: sourcePage, x: 72, y: 72, width: 18, height: 18, label: 'Checkbox', value: '', checked: false });
    if (tool === 'Add signature field') return addObject({ id: crypto.randomUUID(), type: 'form', kind: 'signature', page: sourcePage, x: 72, y: 72, width: 180, height: 38, label: 'Signature', value: 'Signer name' });
    if (tool === 'Highlight') return addObject({ id: crypto.randomUUID(), type: 'highlight', page: sourcePage, x: 72, y: 72, width: 160, height: 20, color: '#f6d365', author: 'PDFForge', comment: 'Highlight' });
    if (tool === 'Add comment') return addObject({ id: crypto.randomUUID(), type: 'note', page: sourcePage, x: 72, y: 72, author: 'PDFForge', comment: 'New comment' });
    if (tool === 'Approved stamp') return addObject({ id: crypto.randomUUID(), type: 'stamp', page: sourcePage, x: 72, y: 72, label: 'APPROVED' });
    if (tool === 'Measure') return addObject({ id: crypto.randomUUID(), type: 'measure', page: sourcePage, x: 72, y: 72, width: 144, height: 0, units: 'in' });
    if (tool === 'Zoom out') return setZoom(zoom - 10);
    if (tool === 'Zoom in') return setZoom(zoom + 10);
    if (tool === 'Properties') return toggleRightPanel();
    if (tool === 'Move page up') return movePage(-1);
    if (tool === 'Move page down') return movePage(1);
    if (tool === 'Rotate page') return rotatePage();
    if (tool === 'Duplicate page') return duplicatePage();
    if (tool === 'Delete page') return deletePage();
    if (tool === 'Split current page' && document) return void splitPdf(document, [sourcePage], objects, pageSettings).then((bytes) => { downloadPdf(bytes, `${document.name.replace(/\.pdf$/i, '')}-page-${selectedPage}.pdf`); setNotice('Current page downloaded as a separate PDF.'); }).catch(() => setNotice('Could not split that PDF.'));
  };
  const addImage = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; addObject({ id: crypto.randomUUID(), type: 'image', page: sourcePage, x: 72, y: 72, width: 180, height: 120, dataUrl: await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }) }); event.target.value = ''; };
  const exportXfdf = () => { const text = annotationsToXfdf(objects.filter((object): object is import('../types').AnnotationObject => ['highlight', 'note', 'stamp', 'measure'].includes(object.type))); const link = globalThis.document.createElement('a'); link.href = URL.createObjectURL(new Blob([text], { type: 'application/vnd.adobe.xfdf+xml' })); link.download = 'annotations.xfdf'; link.click(); URL.revokeObjectURL(link.href); };
  const importXfdf = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; try { const annotations = annotationsFromXfdf(await file.text()); importAnnotations(annotations); setNotice(annotations.length ? `${annotations.length} annotation${annotations.length === 1 ? '' : 's'} imported.` : 'No supported PDFForge annotations were found.'); } catch { setNotice('Could not import that XFDF file.'); } event.target.value = ''; };
  const merge = async (event: ChangeEvent<HTMLInputElement>) => { const files = Array.from(event.target.files ?? []); if (files.length < 2) return setNotice('Choose two or more PDFs to merge.'); try { downloadPdf(await mergePdfs(await Promise.all(files.map(toPdfDocument))), 'merged.pdf'); setNotice(`${files.length} PDFs merged locally.`); } catch { setNotice('Could not merge those PDFs.'); } event.target.value = ''; };
  const mailMerge = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file || !document) return; try { const rows = parseCsv(await file.text()); if (!rows.length) return setNotice('The CSV needs a header row and at least one recipient.'); const files = await exportMailMerge(document, objects, pageSettings, rows); files.forEach(({ bytes, name }) => downloadPdf(bytes, name)); setNotice(`${files.length} recipient PDFs generated locally.`); } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not process that CSV file.'); } event.target.value = ''; };
  const redact = async () => { if (!document || !redactionText.trim()) return setNotice('Enter the exact text to redact.'); try { const result = await secureExport(document, objects, pageSettings, [redactionText]); downloadPdf(result, `${document.name.replace(/\.pdf$/i, '')}-redacted.pdf`); setNotice('Redacted copy verified and downloaded.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not create a verified redaction.'); } };
  const sanitize = async () => { if (!document) return; try { downloadPdf(await secureExport(document, objects, pageSettings), `${document.name.replace(/\.pdf$/i, '')}-sanitized.pdf`); setNotice('Sanitized copy downloaded.'); } catch { setNotice('Could not sanitize that PDF.'); } };
  const protect = async () => { if (!document) return; try { const pdf = await exportPdf(document, objects, pageSettings); const bytes = await encryptPdfPackage(pdf, password); const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; const link = globalThis.document.createElement('a'); link.href = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' })); link.download = `${document.name.replace(/\.pdf$/i, '')}.pdfg`; link.click(); URL.revokeObjectURL(link.href); setNotice('Password-protected package downloaded.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not protect that document.'); } };
  const openProtected = async (event: ChangeEvent<HTMLInputElement>) => { const file = event.target.files?.[0]; if (!file) return; const entryPassword = globalThis.prompt('Enter the package password'); if (!entryPassword) return; try { const data = await decryptPdfPackage(new Uint8Array(await file.arrayBuffer()), entryPassword); if (new TextDecoder().decode(data.slice(0, 5)) !== '%PDF-') throw new Error('The protected package did not contain a PDF.'); setDocument({ id: crypto.randomUUID(), name: file.name.replace(/\.pdfg$/i, '.pdf'), size: data.byteLength, modifiedAt: Date.now(), data: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer }); } catch { setNotice('Could not open that protected package. Check its password.'); } event.target.value = ''; };
  const download = (data: BlobPart[], name: string, type: string) => { const link = globalThis.document.createElement('a'); link.href = URL.createObjectURL(new Blob(data, { type })); link.download = name; link.click(); URL.revokeObjectURL(link.href); };
  const exportText = async () => { if (!document) return; try { download([await editedTextPages(document, objects, pageSettings).then((pages) => pages.join('\n\n--- Page break ---\n\n'))], `${document.name.replace(/\.pdf$/i, '')}.txt`, 'text/plain;charset=utf-8'); setNotice('Text extracted locally and downloaded.'); } catch { setNotice('Could not extract text from that PDF.'); } };
  const exportHtml = async () => { if (!document) return; try { const pages = await editedTextPages(document, objects, pageSettings); download([textToHtml(pages, document.name)], `${document.name.replace(/\.pdf$/i, '')}.html`, 'text/html;charset=utf-8'); setNotice('HTML conversion downloaded.'); } catch { setNotice('Could not convert that PDF to HTML.'); } };
  const exportPng = async () => { if (!document) return; try { const bytes = await exportPdf(document, objects, pageSettings); const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; download([await renderPagePng({ ...document, data }, selectedPage)], `${document.name.replace(/\.pdf$/i, '')}-page-${selectedPage}.png`, 'image/png'); setNotice(`Page ${selectedPage} image downloaded.`); } catch (error) { setNotice(error instanceof Error ? error.message : 'Could not export that page image.'); } };
  const exportTables = async () => { if (!document) return; try { const tables = await extractTables(document); if (!tables.length) return setNotice('No multi-run text table candidates were found.'); download([tablesToCsv(tables)], `${document.name.replace(/\.pdf$/i, '')}-tables.csv`, 'text/csv;charset=utf-8'); setNotice(`${tables.length} extracted table${tables.length === 1 ? '' : 's'} downloaded as CSV.`); } catch { setNotice('Could not extract tables from that PDF.'); } };
  const optimize = async () => { if (!document) return; try { const bytes = await optimizePdf(document); const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; download([data], `${document.name.replace(/\.pdf$/i, '')}-optimized.pdf`, 'application/pdf'); const delta = document.size - bytes.byteLength; setNotice(delta > 0 ? `Optimized PDF downloaded (${Math.round(delta / 1024)} KB smaller).` : 'Repacked PDF downloaded; this source could not be made smaller.'); } catch { setNotice('Could not optimize that PDF.'); } };
  const comparePicker = () => { if (!document) return; const input = globalThis.document.createElement('input'); input.type = 'file'; input.accept = 'application/pdf,.pdf'; input.onchange = () => { const file = input.files?.[0]; if (!file) return; void toPdfDocument(file).then((other) => compareDocuments(document, other)).then((results) => { const changes = results.filter((entry) => !entry.equal).length; setNotice(changes ? `${changes} page${changes === 1 ? '' : 's'} contain text changes.` : 'No extracted text differences found.'); }).catch(() => setNotice('Could not compare that PDF.')); }; input.click(); };
  const field = (label: 'header' | 'footer' | 'watermark', name: string) => <label className="page-field">{name}<input aria-label={name} value={pageSettings[label]} placeholder={label === 'header' || label === 'footer' ? 'Use {page} for page number' : 'Optional'} onChange={(event) => updatePageSettings({ [label]: event.target.value })} /></label>;
  return <div className={`tool-strip ${tab === 'Tools' ? 'tools-strip' : ''}`} aria-label={`${tab} tools`}>{tab === 'Home' && <TextFormatting />}{tools[tab].map((tool) => <button key={tool} disabled={!document && (tool.startsWith('Add ') || tool === 'Highlight' || tool === 'Approved stamp' || tool === 'Measure' || tool.includes('page') || tool.includes('Split'))} onClick={() => activate(tool)}>{tool}</button>)}{tab === 'Insert' && <label className="insert-image">Add image<input aria-label="Add image" type="file" accept="image/png,image/jpeg" disabled={!document} onChange={(event) => void addImage(event)} /></label>}{tab === 'Review' && <><button disabled={!document} onClick={exportXfdf}>Export PDFForge XFDF</button><label className="insert-image">Import PDFForge XFDF<input aria-label="Import PDFForge XFDF" type="file" accept=".xfdf,application/vnd.adobe.xfdf+xml,text/xml" disabled={!document} onChange={(event) => void importXfdf(event)} /></label></>}{tab === 'Tools' && <><ConversionTools /><FormDataTools /><label className="insert-image">Open protected package<input aria-label="Open protected package" type="file" accept=".pdfg,application/octet-stream" onChange={(event) => void openProtected(event)} /></label><label className="insert-image">Merge PDFs<input aria-label="Merge PDFs" type="file" accept="application/pdf,.pdf" multiple onChange={(event) => void merge(event)} /></label><label className="insert-image">Mail merge CSV<input aria-label="Mail merge CSV" type="file" accept=".csv,text/csv" disabled={!document} onChange={(event) => void mailMerge(event)} /></label><label className="page-field">Redact text<input aria-label="Redact text" value={redactionText} placeholder="Exact text" onChange={(event) => setRedactionText(event.target.value)} /></label><button disabled={!document || !redactionText.trim()} onClick={() => void redact()}>Export redacted copy</button><button disabled={!document} onClick={() => void sanitize()}>Sanitize PDF</button><label className="page-field">Package password<input aria-label="Package password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button disabled={!document || password.length < 8} onClick={() => void protect()}>Export protected package</button>{field('header', 'Header')}{field('footer', 'Footer')}{field('watermark', 'Watermark')}<label className="page-field">Bates start<input aria-label="Bates start" type="number" min="0" value={pageSettings.batesStart ?? ''} onChange={(event) => updatePageSettings({ batesStart: event.target.value === '' ? null : Number(event.target.value) })} /></label></>}<span className="tool-hint">{tab === 'Tools' ? 'Secure copies include current edits and flatten pages to images. Redaction covers matching text runs. Password packages use .pdfg.' : tab === 'Review' ? 'Annotation exchange uses the PDFForge XML schema.' : tab === 'Insert' ? 'Fields are fillable in the editor and exported as PDF form controls.' : 'Local browser workspace'}</span></div>;
}
