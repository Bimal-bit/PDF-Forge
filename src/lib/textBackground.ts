export function textBackground(canvas: HTMLCanvasElement, text: HTMLElement): string {
  return sampleTextBackground(canvas, text.getBoundingClientRect(), canvas.getBoundingClientRect());
}

export function sampleTextBackground(
  canvas: HTMLCanvasElement,
  bounds: { left: number; top: number; width: number; height: number },
  sheet = { left: 0, top: 0, width: canvas.width, height: canvas.height },
): string {
  const context = canvas.getContext('2d');
  if (!context) return '#ffffff';
  const scaleX = canvas.width / sheet.width,
    scaleY = canvas.height / sheet.height;
  const colors = new Map<string, number>();
  const sample = (x: number, y: number) => {
    const px = Math.round((x - sheet.left) * scaleX),
      py = Math.round((y - sheet.top) * scaleY);
    if (px < 0 || py < 0 || px >= canvas.width || py >= canvas.height) return;
    const pixel = context.getImageData(px, py, 1, 1).data;
    const color =
      '#' +
      [pixel[0], pixel[1], pixel[2]].map((value) => value.toString(16).padStart(2, '0')).join('');
    colors.set(color, (colors.get(color) ?? 0) + 1);
  };
  for (let index = 0; index <= 24; index += 1) {
    const x = bounds.left + (bounds.width * index) / 24;
    sample(x, bounds.top - 2);
    sample(x, bounds.top + bounds.height + 2);
  }
  return [...colors].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '#ffffff';
}
