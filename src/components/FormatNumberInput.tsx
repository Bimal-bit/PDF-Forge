import { useEffect, useRef, useState } from 'react';

export function FormatNumberInput({
  label,
  value,
  min,
  max,
  step = 'any',
  disabled,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number | 'any';
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const dirty = useRef(false);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => {
    if (document.activeElement !== input.current) {
      setDraft(String(value));
      dirty.current = false;
    }
  }, [value]);
  const commit = (raw: string) => {
    if (!dirty.current) return;
    const number = raw.trim() ? Number(raw) : value;
    const next = Math.max(min, Math.min(max, Number.isFinite(number) ? number : value));
    setDraft(String(next));
    dirty.current = false;
    if (next !== value) onChange(next);
  };
  return (
    <input
      ref={input}
      aria-label={label}
      title={label}
      type="number"
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      value={draft}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        dirty.current = true;
        const number = raw.trim() ? Number(raw) : NaN;
        if (Number.isFinite(number) && number >= min && number <= max && number !== value)
          onChange(number);
      }}
      onBlur={(event) => commit(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          commit(event.currentTarget.value);
        }
        if (event.key === 'Escape') {
          if (dirty.current && draft !== String(value)) event.preventDefault();
          setDraft(String(value));
          dirty.current = false;
        }
      }}
    />
  );
}
