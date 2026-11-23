export function revealTextObject(id: string | undefined, page: number) {
  if (!id) return;
  requestAnimationFrame(() => {
    const sheet = document.querySelector<HTMLElement>(`.pdf-page[data-page-number="${page}"]`);
    const target = [...(sheet?.querySelectorAll<HTMLElement>('[data-text-object-id], [data-editor-object-id]') ?? [])].find(
      (element) => element.dataset.textObjectId === id || element.dataset.editorObjectId === id,
    );
    const viewport = sheet?.closest<HTMLElement>('.canvas');
    if (!target || !viewport) return;
    const bounds = target.getBoundingClientRect(),
      visible = viewport.getBoundingClientRect();
    if (bounds.bottom > visible.bottom - 24)
      viewport.scrollTop += bounds.bottom - visible.bottom + 24;
    else if (bounds.top < visible.top + 32) viewport.scrollTop += bounds.top - visible.top - 32;
  });
}
