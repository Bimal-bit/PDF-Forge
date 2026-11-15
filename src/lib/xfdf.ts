import type { AnnotationObject } from '../types';

const annotationTypes = new Set(['highlight', 'note', 'stamp', 'measure']);

function escapeXml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' })[character]!);
}

function numberAttribute(node: Element, name: string, fallback?: number): number {
  const value = node.getAttribute(name);
  if (value === null && fallback !== undefined) return fallback;
  if (value === null || !value.trim() || !Number.isFinite(Number(value))) {
    throw new Error(`Invalid annotation ${name}.`);
  }
  return Number(value);
}

export function annotationsToXfdf(annotations: AnnotationObject[]): string {
  const nodes = annotations.map((annotation) => {
    const common = `id="${escapeXml(annotation.id)}" page="${annotation.page}" x="${annotation.x}" y="${annotation.y}"`;
    if (annotation.type === 'highlight') return `<highlight ${common} width="${annotation.width}" height="${annotation.height}" color="${escapeXml(annotation.color)}" author="${escapeXml(annotation.author)}">${escapeXml(annotation.comment)}</highlight>`;
    if (annotation.type === 'note') return `<note ${common} author="${escapeXml(annotation.author)}">${escapeXml(annotation.comment)}</note>`;
    if (annotation.type === 'stamp') return `<stamp ${common} label="${annotation.label}"/>`;
    return `<measure ${common} width="${annotation.width}" height="${annotation.height}" units="${annotation.units}"/>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><xfdf xmlns="http://ns.adobe.com/xfdf/"><annots>${nodes.join('')}</annots></xfdf>`;
}

export function annotationsFromXfdf(xml: string): AnnotationObject[] {
  const document = new DOMParser().parseFromString(xml, 'application/xml');
  if (document.getElementsByTagName('parsererror').length || document.documentElement.localName !== 'xfdf') {
    throw new Error('Choose a valid PDFForge annotation XML file.');
  }
  const container = Array.from(document.documentElement.children).find((node) => node.localName === 'annots');
  if (!container) throw new Error('The annotation file has no annots container.');
  return Array.from(container.children).flatMap<AnnotationObject>((node) => {
    const type = node.localName;
    if (!annotationTypes.has(type)) return [];
    const page = numberAttribute(node, 'page');
    if (!Number.isInteger(page) || page < 1) throw new Error('Annotation pages must be positive integers.');
    const common = { id: node.getAttribute('id') || crypto.randomUUID(), page, x: numberAttribute(node, 'x'), y: numberAttribute(node, 'y') };
    const author = node.getAttribute('author') ?? 'PDFForge';
    const comment = node.textContent ?? '';
    if (type === 'highlight') {
      const width = numberAttribute(node, 'width', 120);
      const height = numberAttribute(node, 'height', 18);
      if (width <= 0 || height <= 0) throw new Error('Highlight dimensions must be positive.');
      return [{ ...common, type, width, height, color: node.getAttribute('color') || '#f6d365', author, comment }];
    }
    if (type === 'note') return [{ ...common, type, author, comment }];
    if (type === 'stamp') {
      const label = node.getAttribute('label');
      return [{ ...common, type, label: label === 'DRAFT' || label === 'CONFIDENTIAL' ? label : 'APPROVED' }];
    }
    const units = node.getAttribute('units');
    return [{ ...common, type: 'measure', width: numberAttribute(node, 'width', 100), height: numberAttribute(node, 'height', 0), units: units === 'in' || units === 'cm' ? units : 'pt' }];
  });
}
