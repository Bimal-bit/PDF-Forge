export type RibbonTab = 'File' | 'Home' | 'Insert' | 'Layout' | 'Review' | 'View' | 'Tools';
export type Theme = 'light' | 'dark' | 'contrast';

export interface OpenDocument {
  id: string;
  name: string;
  size: number;
  modifiedAt: number;
  data: ArrayBuffer;
}

export interface TextObject {
  id: string;
  type: 'text';
  page: number;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

export interface AppSnapshot {
  activeTab: RibbonTab;
  theme: Theme;
  zoom: number;
  leftPanel: 'thumbnails' | 'outline';
  rightPanelOpen: boolean;
  selectedPage: number;
  objects: TextObject[];
}
