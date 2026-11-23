import type { TextObject } from '../types';
import { coverStyle, inlineTextStyle } from '../lib/inlineText';
import { useAppStore } from '../store/useAppStore';
import type { CaretPoint } from './InPlaceTextEditor';
import { ParagraphTextView } from './ParagraphTextView';
import { preservesOcrPixels } from '../lib/ocrAppearance';

export function TextObjectView({
  object,
  zoom,
  onEdit,
}: {
  object: TextObject;
  zoom: number;
  onEdit: (object: TextObject, point?: CaretPoint) => void;
}) {
  const pending = useAppStore((state) =>
    state.textChanges.some(
      (change) => change.objectId === object.id && change.status === 'pending',
    ),
  );
  const originalPixels = preservesOcrPixels(object);
  return (
    <div
      className="text-block-object"
      style={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}
    >
      {object.cover && !originalPixels && <span style={{ ...coverStyle(object, zoom), zIndex: 0 }} />}
      {!object.sourceLayout ? (
        <ParagraphTextView object={object} zoom={zoom} pending={pending} onEdit={onEdit} />
      ) : (
        <span
          role="button"
          tabIndex={0}
          aria-label={`Edit text: ${object.text.slice(0, 60)}`}
          title="Click to edit text"
          onClick={(event) => onEdit(object, { x: event.clientX, y: event.clientY })}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onEdit(object);
            }
          }}
          className={pending ? 'text-object tracked-text-object' : 'text-object'}
          data-text-object-id={object.id}
          style={{
            ...inlineTextStyle(object, zoom),
            color: originalPixels ? 'transparent' : object.color,
            zIndex: 1,
            height:
              !object.sourceLayout && object.height ? (object.height * zoom) / 100 : undefined,
            transform: object.sourceLayout
              ? inlineTextStyle(object, zoom).transform
              : object.height || object.cover || object.width
                ? undefined
                : 'translateY(80%)',
          }}
        >
          {object.text}
        </span>
      )}
    </div>
  );
}
