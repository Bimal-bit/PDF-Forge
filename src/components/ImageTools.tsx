import { useEffect, useState } from 'react';
import { EditorDialog } from './EditorDialog';
import { useAppStore } from '../store/useAppStore';
import { defaultImageEdits, editImage, type ImageEdits } from '../lib/imageEditing';
import type { ImageObject } from '../types';

export function ImageTools() {
  const { document, objects, selectedObjectId, pageSettings, selectObject, updateObject } =
    useAppStore();
  const images = objects.filter(
    (object): object is ImageObject =>
      object.type === 'image' && pageSettings.order.includes(object.page),
  );
  const selected = images.find((object) => object.id === selectedObjectId) ?? images.at(-1);
  const [open, setOpen] = useState(false);
  const [edits, setEdits] = useState(defaultImageEdits);
  const [preview, setPreview] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    setPreview(undefined);
  }, [edits, selected?.id, selected?.dataUrl]);
  const change = (patch: Partial<ImageEdits>) => setEdits((current) => ({ ...current, ...patch }));
  const run = async (apply: boolean) => {
    if (!selected || !document || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await editImage(selected.dataUrl, edits);
      const current = useAppStore.getState();
      if (
        current.document !== document ||
        current.objects.find((object) => object.id === selected.id) !== selected
      ) {
        setMessage('The image changed during editing. Preview again to use its current content.');
        return;
      }
      if (apply) {
        const width = selected.width * result.widthRatio;
        const height = selected.height * result.heightRatio;
        updateObject(selected.id, {
          dataUrl: result.dataUrl,
          width: result.rotated ? height : width,
          height: result.rotated ? width : height,
        });
        setEdits(defaultImageEdits);
        setMessage('Image edits applied. Undo restores the previous image.');
      } else {
        setPreview(result.dataUrl);
        setMessage('Preview ready. Apply to update the document.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not edit this image.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <button disabled={!document} onClick={() => setOpen(true)}>
        Image tools
      </button>
      {open && (
        <EditorDialog title="Image tools" onClose={() => setOpen(false)}>
          <label>
            Inserted image
            <select
              aria-label="Image to edit"
              disabled={busy}
              value={selected?.id ?? ''}
              onChange={(event) => {
                selectObject(event.target.value);
                setEdits(defaultImageEdits);
                setMessage('');
              }}
            >
              <option value="" disabled>
                Insert a PNG or JPEG first
              </option>
              {images.map((object, index) => (
                <option key={object.id} value={object.id}>
                  Image {index + 1} · page {pageSettings.order.indexOf(object.page) + 1}
                </option>
              ))}
            </select>
          </label>
          {selected && (
            <>
              <img
                className="image-edit-preview"
                src={preview ?? selected.dataUrl}
                alt={preview ? 'Edited image preview' : 'Current inserted image'}
                style={{
                  display: 'block',
                  maxWidth: '100%',
                  maxHeight: 220,
                  margin: '12px auto',
                  background: 'repeating-conic-gradient(#ddd 0% 25%, #fff 0% 50%) 0 0 / 16px 16px',
                }}
              />
              <fieldset disabled={busy} className="image-edit-options">
                <legend>Crop and appearance</legend>
                <div className="advanced-grid">
                  {(['left', 'top', 'width', 'height'] as const).map((property) => (
                    <label key={property}>
                      Crop {property} (%)
                      <input
                        aria-label={`Crop ${property}`}
                        type="number"
                        min={property === 'width' || property === 'height' ? 1 : 0}
                        max="100"
                        value={edits[property]}
                        onChange={(event) =>
                          change({
                            [property]: Math.max(
                              property === 'width' || property === 'height' ? 1 : 0,
                              Math.min(100, Number(event.target.value) || 0),
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <div className="advanced-grid">
                  <label>
                    Rotate
                    <select
                      aria-label="Image rotation"
                      value={edits.rotation}
                      onChange={(event) =>
                        change({ rotation: Number(event.target.value) as ImageEdits['rotation'] })
                      }
                    >
                      {[0, 90, 180, 270].map((value) => (
                        <option key={value} value={value}>
                          {value}° clockwise
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Mask
                    <select
                      aria-label="Image mask"
                      value={edits.mask}
                      onChange={(event) =>
                        change({ mask: event.target.value as ImageEdits['mask'] })
                      }
                    >
                      <option value="none">None</option>
                      <option value="ellipse">Ellipse</option>
                      <option value="rounded">Rounded rectangle</option>
                    </select>
                  </label>
                </div>
                <div className="advanced-grid">
                  {(['brightness', 'contrast'] as const).map((property) => (
                    <label key={property}>
                      {property}
                      <input
                        aria-label={`Image ${property}`}
                        type="number"
                        min="-100"
                        max="100"
                        value={edits[property]}
                        onChange={(event) =>
                          change({
                            [property]: Math.max(
                              -100,
                              Math.min(100, Number(event.target.value) || 0),
                            ),
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                <label className="advanced-checkbox">
                  <input
                    aria-label="Remove background"
                    type="checkbox"
                    checked={edits.removeBackground}
                    onChange={(event) => change({ removeBackground: event.target.checked })}
                  />
                  Remove matching background connected to image edges
                </label>
                {edits.removeBackground && (
                  <div className="advanced-grid">
                    <label>
                      Background color
                      <input
                        aria-label="Background color"
                        type="color"
                        value={edits.background}
                        onChange={(event) => change({ background: event.target.value })}
                      />
                    </label>
                    <label>
                      Tolerance
                      <input
                        aria-label="Background tolerance"
                        type="number"
                        min="0"
                        max="255"
                        value={edits.tolerance}
                        onChange={(event) =>
                          change({
                            tolerance: Math.max(0, Math.min(255, Number(event.target.value) || 0)),
                          })
                        }
                      />
                    </label>
                  </div>
                )}
              </fieldset>
              <div className="advanced-grid">
                <button disabled={busy} onClick={() => void run(false)}>
                  Preview image edits
                </button>
                <button disabled={busy} onClick={() => void run(true)}>
                  Apply image edits
                </button>
              </div>
            </>
          )}
          <p role="status">{busy ? 'Processing image locally…' : message}</p>
          <p className="editing-help">
            Edits produce a PNG with transparency. Background removal follows a chosen color from
            the image edges and works best with uniform backgrounds.
          </p>
        </EditorDialog>
      )}
    </>
  );
}
