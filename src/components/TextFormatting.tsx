import { Bold, Italic, Strikethrough, Underline } from 'lucide-react';
import type { TextObject } from '../types';
import { AArrowDown, AArrowUp } from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { useTextEditStore } from '../store/useTextEditStore';
import { useSmartTextMatch } from './useSmartTextMatch';
import { EditingLibrary } from './EditingLibrary';
import { FontPicker } from './FontPicker';
import { FormatPainter, HomeQuickTools, HomeSelection, HomeSelectionTools } from './HomeTools';
import { useTextSelectionStore } from '../store/useTextSelectionStore';
import { changeTextCase, type TextCase } from '../lib/homeText';
import { nativeSourceText } from '../lib/textFormatting';
import { FormatNumberInput } from './FormatNumberInput';
import { HomeTextTools } from './HomeTextTools';
import { OcrObjectFontTools } from './OcrObjectFontTools';
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
  const { document, objects, pageSettings, selectedObjectId, updateTextObject, addObject } =
    useAppStore();
  const draft = useTextEditStore((state) => state.draft);
  const selection = useTextSelectionStore();
  const selectedGroup =
    selection.group?.documentId === document?.id &&
    selection.group?.objects === objects &&
    selection.group?.order === pageSettings.order
      ? selection.group
      : undefined;
  const texts = objects.filter(
    (object): object is TextObject =>
      object.type === 'text' &&
      (!pageSettings.order.length || pageSettings.order.includes(object.page)),
  );
  const pendingSource =
    draft &&
    (!pageSettings.order.length || pageSettings.order.includes(draft.page)) &&
    !texts.some((text) => text.id === draft.id) &&
    !selectedObjectId
      ? draft
      : undefined;
  const selected =
    selection.mode === 'select'
      ? selection.busy
        ? undefined
        : selectedGroup?.seed
      : (pendingSource ??
        (selectedObjectId ? texts.find((object) => object.id === selectedObjectId) : texts.at(-1)));
  const { update, match, busy, matchCount } = useSmartTextMatch(selected);
  const sourceLayout = selectedGroup
    ? [
        ...selectedGroup.additions,
        ...objects.filter(
          (object): object is TextObject =>
            object.type === 'text' && selectedGroup.ids.includes(object.id),
        ),
      ].some((object) => nativeSourceText(object, objects))
    : Boolean(selected && nativeSourceText(selected, objects));
  const applyStyle = (style: string) =>
    update({ ...styles[style], style: style as TextObject['style'] });
  const changeCase = (mode: TextCase) => {
    if (!selected) return;
    if (selectedGroup) {
      const targets = [
        ...objects.filter(
          (object): object is TextObject =>
            object.type === 'text' && selectedGroup.ids.includes(object.id),
        ),
        ...selectedGroup.additions,
      ];
      const changes = targets.map((object) => ({
        id: object.id,
        text: changeTextCase(object.text, mode),
      }));
      if (changes.every((change, index) => change.text === targets[index].text)) return;
      useAppStore.getState().replaceTextObjects(changes, selectedGroup.additions);
      const current = useAppStore.getState().objects;
      selection.setGroup({
        ...selectedGroup,
        objects: current,
        additions: [],
        seed: current.find(
          (object): object is TextObject =>
            object.type === 'text' && object.id === selectedGroup.seed.id,
        )!,
        text: changeTextCase(selectedGroup.text, mode),
      });
      return;
    }
    const text = changeTextCase(selected.text, mode);
    if (text === selected.text) return;
    if (objects.some((object) => object.id === selected.id)) updateTextObject(selected.id, text);
    else addObject({ ...selected, text });
    useTextEditStore.getState().setDraft(undefined);
  };

  return (
    <div className="home-toolbar">
      <div className="home-ribbon-scroll" role="region" aria-label="Home commands" tabIndex={0}>
        <div className="format-controls">
          <HomeQuickTools />
          <HomeSelectionTools />
          <HomeTextTools selected={selected} group={selectedGroup} />
          <FormatPainter key={document?.id} selected={selected} update={update} />
          <fieldset
            className="format-group home-font-group"
            aria-label="Font formatting"
            disabled={!selected}
          >
            <div className="format-row">
              <FontPicker selected={selected} update={update} />
              <OcrObjectFontTools selected={selectedGroup ? undefined : selected} />
              <FormatNumberInput
                label="Font size"
                value={selected?.fontSize ?? 12}
                min={6}
                max={144}
                onChange={(fontSize) => update({ fontSize })}
              />
              <button
                className="home-icon-button"
                aria-label="Decrease font size"
                title="Decrease font size by 1 pt"
                disabled={!selected || selected.fontSize <= 6}
                onClick={() =>
                  update({ fontSize: Math.max(6, Math.min(144, (selected?.fontSize ?? 12) - 1)) })
                }
              >
                <AArrowDown size={16} aria-hidden="true" />
              </button>
              <button
                className="home-icon-button"
                aria-label="Increase font size"
                title="Increase font size by 1 pt"
                disabled={!selected || selected.fontSize >= 144}
                onClick={() =>
                  update({ fontSize: Math.max(6, Math.min(144, (selected?.fontSize ?? 12) + 1)) })
                }
              >
                <AArrowUp size={16} aria-hidden="true" />
              </button>
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
              <select
                aria-label="Change text case"
                title="Change the selected block's text case"
                value=""
                onChange={(event) => changeCase(event.target.value as TextCase)}
              >
                <option value="" disabled>
                  Aa · Change case
                </option>
                <option value="sentence">Sentence case</option>
                <option value="lower">lowercase</option>
                <option value="upper">UPPERCASE</option>
                <option value="title">Title Case</option>
              </select>
            </div>
            <span className="ribbon-group-label">Font</span>
          </fieldset>
          <fieldset
            className="format-group"
            aria-label="Paragraph formatting"
            disabled={!selected || sourceLayout}
            title={
              sourceLayout
                ? 'Paragraph layout applies to inserted text boxes. Source runs retain their original placement.'
                : undefined
            }
          >
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
                <FormatNumberInput
                  label="Text indent"
                  value={selected?.indent ?? 0}
                  min={0}
                  max={200}
                  onChange={(indent) => update({ indent })}
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
            <div className="format-row home-style-gallery">
              {['Heading 1', 'Body', 'Caption'].map((style) => (
                <button
                  className="format-style home-style-card"
                  key={style}
                  aria-label={style === 'Heading 1' ? 'Heading' : style}
                  aria-pressed={Boolean(selected) && (selected?.style ?? 'Body') === style}
                  onClick={() => applyStyle(style)}
                >
                  <span aria-hidden="true">Aa</span>
                  <small>{style === 'Heading 1' ? 'Heading' : style}</small>
                </button>
              ))}
            </div>
            <span className="ribbon-group-label">Styles</span>
          </fieldset>
          <fieldset className="format-group" aria-label="Text spacing" disabled={!selected}>
            <label>
              Line spacing
              <FormatNumberInput
                label="Line spacing"
                value={selected?.lineHeight ?? 1.2}
                min={0.8}
                max={4}
                step={0.1}
                onChange={(lineHeight) => update({ lineHeight })}
              />
            </label>
            <label>
              Character spacing
              <FormatNumberInput
                label="Character spacing"
                value={selected?.letterSpacing ?? 0}
                min={-2}
                max={20}
                step={0.1}
                onChange={(letterSpacing) => update({ letterSpacing })}
              />
            </label>
            <span className="ribbon-group-label">Spacing</span>
          </fieldset>
          <fieldset className="format-group" aria-label="Text block settings" disabled={!selected}>
            <label>
              Width
              <FormatNumberInput
                label="Text block width"
                disabled={sourceLayout}
                value={selected?.width ?? selected?.cover?.width ?? 300}
                min={20}
                max={2000}
                onChange={(width) => update({ width })}
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
          <div className="format-group format-library">
            <button
              disabled={!selected || busy || Boolean(selectedGroup)}
              aria-pressed={matchCount !== undefined}
              title="Match the supported font family, bold/italic, and size within 5% or 0.5 pt across current pages"
              onClick={() => void match()}
            >
              {busy
                ? 'Matching…'
                : matchCount === undefined
                  ? 'Smart text match'
                  : `${matchCount} blocks matched`}
            </button>
            <EditingLibrary selected={selected} onApply={update} />
            <span className="ribbon-group-label">Reusable editing</span>
          </div>
        </div>
      </div>
      <HomeSelection
        selected={selected}
        texts={texts}
        draft={draft}
        matchCount={matchCount}
        sourceLayout={sourceLayout}
      />
    </div>
  );
}
