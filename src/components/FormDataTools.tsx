import { useAppStore } from '../store/useAppStore';
import { parseCsv } from '../lib/forms';
import { prepareFormValues } from '../lib/formImport';
import type { FormObject } from '../types';
import type { ToolRunner } from './useToolRunner';

export function FormDataTools({ runner }: { runner: ToolRunner }) {
  const { document, objects, pageSettings } = useAppStore();
  const available = objects.some(
    (object) =>
      object.type === 'form' &&
      !object.readOnly &&
      object.kind !== 'button' &&
      pageSettings.order.includes(object.page),
  );
  return (
    <label className={`tools-file${!available || runner.busy ? ' disabled' : ''}`}>
      Import form data
      <input
        aria-label="Import form data"
        type="file"
        accept=".json,.csv"
        disabled={!document || !available || Boolean(runner.busy)}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (!file) return;
          void runner.run(
            'Importing form data',
            async (snapshot) => {
              if (file.size > 1024 * 1024)
                throw new Error('Form data files must be 1 MB or smaller.');
              const text = (await file.text()).replace(/^\uFEFF/, '');
              let data: unknown;
              if (file.name.toLowerCase().endsWith('.csv')) {
                const rows = parseCsv(text);
                if (rows.length !== 1)
                  throw new Error('Choose a form CSV with exactly one data row.');
                data = rows[0];
              } else data = JSON.parse(text);
              const fields = snapshot.objects.filter(
                (object): object is FormObject =>
                  object.type === 'form' && snapshot.pageSettings.order.includes(object.page),
              );
              return prepareFormValues(fields, data);
            },
            (changes) => {
              const state = useAppStore.getState();
              state.applyFormValues(changes);
              state.setNotice(
                changes.length
                  ? `${changes.length} form fields filled from local data.`
                  : 'No editable form values changed. Check the field names in your data.',
              );
            },
          );
        }}
      />
    </label>
  );
}
