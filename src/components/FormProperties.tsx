import type { FormObject } from '../types';
import { useAppStore } from '../store/useAppStore';

export function FormProperties({ object }: { object: FormObject }) {
  const updateObject = useAppStore((state) => state.updateObject);
  const update = (patch: Partial<FormObject>) => updateObject(object.id, patch);
  return <>
    {['radio', 'dropdown', 'list'].includes(object.kind) && <>
      <label>Options<textarea aria-label="Field options" value={(object.options ?? []).join('\n')} disabled={!!object.existingName} onChange={(event) => update({ options: event.target.value.split('\n').filter(Boolean) })} /></label>
      <label>Selected value<select aria-label="Selected field value" value={object.value} onChange={(event) => update({ value: event.target.value })}><option value="">Choose</option>{object.options?.map((option) => <option key={option}>{option}</option>)}</select></label>
    </>}
    {object.kind === 'date' && <label>Date<input aria-label="Field date" type="date" value={object.value} onChange={(event) => update({ value: event.target.value })} /></label>}
    <label><input aria-label="Required field" type="checkbox" checked={!!object.required} onChange={(event) => update({ required: event.target.checked })} />Required</label>
    <label><input aria-label="Read only field" type="checkbox" checked={!!object.readOnly} onChange={(event) => update({ readOnly: event.target.checked })} />Read only</label>
    {object.kind === 'text' && <><label><input aria-label="Multiline field" type="checkbox" checked={!!object.multiline} onChange={(event) => update({ multiline: event.target.checked })} />Multiline</label><label>Maximum characters<input aria-label="Field maximum length" type="number" min="1" value={object.maxLength ?? ''} onChange={(event) => update({ maxLength: Number(event.target.value) || undefined })} /></label></>}
    {(['x', 'y', 'width', 'height'] as const).map((property) => <label key={property}>{property}<input aria-label={`Field ${property}`} type="number" disabled={!!object.existingName} value={object[property]} onChange={(event) => update({ [property]: Number(event.target.value) || 0 })} /></label>)}
  </>;
}
