import type { TextFormat, TextObject } from '../types';
import { fontCatalog } from '../lib/fontCatalog';
import { importFontFace, prepareTextFont } from '../lib/textFonts';
import { useAppStore } from '../store/useAppStore';
import { useTextSelectionStore } from '../store/useTextSelectionStore';
import { useTextEditStore } from '../store/useTextEditStore';

export function FontPicker({
  selected,
  update,
}: {
  selected?: TextObject;
  update: (patch: Partial<TextFormat> & { fallback?: boolean }) => void;
}) {
  const { objects, setNotice } = useAppStore();
  const faces = [selected, ...objects].flatMap((object) =>
    object?.type === 'text' && object.fontFace ? [object.fontFace] : [],
  );
  const sourceFamilies = [selected, ...objects].flatMap((object) =>
    object?.type === 'text' && object.sourceLayout?.fontResource && object.fontFamily
      ? [object.fontFamily]
      : [],
  );
  const customFamilies = [
    ...new Set([...faces.map((face) => face.family), ...sourceFamilies]),
  ].filter(
    (family) =>
      !fontCatalog.some((font) => font.family === family) &&
      !['Helvetica', 'Times-Roman', 'Courier'].includes(family),
  );
  return (
    <>
      <select
        aria-label="Font family"
        value={selected?.fontFamily ?? 'Helvetica'}
        onChange={(event) => {
          const family = event.target.value;
          const face = faces.find(
            (entry) =>
              entry.family === family &&
              entry.bold === Boolean(selected?.bold) &&
              entry.italic === Boolean(selected?.italic),
          );
          update({ fontFamily: family, fontFace: face, fallback: false });
        }}
      >
        <optgroup label="PDF standard fonts">
          <option>Helvetica</option>
          <option value="Times-Roman">Times</option>
          <option>Courier</option>
        </optgroup>
        {customFamilies.length > 0 && (
          <optgroup label="Document and imported fonts">
            {customFamilies.map((family) => (
              <option key={family}>{family}</option>
            ))}
          </optgroup>
        )}
        <optgroup label="100 bundled font families">
          {fontCatalog.map((font) => (
            <option key={font.id}>{font.family}</option>
          ))}
        </optgroup>
      </select>
      <label
        className="import-font-control"
        title="Load an exact matching TTF or OTF font from your device"
      >
        Import font
        <input
          aria-label="Import matching font"
          type="file"
          accept=".ttf,.otf"
          disabled={!selected}
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (!file || !selected) return;
            const documentId = useAppStore.getState().document?.id;
            const selectedGroup = useTextSelectionStore.getState().group;
            void file
              .arrayBuffer()
              .then(async (buffer) => {
                const face = await importFontFace(new Uint8Array(buffer));
                const patch = {
                  fontFamily: face.family,
                  fontFace: face,
                  bold: face.bold,
                  italic: face.italic,
                  fallback: false,
                };
                await prepareTextFont({ ...selected, ...patch });
                const current = useAppStore.getState();
                const currentId =
                  current.selectedObjectId ??
                  useTextEditStore.getState().draft?.id ??
                  current.objects.filter((object) => object.type === 'text').at(-1)?.id;
                if (
                  current.document?.id !== documentId ||
                  (selectedGroup
                    ? useTextSelectionStore.getState().group !== selectedGroup
                    : currentId !== selected.id)
                ) {
                  setNotice(
                    'The selection changed while loading the font. Select the text and import again.',
                  );
                  return;
                }
                update(patch);
              })
              .catch((error: unknown) =>
                setNotice(
                  error instanceof Error ? error.message : 'Could not read that font file.',
                ),
              );
          }}
        />
      </label>
    </>
  );
}
