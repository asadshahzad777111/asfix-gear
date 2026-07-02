/** Shrink photos for JSON storage or R2 — keeps under backend data-URL limit. */
export async function compressImageForUpload(file, maxBytes = 120 * 1024) {
  if (!file.type.startsWith('image/')) {
    throw new Error('Sirf image files');
  }
  if (file.type === 'image/gif') {
    return file.size <= maxBytes ? file : null;
  }
  if (file.size <= maxBytes) return file;

  const bitmap = await createImageBitmap(file);
  const maxDim = 1400;
  let { width, height } = bitmap;
  if (width > maxDim || height > maxDim) {
    if (width >= height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const mimeTypes = ['image/webp', 'image/jpeg'];
  let smallest = null;

  for (const mime of mimeTypes) {
    for (let quality = 0.88; quality >= 0.45; quality -= 0.08) {
      const blob = await canvasToBlob(canvas, mime, quality);
      if (!blob) continue;
      if (blob.size <= maxBytes) {
        return blobToFile(blob, file.name, mime);
      }
      if (!smallest || blob.size < smallest.size) smallest = blob;
    }
  }

  if (smallest) return blobToFile(smallest, file.name, 'image/jpeg');
  return null;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

function blobToFile(blob, originalName, mime) {
  const ext = mime === 'image/webp' ? '.webp' : '.jpg';
  const base = String(originalName || 'photo').replace(/\.[^.]+$/, '');
  return new File([blob], `${base}${ext}`, { type: mime });
}
