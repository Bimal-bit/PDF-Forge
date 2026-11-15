import { useAppStore } from '../store/useAppStore';
import { parseCsv } from '../lib/forms';
import { formDataEntries } from '../lib/formFields';
import type { FormObject } from '../types';

export function FormDataTools() {
  const { objects, updateObject, setNotice, document } = useAppStore();
  return <label className="insert-image">Import form data<input aria-label="Import form data" type="file" accept=".json,.csv" disabled={!document} onChange={(event) => {
    const file = event.target.files?.[0]; if (!file) return;
    void file.text().then((text) => {
      const data: unknown = file.name.toLowerCase().endsWith('.csv') ? parseCsv(text)[0] : JSON.parse(text);
      if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Choose a form JSON object or a CSV with one data row.');
      let count = 0;
      const fields = objects.filter((object): object is FormObject => object.type === 'form');
      for (const { object, key } of formDataEntries(fields)) {
        const value = (data as Record<string, unknown>)[key];
        if (typeof value !== 'string' && typeof value !== 'boolean' && typeof value !== 'number') continue;
        updateObject(object.id, object.kind === 'checkbox' ? { checked: value === true || value === 'true' || value === '1' || value === 1 } : { value: String(value) });
        count += 1;
      }
      setNotice(`${count} form fields filled from local data.`);
    }).catch((error: unknown) => setNotice(error instanceof Error ? error.message : 'Could not import form data.'));
    event.target.value = '';
  }} /></label>;
}
