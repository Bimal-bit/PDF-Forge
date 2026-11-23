export async function prepareInsertedImage(file: File) {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size > 20 * 1024 * 1024) throw new Error('Choose an image smaller than 20 MB.');
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error('This image could not be decoded. Choose another PNG, JPEG, or WebP file.');
  }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 16_000_000)
      throw new Error('Images can contain at most 16 million pixels.');
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Image processing is unavailable in this browser.');
    context.drawImage(bitmap, 0, 0);
    const result = {
      dataUrl: canvas.toDataURL('image/png'),
      width: bitmap.width,
      height: bitmap.height,
    };
    canvas.width = canvas.height = 0;
    return result;
  } finally {
    bitmap.close();
  }
}
