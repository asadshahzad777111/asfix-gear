import { Router } from 'express';
import multer from 'multer';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { writeLimiter } from '../middleware/rateLimit.js';
import { generateSocialAd } from '../services/adGenerator.js';
import { isR2Configured, uploadAdPng } from '../services/r2.js';
import { notifyN8nAdCreated } from '../services/n8n.js';

const router = Router();
const STAFF = ['super_admin', 'admin', 'editor'];
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1 },
  fileFilter(_req, file, cb) {
    const ok = /^image\/(jpeg|png|webp|gif)$/i.test(file.mimetype || '');
    cb(ok ? null : new Error('Use JPG, PNG, or WebP image'), ok);
  },
});

router.post(
  '/generate',
  writeLimiter,
  requireAuth,
  requireRole(...STAFF),
  (req, res) => {
    upload.single('image')(req, res, async (err) => {
      if (err) {
        const msg =
          err.code === 'LIMIT_FILE_SIZE'
            ? 'Image too large (max 8MB)'
            : err.message || 'Upload failed';
        return res.status(400).json({ error: msg });
      }

      try {
        if (!req.file?.buffer) {
          return res.status(400).json({ error: 'Image is required' });
        }
        const title = String(req.body?.title || '').trim();
        const priceRaw = String(req.body?.price || '').trim();
        const format = String(req.body?.format || 'square').trim() === 'story' ? 'story' : 'square';
        if (!title) {
          return res.status(400).json({ error: 'Product name / title is required' });
        }

        const price = priceRaw
          ? /^rs\.?\s*/i.test(priceRaw)
            ? priceRaw.replace(/^rs\.?\s*/i, 'Rs ')
            : `Rs ${priceRaw.replace(/^rs\.?\s*/i, '')}`
          : '';

        const ad = await generateSocialAd({
          imageBuffer: req.file.buffer,
          mimeType: req.file.mimetype,
          title,
          price,
          format,
        });

        let imageUrl = null;
        if (isR2Configured()) {
          try {
            imageUrl = await uploadAdPng(ad.png);
          } catch (uploadErr) {
            console.warn('[ads] R2 upload failed:', uploadErr.message);
          }
        }

        if (imageUrl) {
          notifyN8nAdCreated({
            title,
            price,
            format,
            image_url: imageUrl,
            caption: ad.caption,
          });
        }

        res.json({
          title,
          price,
          format,
          width: ad.width,
          height: ad.height,
          caption: ad.caption,
          image_url: imageUrl,
          image_base64: `data:image/png;base64,${ad.png.toString('base64')}`,
          n8n_notified: Boolean(imageUrl),
        });
      } catch (e) {
        console.error('[ads] generate failed:', e);
        res.status(500).json({ error: e.message || 'Could not generate ad' });
      }
    });
  }
);

export default router;
