import type { AnnotationObject } from '../types';
import { annotationBox, annotationTitle, measurementLabel } from '../lib/annotations';
import { useAppStore } from '../store/useAppStore';

export function AnnotationView({ object, zoom }: { object: AnnotationObject; zoom: number }) {
  const { selectedObjectId, selectObject } = useAppStore();
  const box = annotationBox(object),
    scale = zoom / 100;
  return (
    <svg
      className={`review-mark annotation-${object.type}${selectedObjectId === object.id ? ' selected-review-mark' : ''}`}
      data-editor-object-id={object.id}
      role="button"
      tabIndex={0}
      aria-label={`${object.type}: ${annotationTitle(object)}`}
      viewBox={`0 0 ${box.width} ${box.height}`}
      style={{
        left: box.x * scale,
        bottom: box.y * scale,
        width: box.width * scale,
        height: box.height * scale,
      }}
      onClick={() => selectObject(object.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectObject(object.id);
        }
      }}
    >
      <title>
        {object.type === 'highlight' || object.type === 'note'
          ? `${object.author}: ${object.comment}${object.resolved ? ' (resolved)' : ''}`
          : annotationTitle(object)}
      </title>
      {object.type === 'highlight' && (
        <rect width={box.width} height={box.height} fill={object.color} fillOpacity={0.35} />
      )}
      {object.type === 'note' && (
        <rect width="22" height="22" fill="#ffcc33" stroke="#4d3300" strokeWidth="1" />
      )}
      {object.type === 'stamp' && (
        <>
          <rect x="1" y="1" width="108" height="30" fill="none" stroke="#b33326" strokeWidth="2" />
          <text x="7" y="21" fill="#b33326" fontSize="11" fontFamily="Helvetica, sans-serif">
            {object.label}
          </text>
        </>
      )}
      {object.type === 'measure' && (
        <>
          <line
            x1={object.x - box.x}
            y1={box.height - (object.y - box.y)}
            x2={object.x + object.width - box.x}
            y2={box.height - (object.y + object.height - box.y)}
            stroke="#3373a6"
            strokeWidth="1"
          />
          <text x="1" y="10" fontSize="9" fill="#3373a6" fontFamily="Helvetica, sans-serif">
            {measurementLabel(object)}
          </text>
        </>
      )}
    </svg>
  );
}
