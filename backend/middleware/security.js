// Third-party origins the site actually loads scripts/images/connections
// from — kept minimal on purpose so a Content-Security-Policy can't be
// silently widened by a future copy-paste. Add here (not in code that
// renders untrusted input) if a new integration is added.
const CSP_CONNECT_SRC = ["'self'", 'https://graph.facebook.com'];

function buildCsp() {
  return [
    "default-src 'self'",
    // The inline theme-flash-prevention <script> in index.html and React's
    // own inline styles need 'unsafe-inline' here — a known tradeoff for a
    // no-build-step-CSP-nonce setup; script execution is still restricted
    // to same-origin + inline, blocking third-party script injection.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${CSP_CONNECT_SRC.join(' ')}`,
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

const CSP_HEADER_VALUE = buildCsp();

/** Security headers without extra dependencies */
export function securityHeaders(_req, res, next) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', CSP_HEADER_VALUE);
  res.setHeader('X-DNS-Prefetch-Control', 'off');
  res.removeHeader('X-Powered-By');

  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  next();
}

function getAllowedOrigins() {
  const fromEnv = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const renderUrl = process.env.RENDER_EXTERNAL_URL?.trim();
  return [...new Set([...fromEnv, renderUrl].filter(Boolean))];
}

export function getCorsOptions() {
  if (process.env.NODE_ENV !== 'production') {
    return { origin: true, credentials: true };
  }

  const allowed = getAllowedOrigins();

  return {
    origin(origin, callback) {
      if (!origin || allowed.length === 0 || allowed.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  };
}
