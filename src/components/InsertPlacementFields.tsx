import type { InsertBounds } from '../lib/insertion';
import { FormatNumberInput } from './FormatNumberInput';

export function InsertPlacementFields({
  bounds,
  x,
  y,
  onChange,
}: {
  bounds: InsertBounds;
  x: number;
  y: number;
  onChange: (point: { x: number; y: number }) => void;
}) {
  return (
    <fieldset className="insert-placement">
      <legend>Position on page (points, from bottom left)</legend>
      <label>
        X{' '}
        <FormatNumberInput
          label="Insert X"
          value={x}
          min={bounds.x}
          max={bounds.x + bounds.width}
          onChange={(next) => onChange({ x: next, y })}
        />
      </label>
      <label>
        Y{' '}
        <FormatNumberInput
          label="Insert Y"
          value={y}
          min={bounds.y}
          max={bounds.y + bounds.height}
          onChange={(next) => onChange({ x, y: next })}
        />
      </label>
    </fieldset>
  );
}
