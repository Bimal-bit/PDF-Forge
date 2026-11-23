import { PDFDocument, type PDFFont, PDFName } from 'pdf-lib';
import type { AnnotationObject } from '../types';
import { annotationBox, measurementLabel } from './annotations';
import { pdfColor } from './color';

export function annotationAppearance(
  pdf: PDFDocument,
  annotation: AnnotationObject,
  font: PDFFont,
) {
  let width = 22;
  let height = 22;
  let content = '';
  if (annotation.type === 'highlight') {
    width = annotation.width;
    height = annotation.height;
    const color = pdfColor(annotation.color);
    content = `q /Alpha gs ${color.red} ${color.green} ${color.blue} rg 0 0 ${width} ${height} re f Q`;
  } else if (annotation.type === 'note') {
    content = 'q 1 .8 .2 rg 0 0 22 22 re f .3 .2 0 RG 1 w 0 0 22 22 re S Q';
  } else if (annotation.type === 'stamp') {
    width = 110;
    height = 32;
    content = `q .7 .2 .15 RG 2 w 1 1 108 30 re S .7 .2 .15 rg BT /F1 11 Tf 7 11 Td ${font.encodeText(annotation.label)} Tj ET Q`;
  } else {
    const box = annotationBox(annotation);
    width = box.width;
    height = box.height;
    content = `q .2 .45 .65 RG 1 w ${annotation.x - box.x} ${annotation.y - box.y} m ${annotation.x + annotation.width - box.x} ${annotation.y + annotation.height - box.y} l S .2 .45 .65 rg BT /F1 9 Tf 1 ${height - 10} Td ${font.encodeText(measurementLabel(annotation))} Tj ET Q`;
  }
  const stream = pdf.context.flateStream(content, {
    Type: 'XObject',
    Subtype: 'Form',
    BBox: [0, 0, width, height],
    Resources: { Font: { F1: font.ref }, ExtGState: { Alpha: { Type: 'ExtGState', ca: 0.35 } } },
  });
  stream.dict.set(PDFName.of('FormType'), pdf.context.obj(1));
  return pdf.context.register(stream);
}
