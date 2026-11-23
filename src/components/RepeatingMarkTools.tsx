import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../store/useAppStore';

export function RepeatingMarkTools({ disabled }: { disabled: boolean }) {
  const { pageSettings, updatePageSettings } = useAppStore();
  const [bates, setBates] = useState(String(pageSettings.batesStart ?? ''));
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (document.activeElement !== input.current) setBates(String(pageSettings.batesStart ?? ''));
  }, [pageSettings.batesStart]);
  const commit = () => {
    const number = bates.trim() ? Number(bates) : NaN;
    const value = Number.isFinite(number)
      ? Math.max(0, Math.min(999999999, Math.trunc(number)))
      : null;
    setBates(String(value ?? ''));
    if (value !== pageSettings.batesStart) updatePageSettings({ batesStart: value });
  };
  return (
    <>
      {(['header', 'footer', 'watermark'] as const).map((key) => (
        <label className="tools-field" key={key}>
          {key[0].toUpperCase() + key.slice(1)}
          <input
            aria-label={key[0].toUpperCase() + key.slice(1)}
            value={pageSettings[key]}
            disabled={disabled}
            placeholder={key === 'watermark' ? 'Optional' : 'Use {page}'}
            onChange={(event) => updatePageSettings({ [key]: event.target.value })}
          />
        </label>
      ))}
      <label className="tools-field">
        Bates start
        <input
          ref={input}
          aria-label="Bates start"
          type="number"
          min="0"
          max="999999999"
          step="1"
          disabled={disabled}
          value={bates}
          placeholder="Off"
          onChange={(event) => {
            const raw = event.target.value;
            setBates(raw);
            const number = raw.trim() ? Number(raw) : null;
            if (number === null || (Number.isInteger(number) && number >= 0 && number <= 999999999))
              updatePageSettings({ batesStart: number });
          }}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              setBates(String(pageSettings.batesStart ?? ''));
            }
          }}
        />
      </label>
    </>
  );
}
