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

export const writeLimiter = rateLimit({
  windowMs: 60_000,
  max: 15,
  message: 'Too many submissions. Please wait a minute.',
});

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
});

// NOTE: auth-specific limiters (login, OTP send, OTP verify for
// register/login/reset) are created individually in backend/routes/auth.js
// via the `rateLimit()` factory above — one instance per route. Do NOT
// reintroduce a single shared "authLimiter" mounted at a parent path
// (e.g. app.use('/api/auth/login', authLimiter)) in server.js: Express's
// app.use() prefix-matches sub-paths (so a mount at '/api/auth/login' also
// runs for '/api/auth/login/otp/start' and '/api/auth/login/otp/verify'),
// and a single limiter instance reused across multiple mounts/routes shares
// one bucket per client IP. That combination previously caused unrelated
// auth actions (password login, OTP send, OTP verify) to silently eat into
// each other's budget — customers behind a shared/mobile-carrier IP could
// get 429'd right when submitting a *correct* 6-digit code, which looked
// like "the page just doesn't move forward" with no obvious cause.
