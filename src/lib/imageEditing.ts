export interface ImageEdits {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  mask: 'none' | 'ellipse' | 'rounded';
  brightness: number;
  contrast: number;
  removeBackground: boolean;
  background: string;
  tolerance: number;
}

export const defaultImageEdits: ImageEdits = {
  left: 0,
  top: 0,
  width: 100,
  height: 100,
  rotation: 0,
  mask: 'none',
  brightness: 0,
  contrast: 0,
  removeBackground: false,
  background: '#ffffff',
  tolerance: 24,
};

export function adjustImagePixels(data: Uint8ClampedArray, brightness: number, contrast: number) {
  const amount = Math.max(-100, Math.min(100, contrast));
  const factor = (259 * (amount + 255)) / (255 * (259 - amount));
  const offset = Math.max(-100, Math.min(100, brightness)) * 2.55;
  for (let index = 0; index < data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1)
      data[index + channel] = factor * (data[index + channel] - 128) + 128 + offset;
  }
}

export function removeEdgeBackground(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  color: string,
  tolerance: number,
) {
  const target = (color.match(/[a-f\d]{2}/gi) ?? ['ff', 'ff', 'ff']).map((part) =>
    parseInt(part, 16),
  );
  const visited = new Uint8Array(width * height);
  const queue = new Uint32Array(width * height);
  let first = 0;
  let last = 0;
  const enqueue = (pixel: number) => {
    if (visited[pixel]) return;
    visited[pixel] = 1;
    queue[last++] = pixel;
  };
  for (let x = 0; x < width; x += 1) {
    enqueue(x);
    enqueue((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    enqueue(y * width);
    enqueue(y * width + width - 1);
  }
  while (first < last) {
    const pixel = queue[first++];
    const index = pixel * 4;
    if (
      data[index + 3] &&
      target.some((value, channel) => Math.abs(data[index + channel] - value) > tolerance)
    )
      continue;
    data[index + 3] = 0;
    const x = pixel % width;
    const y = Math.floor(pixel / width);
    if (x) enqueue(pixel - 1);
    if (x < width - 1) enqueue(pixel + 1);
    if (y) enqueue(pixel - width);
    if (y < height - 1) enqueue(pixel + width);
  }
}

export async function editImage(dataUrl: string, edits: ImageEdits) {
  const bitmap = await createImageBitmap(await fetch(dataUrl).then((response) => response.blob()));
  try {
    if (bitmap.width * bitmap.height > 16_000_000)
      throw new Error('Image editing supports up to 16 million pixels per image.');
    const sx = Math.min(
      bitmap.width - 1,
      Math.round((bitmap.width * Math.max(0, Math.min(99, edits.left))) / 100),
    );
    const sy = Math.min(
      bitmap.height - 1,
      Math.round((bitmap.height * Math.max(0, Math.min(99, edits.top))) / 100),
    );
    const sw = Math.max(
      1,
      Math.min(
        bitmap.width - sx,
        Math.round((bitmap.width * Math.max(1, Math.min(100, edits.width))) / 100),
      ),
    );
    const sh = Math.max(
      1,
      Math.min(
        bitmap.height - sy,
        Math.round((bitmap.height * Math.max(1, Math.min(100, edits.height))) / 100),
      ),
    );
    const rotated = edits.rotation === 90 || edits.rotation === 270;
    const canvas = document.createElement('canvas');
    canvas.width = rotated ? sh : sw;
    canvas.height = rotated ? sw : sh;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('This browser could not create an image editing canvas.');
    context.save();
    context.translate(canvas.width / 2, canvas.height / 2);
    context.rotate((edits.rotation * Math.PI) / 180);
    context.drawImage(bitmap, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh);
    context.restore();
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    if (edits.removeBackground)
      removeEdgeBackground(
        pixels.data,
        canvas.width,
        canvas.height,
        edits.background,
        Math.max(0, Math.min(255, edits.tolerance)),
      );
    adjustImagePixels(pixels.data, edits.brightness, edits.contrast);
    context.putImageData(pixels, 0, 0);
    if (edits.mask !== 'none') {
      context.globalCompositeOperation = 'destination-in';
      context.beginPath();
      if (edits.mask === 'ellipse')
        context.ellipse(
          canvas.width / 2,
          canvas.height / 2,
          canvas.width / 2,
          canvas.height / 2,
          0,
          0,
          Math.PI * 2,
        );
      else
        context.roundRect(
          0,
          0,
          canvas.width,
          canvas.height,
          Math.min(canvas.width, canvas.height) * 0.15,
        );
      context.fill();
    }
    return {
      dataUrl: canvas.toDataURL('image/png'),
      widthRatio: sw / bitmap.width,
      heightRatio: sh / bitmap.height,
      rotated,
    };
  } finally {
    bitmap.close();
  }
}
