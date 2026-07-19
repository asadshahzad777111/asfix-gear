import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const EXT_BY_TYPE = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};

let client = null;

export function isR2Configured() {
  return Boolean(
    String(process.env.R2_ACCOUNT_ID || '').trim() &&
      String(process.env.R2_ACCESS_KEY_ID || '').trim() &&
      String(process.env.R2_SECRET_ACCESS_KEY || '').trim() &&
      String(process.env.R2_BUCKET_NAME || '').trim() &&
      String(process.env.R2_PUBLIC_BASE_URL || '').trim()
  );
}

function getClient() {
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured');
  }
  if (!client) {
    client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID.trim()}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID.trim(),
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY.trim(),
      },
    });
  }
  return client;
}

function pickExtension(mimetype, originalName) {
  const fromType = EXT_BY_TYPE[String(mimetype || '').toLowerCase()];
  if (fromType) return fromType;
  const fromName = String(originalName || '').match(/\.(jpe?g|png|webp|gif|mp4|webm|mov)$/i);
  if (fromName) {
    const ext = fromName[1].toLowerCase().replace('jpeg', 'jpg');
    return `.${ext}`;
  }
  return '.jpg';
}

export function buildProductImageKey(originalName, mimetype) {
  return `products/${randomUUID()}${pickExtension(mimetype, originalName)}`;
}

export function buildHeroMediaKey(originalName, mimetype) {
  const folder = String(mimetype || '').startsWith('video/') ? 'hero/videos' : 'hero/images';
  return `${folder}/${randomUUID()}${pickExtension(mimetype, originalName)}`;
}

export async function uploadHeroMedia(buffer, originalName, mimetype) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Empty media file');
  }

  const key = buildHeroMediaKey(originalName, mimetype);
  const bucket = process.env.R2_BUCKET_NAME.trim();
  const publicBase = process.env.R2_PUBLIC_BASE_URL.trim().replace(/\/$/, '');

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return `${publicBase}/${key}`;
}

export function buildPaymentProofKey(originalName, mimetype) {
  return `orders/proofs/${randomUUID()}${pickExtension(mimetype, originalName)}`;
}

export async function uploadProductImage(buffer, originalName, mimetype) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Empty image file');
  }

  const key = buildProductImageKey(originalName, mimetype);
  const bucket = process.env.R2_BUCKET_NAME.trim();
  const publicBase = process.env.R2_PUBLIC_BASE_URL.trim().replace(/\/$/, '');

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype || 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return `${publicBase}/${key}`;
}

export async function uploadPaymentProof(buffer, originalName, mimetype) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Empty image file');
  }

  const key = buildPaymentProofKey(originalName, mimetype);
  const bucket = process.env.R2_BUCKET_NAME.trim();
  const publicBase = process.env.R2_PUBLIC_BASE_URL.trim().replace(/\/$/, '');

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimetype || 'application/octet-stream',
      CacheControl: 'private, max-age=86400',
    })
  );

  return `${publicBase}/${key}`;
}

export function buildAdImageKey(originalName = 'ad.png') {
  return `ads/${randomUUID()}${pickExtension('image/png', originalName)}`;
}

export async function uploadAdPng(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new Error('Empty ad image');
  }
  if (!isR2Configured()) {
    throw new Error('Cloudflare R2 is not configured');
  }

  const key = buildAdImageKey('ad.png');
  const bucket = process.env.R2_BUCKET_NAME.trim();
  const publicBase = process.env.R2_PUBLIC_BASE_URL.trim().replace(/\/$/, '');

  await getClient().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return `${publicBase}/${key}`;
}
