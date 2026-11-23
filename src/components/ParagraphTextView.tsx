import { Fragment } from 'react';
import type { TextObject } from '../types';
import type { CaretPoint } from './InPlaceTextEditor';
import { inlineTextStyle } from '../lib/inlineText';
import { blockTextGeometry } from '../lib/textLayout';
import { measureFlowText } from '../lib/textFlow';
import { preservesOcrPixels } from '../lib/ocrAppearance';

let context: CanvasRenderingContext2D | null | undefined;

export function ParagraphTextView({
  object,
  zoom,
  pending,
  onEdit,
}: {
  object: TextObject;
  zoom: number;
  pending: boolean;
  onEdit: (object: TextObject, point?: CaretPoint) => void;
}) {
  const scale = zoom / 100;
  const style = inlineTextStyle(object, zoom);
  const originalPixels = preservesOcrPixels(object);
  const geometry = blockTextGeometry(object, (text) => measureFlowText(object, text));
  const leading = object.fontSize * (object.lineHeight ?? 1.2);
  context ??= document.createElement('canvas').getContext('2d');
  let baseline = object.fontSize;
  if (context) {
    context.font = `${object.italic ? 'italic' : 'normal'} ${object.bold ? 'bold' : 'normal'} ${object.fontSize}px ${style.fontFamily}`;
    const metrics = context.measureText('Hg');
    const ascent = metrics.fontBoundingBoxAscent ?? object.fontSize * 0.8;
    const descent = metrics.fontBoundingBoxDescent ?? object.fontSize * 0.2;
    baseline = (leading - ascent - descent) / 2 + ascent;
  }
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label={`Edit text: ${object.text.slice(0, 60)}`}
      title="Click to edit text"
      className={pending ? 'text-object tracked-text-object' : 'text-object'}
      data-text-object-id={object.id}
      onClick={(event) => onEdit(object, { x: event.clientX, y: event.clientY })}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onEdit(object);
        }
      }}
      style={{
        ...style,
        color: originalPixels ? 'transparent' : object.color,
        bottom: object.y * scale,
        minHeight: geometry.height * scale,
        zIndex: 1,
        height: geometry.height * scale,
        paddingLeft: 0,
        whiteSpace: 'normal',
        textAlign: 'left',
        textDecoration: 'none',
        overflow: 'visible',
      }}
    >
      {geometry.lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 ? '\n' : ''}
          <span
            className="paragraph-line"
            style={{
              position: 'absolute',
              left: (line.x - object.x) * scale,
              top: (geometry.height - (line.y - object.y) - baseline) * scale,
              width: 'max-content',
              height: leading * scale,
              lineHeight: object.lineHeight ?? 1.2,
              whiteSpace: 'pre',
              wordSpacing: line.wordSpacing * scale,
            }}
          >
            {line.text}
          </span>
        </Fragment>
      ))}
      {!originalPixels && (object.underline || object.strike) && (
        <svg
          aria-hidden="true"
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }}
        >
          {geometry.lines.flatMap((line, index) =>
            [
              object.underline ? -object.fontSize * 0.12 : undefined,
              object.strike ? object.fontSize * 0.3 : undefined,
            ].flatMap((offset, decoration) =>
              offset === undefined ? (
                []
              ) : (
                <line
                  key={`${index}-${decoration}`}
                  x1={(line.x - object.x) * scale}
                  x2={(line.x - object.x + line.width) * scale}
                  y1={(geometry.height - (line.y - object.y) - offset) * scale}
                  y2={(geometry.height - (line.y - object.y) - offset) * scale}
                  stroke={object.color}
                  strokeWidth={Math.max(0.5, object.fontSize / 18) * scale}
                />
              ),
            ),
          )}
        </svg>
      )}
    </span>
  );
}
