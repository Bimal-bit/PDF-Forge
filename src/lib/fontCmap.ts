// Replace an sfnt cmap without changing glyph outlines or metrics. PDF renderers
// often remap embedded subset fonts to private-use characters for display.
export function replaceFontCmap(bytes: Uint8Array, glyphs: Map<number, number>): Uint8Array {
  const input = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = input.getUint16(4);
  const tables = new Map<string, Uint8Array>();
  for (let index = 0; index < count; index += 1) {
    const entry = 12 + index * 16;
    const tag = String.fromCharCode(...bytes.subarray(entry, entry + 4));
    const offset = input.getUint32(entry + 8);
    const length = input.getUint32(entry + 12);
    tables.set(tag, bytes.slice(offset, offset + length));
  }
  const mappings = [...glyphs]
    .filter(([point, glyph]) => point >= 0 && point <= 0x10ffff && glyph > 0)
    .sort((left, right) => left[0] - right[0]);
  const cmap = new Uint8Array(28 + mappings.length * 12);
  const mapView = new DataView(cmap.buffer);
  mapView.setUint16(2, 1);
  mapView.setUint16(4, 3);
  mapView.setUint16(6, 10);
  mapView.setUint32(8, 12);
  mapView.setUint16(12, 12);
  mapView.setUint32(16, cmap.length - 12);
  mapView.setUint32(24, mappings.length);
  mappings.forEach(([point, glyph], index) => {
    const offset = 28 + index * 12;
    mapView.setUint32(offset, point);
    mapView.setUint32(offset + 4, point);
    mapView.setUint32(offset + 8, glyph);
  });
  tables.set('cmap', cmap);
  const head = tables.get('head');
  if (head) new DataView(head.buffer).setUint32(8, 0);
  const aligned = (size: number) => Math.ceil(size / 4) * 4;
  const size =
    12 +
    tables.size * 16 +
    [...tables.values()].reduce((sum, table) => sum + aligned(table.length), 0);
  const result = new Uint8Array(size);
  const output = new DataView(result.buffer);
  result.set(bytes.subarray(0, 4));
  output.setUint16(4, tables.size);
  const power = Math.floor(Math.log2(tables.size));
  output.setUint16(6, 16 * 2 ** power);
  output.setUint16(8, power);
  output.setUint16(10, tables.size * 16 - 16 * 2 ** power);
  let offset = 12 + tables.size * 16;
  let headOffset = 0;
  [...tables]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .forEach(([tag, table], index) => {
      const entry = 12 + index * 16;
      result.set(
        Array.from(tag, (character) => character.charCodeAt(0)),
        entry,
      );
      result.set(table, offset);
      output.setUint32(
        entry + 4,
        checksum(result.subarray(offset, offset + aligned(table.length))),
      );
      output.setUint32(entry + 8, offset);
      output.setUint32(entry + 12, table.length);
      if (tag === 'head') headOffset = offset;
      offset += aligned(table.length);
    });
  if (headOffset) output.setUint32(headOffset + 8, (0xb1b0afba - checksum(result)) >>> 0);
  return result;
}

function checksum(bytes: Uint8Array): number {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let sum = 0;
  for (let index = 0; index + 4 <= bytes.length; index += 4)
    sum = (sum + view.getUint32(index)) >>> 0;
  return sum;
}
