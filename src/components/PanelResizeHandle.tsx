import { useRef } from 'react';
import { useViewStore } from '../store/useViewStore';

export function PanelResizeHandle({ panel }: { panel: 'navigation' | 'properties' }) {
  const state = useViewStore();
  const width = panel === 'navigation' ? state.navigationWidth : state.propertiesWidth;
  const start = useRef<{ x: number; width: number }>();
  const direction = panel === 'navigation' ? 1 : -1;
  return (
    <div
      className={`panel-resize panel-resize-${panel}`}
      role="separator"
      aria-label={`Resize ${panel} panel`}
      aria-orientation="vertical"
      aria-valuemin={panel === 'navigation' ? 180 : 240}
      aria-valuemax={panel === 'navigation' ? 340 : 440}
      aria-valuenow={width}
      tabIndex={0}
      onPointerDown={(event) => {
        start.current = { x: event.clientX, width };
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();
      }}
      onPointerMove={(event) => {
        if (start.current)
          state.setPanelWidth(
            panel,
            start.current.width + (event.clientX - start.current.x) * direction,
          );
      }}
      onPointerUp={(event) => {
        start.current = undefined;
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onLostPointerCapture={() => {
        start.current = undefined;
      }}
      onDoubleClick={() => state.setPanelWidth(panel, panel === 'navigation' ? 220 : 300)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
          event.preventDefault();
          state.setPanelWidth(panel, width + (event.key === 'ArrowRight' ? 10 : -10) * direction);
        }
        if (event.key === 'Home') {
          event.preventDefault();
          state.setPanelWidth(panel, panel === 'navigation' ? 220 : 300);
        }
      }}
    />
  );
}
