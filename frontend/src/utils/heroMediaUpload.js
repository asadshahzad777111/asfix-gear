import { api } from '../api/client';
import { compressImageForUpload } from './compressImage';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 20 * 1024 * 1024;
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);

function isVideoFile(file) {
  return VIDEO_TYPES.has(String(file?.type || '').toLowerCase())
    || /\.(mp4|webm|mov)$/i.test(file?.name || '');
}

/**
 * Upload hero image or short video.
 * Returns { url, media_type: 'image' | 'video' }.
 * Does not use capture/camera — caller should omit capture on the file input.
 */
export async function uploadHeroMediaFile(file, { onPreview } = {}) {
  if (!file) throw new Error('No file selected');

  const video = isVideoFile(file);
  if (!video && !file.type?.startsWith('image/')) {
    throw new Error('Sirf image (jpg/png/webp) ya short video (mp4/webm) upload karein.');
  }
  if (video && file.size > MAX_VIDEO_BYTES) {
    throw new Error('Video 20MB se chhoti honi chahiye (short clip).');
  }
  if (!video && file.size > MAX_IMAGE_BYTES) {
    throw new Error('Image 8MB se chhoti honi chahiye.');
  }

  let uploadFile = file;
  if (!video) {
    const compressed = await compressImageForUpload(file);
    if (!compressed) {
      throw new Error('Image bahut bari hai — chhoti file use karein.');
    }
    uploadFile = compressed;
  }

  let blobUrl = null;
  try {
    blobUrl = URL.createObjectURL(uploadFile);
    onPreview?.(blobUrl, video ? 'video' : 'image');

    const result = await api.uploadHeroMedia(uploadFile);
    return {
      url: result.url,
      media_type: result.media_type || (video ? 'video' : 'image'),
    };
  } finally {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
  }
}

export function detectMediaType(url, hint) {
  if (hint === 'video' || hint === 'image') return hint;
  if (/\.(mp4|webm|mov)(\?|#|$)/i.test(String(url || ''))) return 'video';
  return 'image';
}
