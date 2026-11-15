import { Bold, Italic, Strikethrough, Underline } from 'lucide-react';
import type { TextObject } from '../types';
import { useAppStore } from '../store/useAppStore';
import { useSmartTextMatch } from './useSmartTextMatch';
import { EditingLibrary } from './EditingLibrary';
import '../ribbon-formatting.css';

const styles: Record<string, Partial<TextObject>> = {
  Body: { fontSize: 12, bold: false, italic: false, lineHeight: 1.2 },
  'Heading 1': { fontSize: 28, bold: true, italic: false },
  'Heading 2': { fontSize: 22, bold: true, italic: false },
  'Heading 3': { fontSize: 16, bold: true, italic: false },
  Caption: { fontSize: 10, bold: false, italic: true },
};
const emphasis = [
  { property: 'bold', icon: Bold },
  { property: 'italic', icon: Italic },
  { property: 'underline', icon: Underline },
  { property: 'strike', icon: Strikethrough },
] as const;

export function TextFormatting() {
  const { objects, pageSettings, selectedObjectId, selectObject } = useAppStore();
  const texts = objects.filter((object): object is TextObject => object.type === 'text' && (!pageSettings.order.length || pageSettings.order.includes(object.page)));
  const selected = texts.find((object) => object.id === selectedObjectId) ?? texts.at(-1);
  const { update, match, busy, matchCount } = useSmartTextMatch(selected);
  const applyStyle = (style: string) =>
    update({ ...styles[style], style: style as TextObject['style'] });

  return (
    <div className="format-controls">
      <div className="format-group format-selection">
        <label>
          Text block
          <select
            aria-label="Text block"
            value={selected?.id ?? ''}
            onChange={(event) => selectObject(event.target.value)}
          >
            <option value="" disabled>
              Select text
            </option>
            {texts.map((text) => (
              <option key={text.id} value={text.id}>
                {text.text.slice(0, 35) || 'Empty text'}
              </option>
            ))}
          </select>
        </label>
        <span className="ribbon-group-label">Selection</span>
      </div>
      <div className="format-group format-library">
        <button disabled={!selected || busy} aria-pressed={matchCount !== undefined} title="Match the supported font family, bold/italic, and size within 5% or 0.5 pt across current pages" onClick={() => void match()}>{busy ? 'Matching…' : matchCount === undefined ? 'Smart text match' : `${matchCount} blocks matched`}</button>
        <EditingLibrary selected={selected} onApply={update} />
        <span className="ribbon-group-label">Reusable editing</span>
      </div>
      <fieldset className="format-group" aria-label="Font formatting" disabled={!selected}>
        <div className="format-row">
          <select
            aria-label="Font family"
            value={selected?.fontFamily ?? 'Helvetica'}
            onChange={(event) => update({ fontFamily: event.target.value, fallback: false })}
          >
            <option>Helvetica</option>
            <option value="Times-Roman">Times</option>
            <option>Courier</option>
          </select>
          <input
            aria-label="Font size"
            title="Font size"
            type="number"
            min="6"
            max="144"
            value={selected?.fontSize ?? 12}
            onChange={(event) =>
              update({ fontSize: Math.max(6, Math.min(144, Number(event.target.value) || 12)) })
            }
          />
        </div>
        <div className="format-row format-emphasis">
          {emphasis.map(({ property, icon: Icon }) => (
            <button
              key={property}
              aria-label={property}
              title={property}
              aria-pressed={selected?.[property] ?? false}
              onClick={() => update({ [property]: !selected?.[property] })}
            >
              <Icon size={16} aria-hidden="true" />
            </button>
          ))}
          <input
            aria-label="Text color"
            title="Text color"
            type="color"
            value={selected?.color ?? '#000000'}
            onChange={(event) => update({ color: event.target.value })}
          />
        </div>
        <span className="ribbon-group-label">Font</span>
      </fieldset>
      <fieldset className="format-group" aria-label="Paragraph formatting" disabled={!selected}>
        <div className="format-row">
          <label>
            Align
            <select
              aria-label="Text alignment"
              value={selected?.alignment ?? 'left'}
              onChange={(event) =>
                update({ alignment: event.target.value as TextObject['alignment'] })
              }
            >
              {['left', 'center', 'right', 'justify'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            List
            <select
              aria-label="List style"
              value={selected?.list ?? 'none'}
              onChange={(event) => update({ list: event.target.value as TextObject['list'] })}
            >
              <option value="none">None</option>
              <option value="bullet">Bullets</option>
              <option value="number">Numbered</option>
            </select>
          </label>
        </div>
        <div className="format-row">
          <label>
            Indent
            <input
              aria-label="Text indent"
              type="number"
              min="0"
              max="200"
              value={selected?.indent ?? 0}
              onChange={(event) => update({ indent: Number(event.target.value) || 0 })}
            />
          </label>
        </div>
        <span className="ribbon-group-label">Paragraph</span>
      </fieldset>
      <fieldset
        className="format-group format-styles"
        aria-label="Text styles"
        disabled={!selected}
      >
        <select
          aria-label="Text style"
          value={selected?.style ?? 'Body'}
          onChange={(event) => applyStyle(event.target.value)}
        >
          {Object.keys(styles).map((style) => (
            <option key={style}>{style}</option>
          ))}
        </select>
        <div className="format-row">
          {['Heading 1', 'Body', 'Caption'].map((style) => (
            <button
              className="format-style"
              key={style}
              aria-pressed={selected?.style === style}
              onClick={() => applyStyle(style)}
            >
              {style === 'Heading 1' ? 'Heading' : style}
            </button>
          ))}
        </div>
        <span className="ribbon-group-label">Styles</span>
      </fieldset>
      <fieldset className="format-group" aria-label="Text spacing" disabled={!selected}>
        <label>
          Line spacing
          <input
            aria-label="Line spacing"
            type="number"
            min=".8"
            max="4"
            step=".1"
            value={selected?.lineHeight ?? 1.2}
            onChange={(event) => update({ lineHeight: Number(event.target.value) || 1.2 })}
          />
        </label>
        <label>
          Character spacing
          <input
            aria-label="Character spacing"
            type="number"
            min="-2"
            max="20"
            step=".1"
            value={selected?.letterSpacing ?? 0}
            onChange={(event) => update({ letterSpacing: Number(event.target.value) || 0 })}
          />
        </label>
        <span className="ribbon-group-label">Spacing</span>
      </fieldset>
      <fieldset className="format-group" aria-label="Text block settings" disabled={!selected}>
        <label>
          Width
          <input
            aria-label="Text block width"
            type="number"
            min="20"
            max="2000"
            value={selected?.width ?? selected?.cover?.width ?? 300}
            onChange={(event) => update({ width: Math.max(20, Number(event.target.value) || 300) })}
          />
        </label>
        <button
          onClick={() =>
            update({
              bold: false,
              italic: false,
              underline: false,
              strike: false,
              alignment: 'left',
              letterSpacing: 0,
              lineHeight: 1.2,
              list: 'none',
              indent: 0,
              style: 'Body',
              fontSize: 12,
              color: '#292724',
            })
          }
        >
          Clear formatting
        </button>
        <span className="ribbon-group-label">Text block</span>
      </fieldset>
    </div>
  );
}
