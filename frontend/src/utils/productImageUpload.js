import { api } from '../api/client';
import { compressImageForUpload } from './compressImage';

const MAX_INLINE_IMAGE_BYTES = 120 * 1024;

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('File read nahi ho saki'));
    reader.readAsDataURL(file);
  });
}

export async function uploadProductImageFile(file, { onPreview } = {}) {
  if (!file?.type?.startsWith('image/')) {
    throw new Error('Sirf image files upload karein.');
  }
  if (file.size > 8 * 1024 * 1024) {
    throw new Error('Image 8MB se chhoti honi chahiye.');
  }

  const compressed = await compressImageForUpload(file);
  if (!compressed) {
    throw new Error('Image bahut bari hai — chhoti file use karein.');
  }

  let blobUrl = null;
  try {
    blobUrl = URL.createObjectURL(compressed);
    onPreview?.(blobUrl);

    try {
      const { url } = await api.uploadProductImage(compressed);
      return url;
    } catch (uploadErr) {
      if (compressed.size <= MAX_INLINE_IMAGE_BYTES) {
        return readFileAsDataUrl(compressed);
      }
      throw uploadErr;
    }
  } finally {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }
}
