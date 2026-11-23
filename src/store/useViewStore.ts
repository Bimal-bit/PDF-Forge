import { create } from 'zustand';

export type ZoomMode = 'custom' | 'width' | 'page';

interface ViewState {
  ocrOpen: boolean;
  ocrEditable: boolean;
  mobileToolsOpen: boolean;
  mobilePanel?: 'pages' | 'properties';
  setMobilePanel: (panel?: 'pages' | 'properties') => void;
  zoomMode: ZoomMode;
  navigationOpen: boolean;
  searchOpen: boolean;
  readingFocus: boolean;
  inverted: boolean;
  searchFocusRequest: number;
  navigationWidth: number;
  propertiesWidth: number;
  setPanelWidth: (panel: 'navigation' | 'properties', width: number) => void;
  setZoomMode: (mode: ZoomMode) => void;
  toggleNavigation: () => void;
  toggleSearch: () => void;
  toggleFocus: () => void;
  toggleInversion: () => void;
  openSearch: () => void;
}

// Viewing preferences last for this app session and never alter document bytes.
export const useViewStore = create<ViewState>((set) => ({
  ocrOpen: false,
  ocrEditable: false,
  mobileToolsOpen: true,
  mobilePanel: undefined,
  setMobilePanel: (mobilePanel) => set(mobilePanel ? { mobilePanel, readingFocus: false } : { mobilePanel }),
  zoomMode: 'custom', navigationOpen: true, searchOpen: true, readingFocus: false, inverted: false, searchFocusRequest: 0, navigationWidth: 220, propertiesWidth: 300,
  setPanelWidth: (panel, width) => { if (Number.isFinite(width)) set(panel === 'navigation' ? { navigationWidth: Math.max(180, Math.min(340, width)) } : { propertiesWidth: Math.max(240, Math.min(440, width)) }); },
  setZoomMode: (zoomMode) => set({ zoomMode }),
  toggleNavigation: () => set((state) => ({ navigationOpen: !state.navigationOpen })),
  toggleSearch: () => set((state) => ({ searchOpen: !state.searchOpen })),
  toggleFocus: () => set((state) => ({ readingFocus: !state.readingFocus })),
  toggleInversion: () => set((state) => ({ inverted: !state.inverted })),
  openSearch: () => set((state) => ({ searchOpen: true, readingFocus: false, searchFocusRequest: state.searchFocusRequest + 1 })),
}));
