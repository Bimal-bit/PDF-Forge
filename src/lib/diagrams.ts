import { rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import type { ConnectorObject, EditorObject, ShapeObject } from '../types';
import { pdfColor } from './color';

export function shapeAnchor(shape: ShapeObject, target: { x: number; y: number }) {
  const x = shape.x + shape.width / 2;
  const y = shape.y + shape.height / 2;
  const dx = target.x - x;
  const dy = target.y - y;
  const halfWidth = shape.width / 2;
  const halfHeight = shape.height / 2;
  if (!dx && !dy) return { x, y };
  let denominator = Math.max(Math.abs(dx) / halfWidth, Math.abs(dy) / halfHeight);
  if (shape.shapeKind === 'ellipse' || shape.shapeKind === 'terminator')
    denominator = Math.hypot(dx / halfWidth, dy / halfHeight);
  if (shape.shapeKind === 'diamond')
    denominator = Math.abs(dx) / halfWidth + Math.abs(dy) / halfHeight;
  return { x: x + dx / denominator, y: y + dy / denominator };
}

export function connectorPoints(connector: ConnectorObject, objects: EditorObject[]) {
  const from = objects.find((object) => object.id === connector.fromId);
  const to = objects.find((object) => object.id === connector.toId);
  if (
    from?.type !== 'shape' ||
    to?.type !== 'shape' ||
    from.page !== to.page ||
    from.page !== connector.page
  )
    return undefined;
  const start = shapeAnchor(from, { x: to.x + to.width / 2, y: to.y + to.height / 2 });
  const end = shapeAnchor(to, { x: from.x + from.width / 2, y: from.y + from.height / 2 });
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const arrow = [-0.45, 0.45].map((offset) => ({
    x: end.x - 9 * Math.cos(angle + offset),
    y: end.y - 9 * Math.sin(angle + offset),
  }));
  return { start, end, arrow };
}

export function drawDiagram(
  page: PDFPage,
  object: ShapeObject | ConnectorObject,
  objects: EditorObject[],
  font: PDFFont,
) {
  const ink = pdfColor(object.color);
  if (object.type === 'connector') {
    const points = connectorPoints(object, objects);
    if (!points) return;
    page.drawLine({ start: points.start, end: points.end, color: ink, thickness: 1.5 });
    if (object.arrow)
      for (const end of points.arrow)
        page.drawLine({ start: points.end, end, color: ink, thickness: 1.5 });
    return;
  }
  const { x, y, width, height } = object;
  if (object.shapeKind === 'ellipse' || object.shapeKind === 'terminator') {
    page.drawEllipse({
      x: x + width / 2,
      y: y + height / 2,
      xScale: width / 2,
      yScale: height / 2,
      color: rgb(1, 1, 1),
      borderColor: ink,
      borderWidth: 2,
    });
  } else if (object.shapeKind === 'diamond') {
    page.drawSvgPath(
      `M ${width / 2} 0 L ${width} ${height / 2} L ${width / 2} ${height} L 0 ${height / 2} Z`,
      { x, y: y + height, color: rgb(1, 1, 1), borderColor: ink, borderWidth: 2 },
    );
  } else
    page.drawRectangle({
      x,
      y,
      width,
      height,
      color: object.shapeKind ? rgb(1, 1, 1) : undefined,
      borderColor: ink,
      borderWidth: 2,
      opacity: object.shapeKind ? 1 : 0.15,
    });
  if (object.label) {
    const size = Math.min(12, height / 3, (width / Math.max(1, object.label.length)) * 1.5);
    page.drawText(object.label.replace(/[\r\n]/g, ' '), {
      x: x + (width - font.widthOfTextAtSize(object.label.replace(/[\r\n]/g, ' '), size)) / 2,
      y: y + height / 2 - size * 0.35,
      font,
      size,
      color: ink,
    });
  }
}
