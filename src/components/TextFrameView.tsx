import type { TextObject } from '../types';
import type { TextFrameLayout } from '../lib/textFlow';
import { flowLineX } from '../lib/drawTextFlow';
import { useAppStore } from '../store/useAppStore';

export function TextFrameView({
  object,
  layout,
  zoom,
}: {
  object: TextObject;
  layout: TextFrameLayout;
  zoom: number;
}) {
  const { selectedObjectId, selectObject, textChanges } = useAppStore();
  const pending = textChanges.some(
    (change) => change.objectId === object.id && change.status === 'pending',
  );
  const scale = zoom / 100;
  return (
    <div
      className="text-block-object"
      style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}
    >
      {object.cover && (
        <span
          style={{
            position: 'absolute',
            left: ((object.cover.x ?? object.x) - 2) * scale,
            bottom: ((object.cover.y ?? object.y) - 2) * scale,
            width: object.cover.width * scale,
            height: object.cover.height * scale,
            background: 'white',
          }}
        />
      )}
      <svg
        className={`text-object flow-text-object${selectedObjectId === object.id ? ' selected-frame' : ''}${pending ? ' tracked-text-object' : ''}`}
        aria-label={`Text frame ${layout.visibleText.slice(0, 40)}`}
        role="button"
        tabIndex={0}
        onClick={() => selectObject(object.id)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') selectObject(object.id);
        }}
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        style={{
          position: 'absolute',
          left: object.x * scale,
          bottom: object.y * scale,
          width: layout.width * scale,
          height: layout.height * scale,
          overflow: 'visible',
          pointerEvents: 'auto',
          color: object.color,
          fontFamily:
            object.fontFamily === 'Times-Roman'
              ? 'Times New Roman, serif'
              : (object.fontFamily ?? 'Helvetica'),
          fontWeight: object.bold ? 'bold' : 'normal',
          fontStyle: object.italic ? 'italic' : 'normal',
          fontKerning: 'none',
          fontVariantLigatures: 'none',
        }}
      >
        {layout.lines.map((line, index) => (
          <text
            key={index}
            x={flowLineX(object, line)}
            y={line.y}
            fill={object.color}
            fontSize={line.fontSize}
            letterSpacing={object.letterSpacing ?? 0}
            textDecoration={[
              object.underline ? 'underline' : '',
              object.strike ? 'line-through' : '',
            ].join(' ')}
            wordSpacing={
              object.alignment === 'justify' && !line.paragraphEnd && line.text.includes(' ')
                ? Math.max(0, line.available - line.width) / (line.text.split(' ').length - 1)
                : undefined
            }
          >
            {line.text}
          </text>
        ))}
      </svg>
      {layout.overflow && (
        <span
          className="flow-overflow"
          role="img"
          aria-label={`${layout.overflow.length} characters overflow this text story`}
          style={{
            position: 'absolute',
            left: (object.x + layout.width) * scale,
            bottom: object.y * scale,
          }}
        >
          +
        </span>
      )}
    </div>
  );
}
