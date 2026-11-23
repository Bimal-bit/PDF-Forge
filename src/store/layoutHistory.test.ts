import { beforeEach, expect, it } from 'vitest';
import { useAppStore } from './useAppStore';

beforeEach(() => {
  useAppStore
    .getState()
    .setDocument({
      id: 'layout',
      name: 'layout.pdf',
      data: new ArrayBuffer(0),
      size: 0,
      modifiedAt: 0,
    });
  useAppStore.getState().initializePages(2);
  useAppStore
    .getState()
    .addObject({
      id: 'a',
      type: 'shape',
      page: 1,
      x: 20,
      y: 30,
      width: 80,
      height: 40,
      color: '#000000',
    });
  useAppStore
    .getState()
    .addObject({
      id: 'b',
      type: 'shape',
      page: 1,
      x: 130,
      y: 150,
      width: 80,
      height: 40,
      color: '#000000',
    });
});
it('positions a whole selection in one undo/redo transaction and rejects invalid batches atomically', () => {
  const before = useAppStore.getState(),
    history = before.history.length;
  before.positionObjects([
    { id: 'a', x: 40, y: 50 },
    { id: 'b', x: 40, y: 150 },
  ]);
  expect(useAppStore.getState().history.length).toBe(history + 1);
  useAppStore.getState().undo();
  expect(useAppStore.getState().objects).toEqual(before.objects);
  useAppStore.getState().redo();
  expect(useAppStore.getState().objects[0]).toMatchObject({ x: 40, y: 50 });
  const valid = useAppStore.getState();
  expect(() =>
    valid.positionObjects([
      { id: 'a', x: 90, y: 90 },
      { id: 'missing', x: 50, y: 50 },
    ]),
  ).toThrow('existing');
  expect(useAppStore.getState().objects).toBe(valid.objects);
  expect(useAppStore.getState().history).toBe(valid.history);
});
it('rotates left and right on the current source page after reordering', () => {
  const state = useAppStore.getState();
  state.movePage(1);
  state.rotatePage(-1);
  expect(useAppStore.getState().pageSettings.rotations).toEqual({ 1: 270 });
  useAppStore.getState().rotatePage();
  expect(useAppStore.getState().pageSettings.rotations[1]).toBe(0);
  useAppStore.getState().undo();
  expect(useAppStore.getState().pageSettings.rotations[1]).toBe(270);
});
