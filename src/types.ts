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
export interface HighlightAnnotation { id: string; type: 'highlight'; page: number; x: number; y: number; width: number; height: number; color: string; comment: string; author: string }
export interface NoteAnnotation { id: string; type: 'note'; page: number; x: number; y: number; comment: string; author: string }
export interface StampAnnotation { id: string; type: 'stamp'; page: number; x: number; y: number; label: 'APPROVED' | 'DRAFT' | 'CONFIDENTIAL' }
export interface MeasureAnnotation { id: string; type: 'measure'; page: number; x: number; y: number; width: number; height: number; units: 'pt' | 'in' | 'cm' }
export type AnnotationObject = HighlightAnnotation | NoteAnnotation | StampAnnotation | MeasureAnnotation;
export type EditorObject = TextObject | ShapeObject | ImageObject | TableObject | LinkObject | AnnotationObject;

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
