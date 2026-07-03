import { isStorageReady } from '../store.js';

/** Return 503 immediately when MongoDB is still connecting — avoids blocking the event loop via runSync(). */
export function requireStorageReady(req, res, next) {
  const ready = isStorageReady();
  if (ready == null || ready === false) {
    return res.status(503).json({
      error: 'Database is starting — wait 30 seconds and try again.',
      code: 'STORAGE_STARTING',
    });
  }
  next();
}
