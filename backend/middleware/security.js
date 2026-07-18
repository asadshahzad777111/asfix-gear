// Third-party origins the site actually loads scripts/images/connections
// from — kept minimal on purpose so a Content-Security-Policy can't be
// silently widened by a future copy-paste. Add here (not in code that
// renders untrusted input) if a new integration is added.
const CSP_CONNECT_SRC = [
  "'self'",
  'https://graph.facebook.com',
  'https://translate.googleapis.com',
  'https://accounts.google.com',
  // Split deploy: Vercel UI may still be served from Render during cutover,
  // or a production-built SPA may call the Render API host directly.
  'https://asfix-gear.onrender.com',
];
// The optional "translate this page" widget (GoogleTranslateWidget.jsx)
// injects its own script + a same-page iframe from these Google origins —
// without them the widget silently does nothing (blocked, no console
// crash), which looked like a working feature but never actually was one.
const CSP_SCRIPT_SRC = ["'self'", "'unsafe-inline'", 'https://translate.google.com', 'https://translate.googleapis.com', 'https://accounts.google.com'];
// Contact / location embed uses maps.google.com; translate widget uses translate.google.com.
const CSP_FRAME_SRC = ["'self'", 'https://translate.google.com', 'https://maps.google.com', 'https://www.google.com', 'https://accounts.google.com'];
const CSP_STYLE_SRC = ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://www.gstatic.com'];

function buildCsp() {
  return [
    "default-src 'self'",
    // The inline theme-flash-prevention <script> in index.html and React's
    // own inline styles need 'unsafe-inline' here — a known tradeoff for a
    // no-build-step-CSP-nonce setup; script execution is still restricted
    // to same-origin + inline + the one explicitly allow-listed integration.
    `script-src ${CSP_SCRIPT_SRC.join(' ')}`,
    `style-src ${CSP_STYLE_SRC.join(' ')}`,
    "img-src 'self' data: https: blob:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${CSP_CONNECT_SRC.join(' ')}`,
    `frame-src ${CSP_FRAME_SRC.join(' ')}`,
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
  const defaults = [
    'https://asfixgear.com',
    'https://www.asfixgear.com',
    'https://asadshahzad777111.github.io',
  ];
  const fromEnv = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const renderUrl = process.env.RENDER_EXTERNAL_URL?.trim();
  return [...new Set([...defaults, ...fromEnv, renderUrl].filter(Boolean))];
}

/** Vercel production + preview deploy hosts (https://*.vercel.app). */
function isVercelAppOrigin(origin) {
  try {
    const { protocol, hostname } = new URL(origin);
    return (
      protocol === 'https:' &&
      (hostname === 'vercel.app' || hostname.endsWith('.vercel.app'))
    );
  } catch {
    return false;
  }
}

function isAllowedOrigin(origin, allowed) {
  if (!origin) return true;
  if (allowed.length === 0 || allowed.includes(origin)) return true;
  return isVercelAppOrigin(origin);
}

export function getCorsOptions() {
  if (process.env.NODE_ENV !== 'production') {
    return { origin: true, credentials: true };
  }

  const allowed = getAllowedOrigins();

  return {
    origin(origin, callback) {
      if (isAllowedOrigin(origin, allowed)) {
        callback(null, true);
        return;
      }
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
  };
}
