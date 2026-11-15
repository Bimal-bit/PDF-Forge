import type { EquationLayout } from '../lib/equations';

export function EquationView({
  layout,
  color = '#292724',
  responsive = true,
}: {
  layout: EquationLayout;
  color?: string;
  responsive?: boolean;
}) {
  return (
    <svg
      width={layout.width}
      height={layout.ascent + layout.descent}
      viewBox={`0 0 ${layout.width} ${layout.ascent + layout.descent}`}
      aria-label="Equation preview"
      role="img"
      style={{ display: 'block', maxWidth: responsive ? '100%' : undefined, overflow: 'visible' }}
    >
      {layout.glyphs.map((glyph, index) => (
        <text
          key={index}
          x={glyph.x}
          y={layout.ascent - glyph.y}
          fontSize={glyph.size}
          fontFamily={glyph.font === 'Symbol' ? 'Symbol, serif' : 'Times New Roman, serif'}
          fontStyle={glyph.font === 'Times-Italic' ? 'italic' : 'normal'}
          fill={color}
        >
          {glyph.text}
        </text>
      ))}
      {layout.rules.map((rule, index) => (
        <line
          key={index}
          x1={rule.x1}
          x2={rule.x2}
          y1={layout.ascent - rule.y1}
          y2={layout.ascent - rule.y2}
          stroke={color}
          strokeWidth={rule.thickness}
        />
      ))}
    </svg>
  );
}
