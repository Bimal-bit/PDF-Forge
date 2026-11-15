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
  fontFamily?: string;
  cover?: { width: number; height: number };
  fallback?: boolean;
}

export interface ShapeObject { id: string; type: 'shape'; page: number; x: number; y: number; width: number; height: number; color: string }
export interface ImageObject { id: string; type: 'image'; page: number; x: number; y: number; width: number; height: number; dataUrl: string }
export interface TableObject { id: string; type: 'table'; page: number; x: number; y: number; width: number; height: number; cells: string[][] }
export interface LinkObject { id: string; type: 'link'; page: number; x: number; y: number; label: string; url: string; fontSize: number }
export type EditorObject = TextObject | ShapeObject | ImageObject | TableObject | LinkObject;

export interface AppSnapshot {
  activeTab: RibbonTab;
  theme: Theme;
  zoom: number;
  leftPanel: 'thumbnails' | 'outline';
  rightPanelOpen: boolean;
  selectedPage: number;
  objects: EditorObject[];
  selectedObjectId?: string;
}
