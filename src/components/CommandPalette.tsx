import { Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../command-palette.css';

export interface PaletteCommand {
  label: string;
  run: () => void;
  disabled?: boolean;
}

export function CommandPalette({ commands, onClose }: {
  commands: PaletteCommand[];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const id = useId();
  const matches = commands.filter((command) =>
    command.label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );
  const available = matches.filter((command) => !command.disabled);
  const selected = available[active] ?? available[0];
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  useEffect(() => {
    dialog.current?.querySelector('[aria-current=true]')?.scrollIntoView({ block: 'nearest' });
  }, [active, query]);
  const close = () => {
    dialog.current?.close();
    onClose();
  };
  const execute = (command?: PaletteCommand) => {
    if (!command || command.disabled) return;
    close();
    command.run();
  };
  return createPortal(
    <dialog
      ref={dialog}
      className="command-palette"
      aria-label="Command palette"
      aria-describedby={`${id}-hint`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      }}
      onKeyDown={(event) => {
        if (event.key === 'Tab') {
          const controls = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled])')].filter((element) => element.tabIndex >= 0);
          const first = controls[0], last = controls.at(-1);
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
          event.preventDefault();
          event.stopPropagation();
          close();
        }
      }}
    >
      <div className="command-heading">
        <strong>Search actions</strong>
        <button aria-label="Close action search" onClick={close}><X size={16} /></button>
      </div>
      <div className="command-search-field">
        <Search size={18} aria-hidden="true" />
        <input
          autoFocus
          aria-label="Search commands"
          aria-controls={`${id}-results`}
          value={query}
          onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              if (available.length) setActive((index) => (index + (event.key === 'ArrowDown' ? 1 : -1) + available.length) % available.length);
            }
            if (event.key === 'Enter') { event.preventDefault(); execute(selected); }
          }}
          placeholder="Find a command…"
        />
      </div>
      <p className="command-result-count" aria-live="polite">
        {matches.length ? `${matches.length} command${matches.length === 1 ? '' : 's'}` : 'No commands found'}
        {selected && <span className="command-announcement">. {selected.label} selected</span>}
      </p>
      <div id={`${id}-results`} className="command-results">
        {matches.map((command) => (
          <button
            key={command.label}
            disabled={command.disabled}
            aria-current={command === selected ? 'true' : undefined}
            tabIndex={command === selected ? 0 : -1}
            onFocus={() => setActive(available.indexOf(command))}
            onClick={() => execute(command)}
          >
            <span>{command.label}</span>
            {command === selected && <kbd aria-hidden="true">↵</kbd>}
          </button>
        ))}
        {!matches.length && <p className="command-empty">Try “text”, “OCR”, “export”, or “accessibility”.</p>}
      </div>
      <p id={`${id}-hint`} className="command-hint">↑ ↓ to choose · Enter to run · Esc to close</p>
    </dialog>,
    document.querySelector('.app')!,
  );
}
