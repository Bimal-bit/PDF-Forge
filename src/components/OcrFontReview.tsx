import { useEffect, useRef, useState } from 'react';
import type { OcrLine } from '../lib/ocrText';
import { fontCatalog } from '../lib/fontCatalog';
import { chooseOcrFont, ocrFontObject } from '../lib/ocrFontChoice';
import { importFontFace, prepareTextFont, textFontCss } from '../lib/textFonts';
import { FormatNumberInput } from './FormatNumberInput';
import type { LocalFontFace } from '../types';

export function OcrFontReview({
  line,
  index,
  disabled,
  onChange,
  onBusy,
}: {
  line: OcrLine;
  index: number;
  disabled: boolean;
  onChange: (patch: Partial<OcrLine>) => void;
  onBusy: (id: string, busy: boolean) => void;
}) {
  const [open, setOpen] = useState(false),
    [loading, setLoading] = useState(false),
    [error, setError] = useState('');
  const [imported, setImported] = useState<LocalFontFace[]>(line.fontFace ? [line.fontFace] : []);
  const canvas = useRef<HTMLCanvasElement>(null),
    samples = useRef<HTMLDivElement>(null),
    current = useRef(line),
    request = useRef(0);
  current.current = line;
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      samples.current?.scrollIntoView({ block: 'nearest' }),
    );
    return () => cancelAnimationFrame(frame);
  }, [open]);
  useEffect(
    () => () => {
      request.current += 1;
      onBusy(line.id, false);
    },
    [line.id, onBusy],
  );
  useEffect(() => {
    if (!open || !canvas.current) return;
    let alive = true;
    void prepareTextFont(ocrFontObject(line))
      .then(() => {
        if (!alive || !canvas.current) return;
        const node = canvas.current,
          scale = line.referenceScale ?? 1;
        const context = node.getContext('2d')!;
        const font = `${line.italic ? 'italic ' : ''}${line.bold ? 'bold ' : ''}`;
        const family = textFontCss(ocrFontObject(line));
        context.font = `${font}${(line.fontSize ?? 12) * scale}px ${family}`;
        context.fontKerning = 'none';
        const metrics = context.measureText(line.text);
        const baseline = 4 + (line.y + line.height - (line.baseline ?? line.y)) * scale;
        const top = Math.min(0, baseline - metrics.actualBoundingBoxAscent - 4);
        const width = Math.max(
            1,
            line.width * scale + 8,
            metrics.width * (line.horizontalScale ?? 1) + 8,
          ),
          height =
            Math.max(line.height * scale + 8, baseline + metrics.actualBoundingBoxDescent + 4) -
            top,
          factor = Math.min(1, 1200 / width, 500 / height);
        node.width = Math.ceil(width * factor);
        node.height = Math.ceil(height * factor);
        context.fillStyle = line.background ?? '#ffffff';
        context.fillRect(0, 0, node.width, node.height);
        context.font = `${font}${(line.fontSize ?? 12) * scale * factor}px ${family}`;
        context.fontKerning = 'none';
        context.fillStyle = line.color ?? '#111111';
        context.translate(4 * factor, (baseline - top) * factor);
        context.scale(line.horizontalScale ?? 1, 1);
        context.fillText(line.text, 0, 0);
      })
      .catch((value: unknown) => {
        if (alive) setError(value instanceof Error ? value.message : 'Font preview failed.');
      });
    return () => {
      alive = false;
    };
  }, [line, open]);
  const choose = async (family: string, bold: boolean, italic: boolean, file?: File) => {
    const ticket = ++request.current;
    setLoading(true);
    setError('');
    onBusy(line.id, true);
    try {
      let face: LocalFontFace | undefined;
      if (file) {
        if (file.size > 20 * 1024 * 1024) throw new Error('Choose a font smaller than 20 MB.');
        face = await importFontFace(new Uint8Array(await file.arrayBuffer()));
        family = face.family;
        bold = face.bold;
        italic = face.italic;
      } else
        face = [current.current.fontFace, ...imported].find(
          (entry) => entry?.family === family && entry.bold === bold && entry.italic === italic,
        );
      const patch = await chooseOcrFont(current.current, family, bold, italic, face);
      if (ticket === request.current) {
        if (file && face) setImported((faces) => [face!, ...faces]);
        onChange(patch);
      }
    } catch (value) {
      if (ticket === request.current)
        setError(value instanceof Error ? value.message : 'Could not load that font.');
    } finally {
      if (ticket === request.current) {
        setLoading(false);
        onBusy(line.id, false);
      }
    }
  };
  return (
    <div className="ocr-font-review">
      <button type="button" aria-expanded={open} disabled={disabled} onClick={() => setOpen(!open)}>
        {open ? 'Hide font comparison' : 'Compare / change font'}
        {index + 1 > 1 ? ` · line ${index + 1}` : ''}
      </button>
      {open && (
        <div className="ocr-font-body">
          <p>
            Compare the image with the actual replacement lettering. Automatic matches can be
            approximate; select another face or import the original font.
          </p>
          <div ref={samples}>
            {line.reference && (
              <figure>
                <figcaption>Original image lettering</figcaption>
                <img src={line.reference} alt={`Original image text on line ${index + 1}`} />
              </figure>
            )}
            <figure>
              <figcaption>Replacement preview</figcaption>
              <canvas ref={canvas} aria-label={`Replacement font preview for line ${index + 1}`} />
            </figure>
          </div>
          {line.fontOptions && (
            <label>
              Suggested matches
              <select
                aria-label={`Suggested OCR fonts ${index + 1}`}
                disabled={disabled || loading}
                value=""
                onChange={(event) => {
                  const option = line.fontOptions![Number(event.target.value)];
                  void choose(option.fontFamily, option.bold, option.italic);
                }}
              >
                <option value="">Choose a suggested match…</option>
                {line.fontOptions.map((option, i) => (
                  <option value={i} key={i}>
                    {option.fontFamily}
                    {option.bold ? ' Bold' : ''}
                    {option.italic ? ' Italic' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            Replacement font
            <select
              aria-label={`OCR font family ${index + 1}`}
              disabled={disabled || loading}
              value={line.fontFamily ?? 'Helvetica'}
              onChange={(event) =>
                void choose(event.target.value, Boolean(line.bold), Boolean(line.italic))
              }
            >
              {['Helvetica', 'Times-Roman', 'Courier'].map((family) => (
                <option key={family}>{family}</option>
              ))}
              {[...new Set(imported.map((face) => face.family))]
                .filter((family) => !fontCatalog.some((font) => font.family === family))
                .map((family) => (
                  <option key={family}>{family}</option>
                ))}
              {fontCatalog.map((font) => (
                <option key={font.id}>{font.family}</option>
              ))}
            </select>
          </label>
          <div className="ocr-font-controls">
            <button
              type="button"
              aria-label={`OCR bold ${index + 1}`}
              aria-pressed={Boolean(line.bold)}
              disabled={disabled || loading}
              onClick={() =>
                void choose(line.fontFamily ?? 'Helvetica', !line.bold, Boolean(line.italic))
              }
            >
              Bold
            </button>
            <button
              type="button"
              aria-label={`OCR italic ${index + 1}`}
              aria-pressed={Boolean(line.italic)}
              disabled={disabled || loading}
              onClick={() =>
                void choose(line.fontFamily ?? 'Helvetica', Boolean(line.bold), !line.italic)
              }
            >
              Italic
            </button>
            <label>
              Size
              <FormatNumberInput
                label={`OCR font size ${index + 1}`}
                value={line.fontSize ?? 12}
                min={1}
                max={200}
                disabled={disabled || loading}
                onChange={(fontSize) => onChange({ fontSize })}
              />
            </label>
            <label>
              Width %
              <FormatNumberInput
                label={`OCR text width ${index + 1}`}
                value={Math.round((line.horizontalScale ?? 1) * 1000) / 10}
                min={10}
                max={500}
                disabled={disabled || loading}
                onChange={(value) => onChange({ horizontalScale: value / 100 })}
              />
            </label>
          </div>
          <label>
            Import original TTF/OTF
            <input
              type="file"
              aria-label={`Import OCR font ${index + 1}`}
              accept=".ttf,.otf"
              disabled={disabled || loading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = '';
                if (file) void choose('', false, false, file);
              }}
            />
          </label>
          {loading && <p role="status">Loading local font…</p>}
          {error && <p role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}
