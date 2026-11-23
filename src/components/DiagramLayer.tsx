import { useRef, useState, type PointerEvent } from 'react';
import type { EditorObject, ShapeObject } from '../types';
import { connectorPoints } from '../lib/diagrams';
import { useAppStore } from '../store/useAppStore';

interface Drag {
  id: string;
  x: number;
  y: number;
  pointerX: number;
  pointerY: number;
}

export function DiagramLayer({
  objects,
  width,
  height,
  zoom,
}: {
  objects: EditorObject[];
  width: number;
  height: number;
  zoom: number;
}) {
  const { updateObject, selectObject, selectedObjectId } = useAppStore();
  const drag = useRef<Drag>();
  const [preview, setPreview] = useState<{ id: string; x: number; y: number }>();
  const displayed = objects.map((object) =>
    object.type === 'shape' && object.id === preview?.id
      ? { ...object, x: preview.x, y: preview.y }
      : object,
  );
  const point = (event: PointerEvent<SVGGElement>) => {
    const matrix = event.currentTarget.getScreenCTM();
    return matrix
      ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
      : new DOMPoint();
  };
  const position = (event: PointerEvent<SVGGElement>, object: ShapeObject) => {
    const location = point(event);
    return {
      x: Math.max(
        0,
        Math.min(
          Math.max(0, width - object.width),
          drag.current!.x + location.x - drag.current!.pointerX,
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          Math.max(0, height - object.height),
          drag.current!.y + location.y - drag.current!.pointerY,
        ),
      ),
    };
  };
  return (
    <svg
      className="diagram-layer"
      width={(width * zoom) / 100}
      height={(height * zoom) / 100}
      viewBox={`0 0 ${width} ${height}`}
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    >
      <g transform={`translate(0 ${height}) scale(1 -1)`}>
        {displayed
          .filter((object) => object.type === 'connector')
          .map((object) => {
            const points = connectorPoints(object, displayed);
            return (
              points && (
                <g key={object.id} stroke={object.color} strokeWidth="1.5" fill="none">
                  <path
                    data-connector={object.id}
                    d={`M ${points.start.x} ${points.start.y} L ${points.end.x} ${points.end.y}`}
                  />
                  {object.arrow &&
                    points.arrow.map((end, index) => (
                      <path
                        key={index}
                        d={`M ${points.end.x} ${points.end.y} L ${end.x} ${end.y}`}
                      />
                    ))}
                </g>
              )
            );
          })}
        {displayed
          .filter((object): object is ShapeObject => object.type === 'shape')
          .map((object) => (
            <g
              key={object.id}
              data-editor-object-id={object.id}
              role="button"
              tabIndex={0}
              aria-label={`Move shape ${object.label || object.shapeKind || 'rectangle'}`}
              style={{ pointerEvents: 'auto', cursor: 'move', touchAction: 'none' }}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                selectObject(object.id);
                const location = point(event);
                drag.current = {
                  id: object.id,
                  x: object.x,
                  y: object.y,
                  pointerX: location.x,
                  pointerY: location.y,
                };
                event.currentTarget.setPointerCapture(event.pointerId);
              }}
              onPointerMove={(event) => {
                if (drag.current?.id === object.id)
                  setPreview({ id: object.id, ...position(event, object) });
              }}
              onPointerUp={(event) => {
                if (drag.current?.id !== object.id) return;
                updateObject(object.id, position(event, object));
                drag.current = undefined;
                setPreview(undefined);
              }}
              onPointerCancel={() => {
                drag.current = undefined;
                setPreview(undefined);
              }}
              onKeyDown={(event) => {
                const direction = {
                  ArrowLeft: [-1, 0],
                  ArrowRight: [1, 0],
                  ArrowUp: [0, 1],
                  ArrowDown: [0, -1],
                }[event.key];
                if (!direction) return;
                event.preventDefault();
                selectObject(object.id);
                const step = event.shiftKey ? 10 : 1;
                updateObject(object.id, {
                  x: Math.max(0, object.x + direction[0] * step),
                  y: Math.max(0, object.y + direction[1] * step),
                });
              }}
            >
              {object.shapeKind === 'diamond' ? (
                <path
                  d={`M ${object.x + object.width / 2} ${object.y} L ${object.x + object.width} ${object.y + object.height / 2} L ${object.x + object.width / 2} ${object.y + object.height} L ${object.x} ${object.y + object.height / 2} Z`}
                  stroke={object.color}
                  strokeWidth="2"
                  fill="white"
                />
              ) : object.shapeKind === 'ellipse' || object.shapeKind === 'terminator' ? (
                <ellipse
                  cx={object.x + object.width / 2}
                  cy={object.y + object.height / 2}
                  rx={object.width / 2}
                  ry={object.height / 2}
                  stroke={object.color}
                  strokeWidth="2"
                  fill="white"
                />
              ) : (
                <rect
                  x={object.x}
                  y={object.y}
                  width={object.width}
                  height={object.height}
                  stroke={object.color}
                  strokeWidth="2"
                  fill={object.shapeKind ? 'white' : 'transparent'}
                />
              )}
              {selectedObjectId === object.id && (
                <rect
                  x={object.x - 4}
                  y={object.y - 4}
                  width={object.width + 8}
                  height={object.height + 8}
                  fill="none"
                  stroke="#4f3fd1"
                  strokeDasharray="3 3"
                />
              )}
              {object.label && (
                <text
                  transform={`translate(${object.x + object.width / 2} ${object.y + object.height / 2}) scale(1 -1)`}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontFamily="Helvetica, sans-serif"
                  fontSize={Math.min(
                    12,
                    object.height / 3,
                    (object.width / Math.max(1, object.label.length)) * 1.5,
                  )}
                  fill={object.color}
                >
                  {object.label}
                </text>
              )}
            </g>
          ))}
      </g>
    </svg>
  );
}
