import type { RenderedSelectionTarget } from './textSelection';

export interface SelectionPoint {
  x: number;
  y: number;
}

export function selectedTargets(
  targets: RenderedSelectionTarget[],
  range: Range,
): RenderedSelectionTarget[] {
  return targets.flatMap((target) => {
    if (!range.intersectsNode(target.element)) return [];
    const contents = document.createRange();
    contents.selectNodeContents(target.element);
    const intersection = range.cloneRange();
    if (contents.compareBoundaryPoints(Range.START_TO_START, range) > 0)
      intersection.setStart(contents.startContainer, contents.startOffset);
    if (contents.compareBoundaryPoints(Range.END_TO_END, range) < 0)
      intersection.setEnd(contents.endContainer, contents.endOffset);
    const text = intersection.toString();
    return text.trim() ? [{ ...target, text }] : [];
  });
}

export function selectBetweenPoints(
  targets: RenderedSelectionTarget[],
  anchor: SelectionPoint,
  focus: SelectionPoint,
) {
  const caret = (point: SelectionPoint) => {
    const closest = targets
      .map(({ element }) => {
        const rect = element.getBoundingClientRect();
        return {
          element,
          rect,
          distance:
            Math.max(rect.left - point.x, 0, point.x - rect.right) +
            Math.max(rect.top - point.y, 0, point.y - rect.bottom) * 5,
        };
      })
      .sort((a, b) => a.distance - b.distance)[0];
    if (!closest) return;
    const { rect, element } = closest;
    const api = document as Document & {
      caretRangeFromPoint?: (x: number, y: number) => Range | null;
    };
    const result = api.caretRangeFromPoint?.(
      Math.max(rect.left + 0.1, Math.min(rect.right - 0.1, point.x)),
      Math.max(rect.top + 0.1, Math.min(rect.bottom - 0.1, point.y)),
    );
    if (result && element.contains(result.startContainer))
      return { node: result.startContainer, offset: result.startOffset };
    const node = element.firstChild;
    return node
      ? { node, offset: point.x > rect.left + rect.width / 2 ? (node.textContent?.length ?? 0) : 0 }
      : undefined;
  };
  const start = caret(anchor),
    end = caret(focus);
  if (start && end)
    window.getSelection()?.setBaseAndExtent(start.node, start.offset, end.node, end.offset);
}
