import { Focus, Moon, PanelLeft, PanelRight, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useViewStore } from '../store/useViewStore';
import { useCompactWorkspace } from './useCompactWorkspace';
import '../view.css';

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="view-group" role="group" aria-label={label}>
      <div className="view-group-controls">{children}</div>
      <span>{label}</span>
    </div>
  );
}

export function ViewToolbar() {
  const state = useAppStore();
  const view = useViewStore();
  const compact = useCompactWorkspace();
  return (
    <div className="view-toolbar" aria-label="View controls">
      <Group label="Workspace">
        <button
          aria-pressed={compact ? view.mobilePanel === 'pages' : view.navigationOpen}
          disabled={view.readingFocus}
          onClick={compact ? () => view.setMobilePanel(view.mobilePanel === 'pages' ? undefined : 'pages') : view.toggleNavigation}
        >
          <PanelLeft size={15} />
          Navigation
        </button>
        <button
          aria-pressed={compact ? view.mobilePanel === 'properties' : state.rightPanelOpen}
          disabled={view.readingFocus}
          onClick={compact ? () => view.setMobilePanel(view.mobilePanel === 'properties' ? undefined : 'properties') : state.toggleRightPanel}
        >
          <PanelRight size={15} />
          Properties
        </button>
        <button
          aria-pressed={view.searchOpen}
          disabled={view.readingFocus}
          onClick={view.toggleSearch}
        >
          <Search size={15} />
          Document search
        </button>
      </Group>
      <Group label="Reading">
        <button
          aria-pressed={view.readingFocus}
          title="Hide side panels and search. Escape restores your layout."
          onClick={view.toggleFocus}
        >
          <Focus size={15} />
          Reading focus
        </button>
        <button
          aria-pressed={view.inverted}
          title="Invert page colors on screen. Exports keep their original colors."
          onClick={view.toggleInversion}
        >
          <Moon size={15} />
          Night reading
        </button>
      </Group>
    </div>
  );
}
