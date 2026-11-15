import type { AnnotationObject } from '../types';

const annotationTypes = new Set(['highlight', 'note', 'stamp', 'measure']);

function escapeXml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&apos;', '"': '&quot;' })[character]!);
}

function attr(value: string, name: string) {
  return new RegExp(`${name}="([^"]*)"`).exec(value)?.[1] ?? '';
}

export function annotationsToXfdf(annotations: AnnotationObject[]): string {
  const nodes = annotations.map((annotation) => {
    const common = `id="${escapeXml(annotation.id)}" page="${annotation.page}" x="${annotation.x}" y="${annotation.y}"`;
    if (annotation.type === 'highlight') return `<highlight ${common} width="${annotation.width}" height="${annotation.height}" color="${annotation.color}" author="${escapeXml(annotation.author)}">${escapeXml(annotation.comment)}</highlight>`;
    if (annotation.type === 'note') return `<note ${common} author="${escapeXml(annotation.author)}">${escapeXml(annotation.comment)}</note>`;
    if (annotation.type === 'stamp') return `<stamp ${common} label="${annotation.label}"/>`;
    return `<measure ${common} width="${annotation.width}" height="${annotation.height}" units="${annotation.units}"/>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?><xfdf xmlns="http://ns.adobe.com/xfdf/"><annots>${nodes.join('')}</annots></xfdf>`;
}

export function annotationsFromXfdf(xml: string): AnnotationObject[] {
  const nodes = [...xml.matchAll(/<(highlight|note|stamp|measure)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/g)];
  return nodes.flatMap<AnnotationObject>((node) => {
    const type = node[1]; const attributes = node[2];
    if (!annotationTypes.has(type)) return [];
    const page = Number(attr(attributes, 'page')); const x = Number(attr(attributes, 'x')); const y = Number(attr(attributes, 'y'));
    if (![page, x, y].every(Number.isFinite) || page < 1) return [];
    const id = attr(attributes, 'id') || crypto.randomUUID();
    const text = (node[3] ?? '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&apos;/g, "'").replace(/&quot;/g, '"');
    if (type === 'highlight') return [{ id, type, page, x, y, width: Number(attr(attributes, 'width')) || 120, height: Number(attr(attributes, 'height')) || 18, color: attr(attributes, 'color') || '#f6d365', author: attr(attributes, 'author') || 'PDFForge', comment: text }];
    if (type === 'note') return [{ id, type, page, x, y, author: attr(attributes, 'author') || 'PDFForge', comment: text }];
    if (type === 'stamp') { const label = attr(attributes, 'label'); return [{ id, type, page, x, y, label: label === 'DRAFT' || label === 'CONFIDENTIAL' ? label : 'APPROVED' }]; }
    const units = attr(attributes, 'units'); return [{ id, type: 'measure' as const, page, x, y, width: Number(attr(attributes, 'width')) || 100, height: Number(attr(attributes, 'height')) || 0, units: units === 'in' || units === 'cm' ? units : 'pt' }];
  });
}
