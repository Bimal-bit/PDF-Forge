import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import '../advanced-editing.css';

export function EditorDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return createPortal(
    <dialog ref={dialog} className="advanced-editor" aria-label={title} onClose={onClose}>
      <div className="advanced-heading">
        <h2>{title}</h2>
        <button aria-label={`Close ${title}`} onClick={() => dialog.current?.close()}>
          Close
        </button>
      </div>
      {children}
    </dialog>,
    document.querySelector('.app')!,
  );
}
