import {
  CalendarDays,
  CheckSquare,
  CircleDot,
  FormInput,
  ImagePlus,
  Link2,
  List,
  ListChecks,
  MousePointer2,
  PenLine,
  Shapes,
  Table2,
  Type,
} from 'lucide-react';
import type { ChangeEvent, ReactNode } from 'react';
import type { FormObject, ShapeObject } from '../types';
import { DiagramTools } from './DiagramTools';
import { EquationTools } from './EquationTools';

const fields: { kind: FormObject['kind']; name: string; label: string; icon: ReactNode }[] = [
  { kind: 'text', name: 'Add text field', label: 'Text field', icon: <FormInput /> },
  { kind: 'checkbox', name: 'Add checkbox', label: 'Checkbox', icon: <CheckSquare /> },
  { kind: 'radio', name: 'Add radio', label: 'Radio', icon: <CircleDot /> },
  { kind: 'dropdown', name: 'Add dropdown', label: 'Dropdown', icon: <ListChecks /> },
  { kind: 'list', name: 'Add list', label: 'List box', icon: <List /> },
  { kind: 'date', name: 'Add date field', label: 'Date field', icon: <CalendarDays /> },
  { kind: 'button', name: 'Add button field', label: 'Reset button', icon: <MousePointer2 /> },
  { kind: 'signature', name: 'Add signature field', label: 'Signature line', icon: <PenLine /> },
];
interface InsertCommandsProps {
  ready: boolean;
  imageBusy: boolean;
  shape: NonNullable<ShapeObject['shapeKind']>;
  onShapeChange: (shape: NonNullable<ShapeObject['shapeKind']>) => void;
  onText: () => void;
  onDate: () => void;
  onImage: (event: ChangeEvent<HTMLInputElement>) => void;
  onDialog: (kind: 'table' | 'link') => void;
  onShape: () => void;
  onField: (kind: FormObject['kind']) => void;
}

export function InsertCommands({
  ready,
  imageBusy,
  shape,
  onShapeChange,
  onText,
  onDate,
  onImage,
  onDialog,
  onShape,
  onField,
}: InsertCommandsProps) {
  return (
    <div className="insert-command-scroll" role="group" aria-label="Insert commands" tabIndex={0}>
      <div className="insert-command-group insert-content-group">
        <button aria-label="Add text overlay" disabled={!ready} onClick={onText}>
          <Type />
          Text box
        </button>
        <label
          className={`insert-image insert-file-button${!ready || imageBusy ? ' disabled' : ''}`}
        >
          <ImagePlus />
          {imageBusy ? 'Reading image…' : 'Image'}
          <input
            aria-label="Add image"
            type="file"
            accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
            disabled={!ready || imageBusy}
            onChange={onImage}
          />
        </label>
        <button
          aria-label="Insert date"
          title="Insert today's date as plain text"
          disabled={!ready}
          onClick={onDate}
        >
          <CalendarDays />
          Today’s date
        </button>
        <span className="insert-group-label">Content</span>
      </div>
      <div className="insert-command-group insert-structure-group">
        <button disabled={!ready} onClick={() => onDialog('table')}>
          <Table2 />
          Add table
        </button>
        <button disabled={!ready} onClick={() => onDialog('link')}>
          <Link2 />
          Add link
        </button>
        <span className="insert-group-label">Tables & links</span>
      </div>
      <div className="insert-command-group insert-visual-group">
        <label className="insert-shape-picker">
          <Shapes />
          <select
            aria-label="Insert shape type"
            value={shape}
            onChange={(event) =>
              onShapeChange(event.target.value as NonNullable<ShapeObject['shapeKind']>)
            }
          >
            <option value="rectangle">Rectangle</option>
            <option value="ellipse">Ellipse</option>
            <option value="diamond">Diamond</option>
            <option value="terminator">Terminator</option>
          </select>
        </label>
        <button disabled={!ready} onClick={onShape}>
          Add shape
        </button>
        <DiagramTools />
        <EquationTools />
        <span className="insert-group-label">Shapes & equations</span>
      </div>
      <div className="insert-command-group insert-fields-group">
        {fields.map((field) => (
          <button
            key={field.kind}
            aria-label={field.name}
            disabled={!ready}
            onClick={() => onField(field.kind)}
          >
            {field.icon}
            {field.label}
          </button>
        ))}
        <span className="insert-group-label">Fillable forms · signature line is visual</span>
      </div>
    </div>
  );
}
