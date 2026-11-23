import type { FormObject } from '../types';
import { formDataEntries } from './formFields';

export interface FormValueChange {
  id: string;
  value?: string;
  checked?: boolean;
}

export function prepareFormValues(fields: FormObject[], data: unknown): FormValueChange[] {
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('Choose a form JSON object or a CSV with one data row.');
  const changes: FormValueChange[] = [];
  for (const { object, key } of formDataEntries(fields)) {
    if (
      !Object.prototype.hasOwnProperty.call(data, key) ||
      object.readOnly ||
      object.kind === 'button'
    )
      continue;
    const raw = (data as Record<string, unknown>)[key];
    if (
      !['string', 'boolean', 'number'].includes(typeof raw) ||
      (typeof raw === 'number' && !Number.isFinite(raw))
    )
      throw new Error(`Invalid value for ${key}. Use text, a number, or a boolean.`);
    if (object.kind === 'checkbox') {
      const text = String(raw).trim().toLowerCase();
      if (!['true', 'false', '1', '0'].includes(text))
        throw new Error(`Use true/false or 1/0 for ${key}.`);
      const checked = text === 'true' || text === '1';
      if (checked !== Boolean(object.checked)) changes.push({ id: object.id, checked });
      continue;
    }
    const value = String(raw);
    if (
      ['dropdown', 'list', 'radio'].includes(object.kind) &&
      value &&
      !object.options?.includes(value)
    )
      throw new Error(
        `Choose an available option for ${key}: ${(object.options ?? []).join(', ')}.`,
      );
    if (object.maxLength && value.length > object.maxLength)
      throw new Error(`${key} allows at most ${object.maxLength} characters.`);
    if (object.kind === 'date' && value) {
      const date = new Date(`${value}T00:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== value
      )
        throw new Error(`Use a valid YYYY-MM-DD date for ${key}.`);
    }
    if (value !== object.value) changes.push({ id: object.id, value });
  }
  return changes;
}
