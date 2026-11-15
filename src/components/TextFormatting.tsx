import type { TextObject } from '../types';
import { useAppStore } from '../store/useAppStore';

const styles: Record<string, Partial<TextObject>> = {
  Body: { fontSize: 12, bold: false, italic: false, lineHeight: 1.2 },
  'Heading 1': { fontSize: 28, bold: true, italic: false },
  'Heading 2': { fontSize: 22, bold: true, italic: false },
  'Heading 3': { fontSize: 16, bold: true, italic: false },
  Caption: { fontSize: 10, bold: false, italic: true },
};

export function TextFormatting() {
  const { objects, selectedObjectId, selectObject, updateObject } = useAppStore();
  const texts = objects.filter((object): object is TextObject => object.type === 'text');
  const selected = texts.find((object) => object.id === selectedObjectId) ?? texts.at(-1);
  const update = (patch: Partial<TextObject>) => { if (selected) updateObject(selected.id, patch); };
  return <div className="format-controls">
    <label>Text block<select aria-label="Text block" value={selected?.id ?? ''} onChange={(event) => selectObject(event.target.value)}><option value="" disabled>Select text</option>{texts.map((text) => <option key={text.id} value={text.id}>{text.text.slice(0, 35) || 'Empty text'}</option>)}</select></label>
    <fieldset disabled={!selected}>
      <label>Font<select aria-label="Font family" value={selected?.fontFamily ?? 'Helvetica'} onChange={(event) => update({ fontFamily: event.target.value, fallback: false })}><option>Helvetica</option><option value="Times-Roman">Times</option><option>Courier</option></select></label>
      <label>Size<input aria-label="Font size" type="number" min="6" max="144" value={selected?.fontSize ?? 12} onChange={(event) => update({ fontSize: Math.max(6, Math.min(144, Number(event.target.value) || 12)) })} /></label>
      {(['bold', 'italic', 'underline', 'strike'] as const).map((property) => <button key={property} aria-label={property} aria-pressed={selected?.[property] ?? false} onClick={() => update({ [property]: !selected?.[property] })}>{property}</button>)}
      <label>Color<input aria-label="Text color" type="color" value={selected?.color ?? '#000000'} onChange={(event) => update({ color: event.target.value })} /></label>
      <label>Align<select aria-label="Text alignment" value={selected?.alignment ?? 'left'} onChange={(event) => update({ alignment: event.target.value as TextObject['alignment'] })}>{['left', 'center', 'right', 'justify'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label>Style<select aria-label="Text style" value={selected?.style ?? 'Body'} onChange={(event) => update({ ...styles[event.target.value], style: event.target.value as TextObject['style'] })}>{Object.keys(styles).map((style) => <option key={style}>{style}</option>)}</select></label>
      <label>Width<input aria-label="Text block width" type="number" min="20" max="2000" value={selected?.width ?? selected?.cover?.width ?? 300} onChange={(event) => update({ width: Math.max(20, Number(event.target.value) || 300) })} /></label>
      <label>Line spacing<input aria-label="Line spacing" type="number" min=".8" max="4" step=".1" value={selected?.lineHeight ?? 1.2} onChange={(event) => update({ lineHeight: Number(event.target.value) || 1.2 })} /></label>
      <label>Character spacing<input aria-label="Character spacing" type="number" min="-2" max="20" step=".1" value={selected?.letterSpacing ?? 0} onChange={(event) => update({ letterSpacing: Number(event.target.value) || 0 })} /></label>
      <label>List<select aria-label="List style" value={selected?.list ?? 'none'} onChange={(event) => update({ list: event.target.value as TextObject['list'] })}><option value="none">None</option><option value="bullet">Bullets</option><option value="number">Numbered</option></select></label>
      <label>Indent<input aria-label="Text indent" type="number" min="0" max="200" value={selected?.indent ?? 0} onChange={(event) => update({ indent: Number(event.target.value) || 0 })} /></label>
      <button onClick={() => update({ bold: false, italic: false, underline: false, strike: false, alignment: 'left', letterSpacing: 0, lineHeight: 1.2, list: 'none', indent: 0, style: 'Body', fontSize: 12, color: '#292724' })}>Clear formatting</button>
    </fieldset>
  </div>;
}
