import { expect, it } from 'vitest';
import { formData } from './formFields';
import type { FormObject } from '../types';

it('exports both values when form fields share a display label', () => {
  const base: FormObject = { id: 'first', type: 'form', kind: 'text', page: 1, x: 0, y: 0, width: 100, height: 20, label: 'Field', value: 'First value' };
  expect(formData([base, { ...base, id: 'second', value: 'Second value' }])).toEqual({ 'Field#first': 'First value', 'Field#second': 'Second value' });
});
