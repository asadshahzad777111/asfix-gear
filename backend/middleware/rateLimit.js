const buckets = new Map();

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/** Simple in-memory rate limiter — no extra dependencies */
export function rateLimit({ windowMs = 60_000, max = 60, message = 'Too many requests. Try again later.' } = {}) {
  return (req, res, next) => {
    const key = clientKey(req);
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      return res.status(429).json({ error: message });
    }

    return next();
  };
}

/** Stricter limits for auth / public write endpoints */
export const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 20,
  message: 'Too many login attempts. Wait a few minutes.',
});

export const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  message: 'Too many submissions. Please wait a minute.',
});

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
});
