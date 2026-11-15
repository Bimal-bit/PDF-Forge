import { rgb } from 'pdf-lib';

export function pdfColor(value: string) {
  const hex = value.replace('#', '');
  const expanded =
    hex.length === 3
      ? hex
          .split('')
          .map((part) => part + part)
          .join('')
      : hex;
  const parsed = Number.parseInt(expanded, 16);
  return rgb(((parsed >> 16) & 255) / 255, ((parsed >> 8) & 255) / 255, (parsed & 255) / 255);
}
