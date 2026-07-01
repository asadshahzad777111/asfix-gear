const buckets = new Map();
let limiterSeq = 0;

// Without periodic cleanup this Map grows forever as new IPs hit the API
// (real traffic, scanners, or a spoofed-IP flood) — a slow memory-exhaustion
// DoS vector on a long-lived server. Sweep out entries whose own window has
// fully expired; each bucket remembers its limiter's windowMs so a 15-minute
// auth bucket isn't swept early by a 60-second API bucket's cadence.
const SWEEP_INTERVAL_MS = 5 * 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.start > bucket.windowMs) buckets.delete(key);
  }
}, SWEEP_INTERVAL_MS).unref();

function clientKey(req) {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

/**
 * Simple in-memory rate limiter — no extra dependencies.
 *
 * Each call gets its own `limiterId` namespace so separate limiters (login,
 * OTP, general API, etc.) never share buckets for the same client — without
 * this, browsing the site enough to trip the general API limiter would also
 * silently eat into the login limiter's budget for that same visitor,
 * causing confusing false "too many requests" lockouts.
 */
export function rateLimit({ windowMs = 60_000, max = 60, message = 'Too many requests. Try again later.' } = {}) {
  const limiterId = limiterSeq++;

  return (req, res, next) => {
    const key = `${limiterId}:${clientKey(req)}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now - bucket.start >= windowMs) {
      bucket = { start: now, count: 0, windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    if (bucket.count > max) {
      res.setHeader('Retry-After', Math.ceil((bucket.start + windowMs - now) / 1000));
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

export const otpLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 5,
  message: 'Too many verification codes requested. Wait a few minutes.',
});
