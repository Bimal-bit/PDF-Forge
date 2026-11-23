export type RibbonTab = 'File' | 'Home' | 'Insert' | 'Layout' | 'Review' | 'View' | 'Tools';
export type Theme = 'light' | 'dark' | 'contrast';

export interface OpenDocument {
  id: string;
  name: string;
  size: number;
  modifiedAt: number;
  data: ArrayBuffer;
}

export interface LocalFontFace {
  id: string;
  family: string;
  name: string;
  dataUrl: string;
  bold: boolean;
  italic: boolean;
}

export interface SourceTextLayout {
  baselineOffset: number;
  ascent: number;
  horizontalScale: number;
  rotation: number;
  fontFamily: string;
  bold: boolean;
  italic: boolean;
  cssFamily?: string;
  fontFaceId?: string;
  wordSpacing?: number;
  splitItems?: { fontName:string; text:string; x:number; y:number; items:{text:string;x:number;y:number;width:number;size:number;horizontalScale:number;rotation:number}[] };
  underline?: { offset: number; thickness: number };
  strike?: { offset: number; thickness: number };
  fontResource?: { path: string[]; codes: Record<string, { hex: string; width: number }> };
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
  fontFace?: LocalFontFace;
  sourceFontName?: string;
  sourceLayout?: SourceTextLayout;
  cover?: { width: number; height: number; x?: number; y?: number; rotation?: number; color?: string };
  fallback?: boolean;
  width?: number;
  height?: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  alignment?: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  list?: 'none' | 'bullet' | 'number';
  indent?: number;
  style?: 'Body' | 'Heading 1' | 'Heading 2' | 'Heading 3' | 'Caption';
  columns?: 1 | 2 | 3;
  columnGap?: number;
  dropCapLines?: 0 | 2 | 3;
  nextTextId?: string;
  sourceText?: string;
  ocr?: { text: string; appearance: string };
}

export interface TextChange {
  id: string; objectId: string; authors: string[]; at: number; lastAt: number;
  before: string; after: string; removeOnReject: boolean;
  status: 'pending' | 'accepted' | 'rejected';
}

export type TextFormat = Pick<TextObject, 'fontFamily' | 'fontFace' | 'fontSize' | 'color' | 'bold' | 'italic' | 'underline' | 'strike' | 'letterSpacing' | 'alignment' | 'lineHeight' | 'list' | 'indent' | 'style'>;
export type StyleKind = 'paragraph' | 'character';
export interface SavedStyle { id: string; kind: 'style'; name: string; styleKind: StyleKind; format: TextFormat }
export interface SavedSnippet { id: string; kind: 'snippet'; name: string; text: string; format: TextFormat }
export type EditingLibraryEntry = SavedStyle | SavedSnippet;

export interface ShapeObject { id: string; type: 'shape'; page: number; x: number; y: number; width: number; height: number; color: string; shapeKind?: 'rectangle' | 'ellipse' | 'diamond' | 'terminator'; label?: string }
export interface ConnectorObject { id: string; type: 'connector'; page: number; fromId: string; toId: string; color: string; arrow: boolean }
export interface EquationObject { id: string; type: 'equation'; page: number; x: number; y: number; latex: string; fontSize: number; color: string }
export interface ImageObject { id: string; type: 'image'; page: number; x: number; y: number; width: number; height: number; dataUrl: string }
export interface TableObject { id: string; type: 'table'; page: number; x: number; y: number; width: number; height: number; cells: string[][]; headerRow?: boolean; fontFamily?: 'Noto Sans' }
export interface LinkObject { id: string; type: 'link'; page: number; x: number; y: number; label: string; url: string; fontSize: number; fontFamily?: 'Noto Sans' }
export interface FormObject {
  id: string; type: 'form'; kind: 'text' | 'checkbox' | 'signature' | 'radio' | 'dropdown' | 'list' | 'date' | 'button';
  page: number; x: number; y: number; width: number; height: number; label: string; value: string;
  checked?: boolean; options?: string[]; required?: boolean; readOnly?: boolean; multiline?: boolean;
  maxLength?: number; existingName?: string;
}
export interface HighlightAnnotation { id: string; type: 'highlight'; page: number; x: number; y: number; width: number; height: number; color: string; comment: string; author: string; resolved?: boolean }
export interface NoteAnnotation { id: string; type: 'note'; page: number; x: number; y: number; comment: string; author: string; resolved?: boolean }
export interface StampAnnotation { id: string; type: 'stamp'; page: number; x: number; y: number; label: 'APPROVED' | 'DRAFT' | 'CONFIDENTIAL' }
export interface MeasureAnnotation { id: string; type: 'measure'; page: number; x: number; y: number; width: number; height: number; units: 'pt' | 'in' | 'cm' }
export type AnnotationObject = HighlightAnnotation | NoteAnnotation | StampAnnotation | MeasureAnnotation;
export type EditorObject = TextObject | ShapeObject | ConnectorObject | EquationObject | ImageObject | TableObject | LinkObject | FormObject | AnnotationObject;

export interface PageSettings {
  order: number[];
  rotations: Record<number, number>;
  header: string;
  footer: string;
  watermark: string;
  batesStart: number | null;
}

export interface AppSnapshot {
  activeTab: RibbonTab;
  theme: Theme;
  zoom: number;
  leftPanel: 'thumbnails' | 'outline';
  rightPanelOpen: boolean;
  selectedPage: number;
  objects: EditorObject[];
  selectedObjectId?: string;
  pageSettings: PageSettings;
  trackChanges: boolean;
  changeAuthor: string;
  textChanges: TextChange[];
}

export interface RecoveryDocument extends OpenDocument {
  objects?: EditorObject[];
  pageSettings?: PageSettings;
  selectedPage?: number;
  savedAt?: number;
  trackChanges?: boolean;
  changeAuthor?: string;
  textChanges?: TextChange[];
}
