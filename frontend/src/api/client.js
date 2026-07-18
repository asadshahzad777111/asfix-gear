// Vercel/Pages builds often omit VITE_API_BASE — fall back to the public Render API
// in production so /api is not rewritten to index.html on the static host.
const API_BASE = String(
  import.meta.env.VITE_API_BASE
  || (import.meta.env.PROD ? 'https://asfix-gear.onrender.com/api' : '/api')
).replace(/\/$/, '');
const TOKEN_KEY = 'asfix_auth_token';
const DEFAULT_TIMEOUT_MS = 8000;
/** OTP send hits Gmail SMTP on the server — can take 15–40s on Render cold start. */
const OTP_SEND_TIMEOUT_MS = 45000;
/** Public catalog GETs on Render free tier — cold wake can exceed 8s. */
const COLD_START_TIMEOUT_MS = 45000;
const OTP_SEND_PATHS = [
  '/auth/register/start',
  '/auth/login/otp/start',
  '/auth/password/reset/start',
];
/** Staff/customer login + session check — Render cold wake often exceeds 8s. */
const AUTH_COLD_PATHS = ['/auth/login', '/auth/me'];
const COLD_START_GET_PREFIXES = ['/products', '/shop/status', '/ping'];

const COLD_START_MSG =
  'Server start ho raha hai — 30–60 sec wait karein aur refresh karein. / Server is waking up — wait 30–60 seconds and refresh.';

function isAuthCold(path, method) {
  const m = (method || 'GET').toUpperCase();
  if (m === 'POST' && path === '/auth/login') return true;
  if (m === 'GET' && path === '/auth/me') return true;
  return AUTH_COLD_PATHS.some((p) => path === p || path.startsWith(`${p}?`));
}

/** Best-effort wake for Render free tier — retries until /health reports ready or timeout. */
export async function ensureApiReady(maxWaitMs = 90000) {
  const started = Date.now();
  let lastErr = null;

  while (Date.now() - started < maxWaitMs) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.status === 'ok' && data.ready) {
        return true;
      }
      lastErr = new Error(data.error || COLD_START_MSG);
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, 2500));
  }

  throw lastErr instanceof Error && lastErr.message ? lastErr : new Error(COLD_START_MSG);
}

export async function wakeApiServer() {
  try {
    await ensureApiReady(90000);
  } catch {
    /* login/register will surface a clear message */
  }
}

function isColdStartGet(path, method) {
  const m = (method || 'GET').toUpperCase();
  if (m !== 'GET') return false;
  return COLD_START_GET_PREFIXES.some((p) => path === p || path.startsWith(`${p}?`) || path.startsWith(`${p}/`));
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const isOtpSend = OTP_SEND_PATHS.some((otpPath) => path.startsWith(otpPath));
  const isColdStart = isColdStartGet(path, options.method);
  const isAuthColdPath = isAuthCold(path, options.method);
  const timeoutMs =
    options.timeoutMs ??
    (isOtpSend || isAuthColdPath
      ? OTP_SEND_TIMEOUT_MS
      : isColdStart
        ? COLD_START_TIMEOUT_MS
        : DEFAULT_TIMEOUT_MS);
  const { timeoutMs: _ignored, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers,
      signal: controller.signal,
      ...fetchOptions,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error(
        isOtpSend
          ? 'Verification code bhejne mein waqt lag gaya. Dubara try karein — agar phir fail ho to Gmail app password ya WhatsApp settings check karein.'
          : isColdStart || isAuthColdPath
            ? COLD_START_MSG
            : 'Request timed out. Please try again.'
      );
    }
    if (err?.message?.includes('Failed to fetch') || err?.message?.includes('NetworkError')) {
      throw new Error('Network error — internet ya server check karein aur dubara try karein.');
    }
    throw new Error('Backend server is not running. Start it with: npm run dev (port 5000)');
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // SPA hosts (Vercel/Pages) often return 200 HTML for unknown /api/*
      // when VITE_API_BASE is missing — never treat that as a JSON body.
      throw new Error(
        res.status === 502 || res.status === 503 || res.status === 504
          ? 'Backend server is not running. Start it with: npm run dev (port 5000)'
          : text.trimStart().startsWith('<')
            ? 'API base misconfigured — set VITE_API_BASE to the Render API URL (e.g. https://asfix-gear.onrender.com/api).'
            : 'Something went wrong'
      );
    }
  }

  if (!res.ok) {
    const message = data.error || (res.status === 404
      ? 'No account found with this Gmail or phone'
      : res.status === 503
        ? data.code === 'STORAGE_STARTING' || isColdStart || isAuthColdPath
          ? COLD_START_MSG
          : 'Verification service temporarily unavailable. Please try again.'
        : 'Something went wrong');
    const error = new Error(message);
    error.status = res.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

async function uploadProductImage(file, { timeoutMs = 45000 } = {}) {
  const token = getAuthToken();
  if (!token) throw new Error('Staff login required to upload images');

  const form = new FormData();
  form.append('image', file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${API_BASE}/products/upload-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Image upload timed out. Try a smaller file or check your connection.');
    }
    throw new Error('Network error — could not upload image.');
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON */
    }
  }

  if (!res.ok) {
    if (res.status === 503) {
      throw new Error('Server par R2 abhi configure nahi hai');
    }
    if (res.status === 404) {
      throw new Error('Upload route server par nahi hai — latest code deploy karein');
    }
    throw new Error(data.error || 'Image upload failed');
  }
  if (!data.url) throw new Error('Upload succeeded but no URL was returned');
  return data;
}

async function uploadOrderPaymentProof(orderId, file, { timeoutMs = 45000 } = {}) {
  const token = getAuthToken();
  if (!token) throw new Error('Sign in required to upload payment proof');

  const form = new FormData();
  form.append('image', file);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(`${API_BASE}/orders/${orderId}/payment-proof`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Upload timed out. Try a smaller screenshot.');
    }
    throw new Error('Network error — could not upload payment proof.');
  } finally {
    clearTimeout(timeoutId);
  }

  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      /* non-JSON */
    }
  }

  if (!res.ok) {
    throw new Error(data.error || 'Payment proof upload failed');
  }
  return data;
}

async function downloadDataBackup() {
  const token = getAuthToken();
  if (!token) throw new Error('Authentication required');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);

  let res;
  try {
    res = await fetch(`${API_BASE}/admin/export-data`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Backup download timed out. Please try again.');
    }
    throw new Error('Network error — could not download backup.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const text = await res.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        /* non-JSON error body */
      }
    }
    throw new Error(data.error || 'Export failed');
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition');
  let filename = 'asfix-backup.json';
  const match = disposition?.match(/filename="([^"]+)"/);
  if (match) filename = match[1];

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export const api = {
  login: async (body) => {
    await ensureApiReady(90000);
    return request('/auth/login', { method: 'POST', body: JSON.stringify(body) });
  },
  googleSignIn: async (body) => {
    await ensureApiReady(90000);
    return request('/auth/google', { method: 'POST', body: JSON.stringify(body) });
  },
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  registerStart: async (body) => {
    await ensureApiReady(90000);
    return request('/auth/register/start', { method: 'POST', body: JSON.stringify(body) });
  },
  registerVerify: (body) => request('/auth/register/verify', { method: 'POST', body: JSON.stringify(body) }),
  loginOtpStart: async (body) => {
    await ensureApiReady(90000);
    return request('/auth/login/otp/start', { method: 'POST', body: JSON.stringify(body) });
  },
  loginOtpVerify: (body) => request('/auth/login/otp/verify', { method: 'POST', body: JSON.stringify(body) }),
  passwordResetStart: (body) => request('/auth/password/reset/start', { method: 'POST', body: JSON.stringify(body) }),
  passwordResetVerify: (body) => request('/auth/password/reset/verify', { method: 'POST', body: JSON.stringify(body) }),
  updateProfile: (body) => request('/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  changePassword: (body) => request('/auth/change-password', { method: 'PATCH', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  getMyOrders: () => request('/auth/my-orders'),
  getMyMessages: () => request('/auth/my-messages'),
  getAdmins: () => request('/auth/users'),
  getTeam: () => request('/auth/users'),
  getCustomers: () => request('/auth/customers'),
  createAdmin: (body) => request('/auth/users', { method: 'POST', body: JSON.stringify(body) }),
  createTeamMember: (body) => request('/auth/users', { method: 'POST', body: JSON.stringify(body) }),
  updateAdmin: (id, body) =>
    request(`/auth/admins/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateTeamMember: (id, body) =>
    request(`/auth/admins/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  toggleTeamBlock: (id, blocked) =>
    request(`/auth/users/${id}/block`, { method: 'PATCH', body: JSON.stringify({ blocked }) }),
  resetTeamPassword: (id, password) =>
    request(`/auth/users/${id}/reset-password`, {
      method: 'PATCH',
      body: JSON.stringify({ password }),
    }),
  removeTeamMember: (id) => request(`/auth/users/${id}`, { method: 'DELETE' }),

  getProducts: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/products${query ? `?${query}` : ''}`);
  },
  getProduct: (id) => request(`/products/${id}`),
  getProductBySlug: (slug) => request(`/products/by-slug/${encodeURIComponent(slug)}`),
  getCategories: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/products/categories${query ? `?${query}` : ''}`);
  },
  createProduct: (body) => request('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  setProductDiscount: (id, discount_percent) =>
    request(`/products/${id}/discount`, { method: 'PATCH', body: JSON.stringify({ discount_percent }) }),
  adjustProductStock: (id, delta, opts = {}) =>
    request(`/products/${id}/stock`, { method: 'PATCH', body: JSON.stringify({ delta, ...opts }) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),
  duplicateProduct: (id) => request(`/products/${id}/duplicate`, { method: 'POST' }),
  bulkDeleteProducts: (ids) =>
    request('/products/bulk-delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  uploadProductImage: (file) => uploadProductImage(file),
  uploadOrderPaymentProof: (orderId, file) => uploadOrderPaymentProof(orderId, file),

  getRepairServices: () => request('/repairs/services'),
  getRepairRateCatalog: () => request('/repairs/rates/catalog'),
  repairRateQuery: (body) =>
    request('/repairs/rate-query', { method: 'POST', body: JSON.stringify(body) }),
  bookRepair: (body) => request('/repairs/book', { method: 'POST', body: JSON.stringify(body) }),
  getBookings: () => request('/repairs/bookings'),
  getMyRepairs: () => request('/repairs/my-bookings'),
  trackRepair: (bookingId, phone) => {
    const q = new URLSearchParams({ bookingId, phone }).toString();
    return request(`/repairs/track?${q}`);
  },
  updateBookingStatus: (id, status) =>
    request(`/repairs/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  updateBookingEstimatedCost: (id, estimated_cost) =>
    request(`/repairs/bookings/${id}/estimated-cost`, {
      method: 'PATCH',
      body: JSON.stringify({ estimated_cost }),
    }),
  updateBookingPhotos: (id, body) =>
    request(`/repairs/bookings/${id}/photos`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  addBookingNote: (id, note) =>
    request(`/repairs/bookings/${id}/notes`, {
      method: 'PATCH',
      body: JSON.stringify({ note }),
    }),
  getRepairChats: () => request('/repairs/chats'),
  getRepairMessages: (id) => request(`/repairs/bookings/${id}/messages`),
  sendRepairMessage: (id, text) =>
    request(`/repairs/bookings/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
  getRepairChatUnread: () => request('/repairs/messages/unread'),

  placeOrder: (body) => request('/orders', { method: 'POST', body: JSON.stringify(body) }),
  getOrders: () => request('/orders'),
  updateOrderStatus: (id, shipping_status) =>
    request(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ shipping_status }),
    }),
  markOrderPaid: (id) => request(`/orders/${id}/mark-paid`, { method: 'PATCH' }),
  assignOrderRider: (id, body) =>
    request(`/orders/${id}/assign-rider`, { method: 'PATCH', body: JSON.stringify(body) }),
  markOrderDelivered: (id) => request(`/orders/${id}/mark-delivered`, { method: 'PATCH' }),
  getMyAddresses: () => request('/auth/my-addresses'),
  addAddress: (body) => request('/auth/my-addresses', { method: 'POST', body: JSON.stringify(body) }),
  updateAddress: (id, body) =>
    request(`/auth/my-addresses/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAddress: (id) => request(`/auth/my-addresses/${id}`, { method: 'DELETE' }),
  trackOrder: (orderId, phone) => {
    const q = new URLSearchParams({ orderId, phone }).toString();
    return request(`/orders/track?${q}`);
  },
  saveOrderGmail: (id, body) =>
    request(`/orders/${id}/gmail`, { method: 'PATCH', body: JSON.stringify(body) }),
  submitOrderFeedback: (orderId, body) =>
    request('/orders/feedback', { method: 'POST', body: JSON.stringify({ orderId, ...body }) }),

  sendContact: (body) => request('/contact', { method: 'POST', body: JSON.stringify(body) }),
  getContactMessages: () => request('/contact'),
  replyContactMessage: (id, reply) =>
    request(`/contact/${id}/reply`, { method: 'PATCH', body: JSON.stringify({ reply }) }),
  updateContactMessage: (id, body) =>
    request(`/contact/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteContactMessage: (id) => request(`/contact/${id}`, { method: 'DELETE' }),
  getSalesReport: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/sales-report${query ? `?${query}` : ''}`);
  },
  getAdminDashboardStats: () => request('/admin/dashboard-stats'),
  getCustomersSummary: () => request('/admin/customers-summary'),
  getAdminFeedback: () => request('/admin/feedback'),
  updateAdminFeedback: (orderId, body) =>
    request(`/admin/feedback/${orderId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAdminFeedback: (orderId) =>
    request(`/admin/feedback/${orderId}`, { method: 'DELETE' }),
  getPublishedReviews: (params = {}) => {
    const q = new URLSearchParams();
    if (params.product_id != null) q.set('product_id', params.product_id);
    const qs = q.toString();
    return request(`/orders/reviews${qs ? `?${qs}` : ''}`);
  },
  getAdminCategories: () => request('/admin/categories'),
  createCategory: (body) =>
    request('/admin/categories', { method: 'POST', body: JSON.stringify(body) }),
  updateCategory: (id, body) =>
    request(`/admin/categories/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteCategory: (id) => request(`/admin/categories/${id}`, { method: 'DELETE' }),
  downloadDataBackup: () => downloadDataBackup(),

  getStats: () => request('/stats'),
  getShopStatus: () => request('/shop/status'),
  setShopStatus: (manual_override) =>
    request('/shop/status', { method: 'PATCH', body: JSON.stringify({ manual_override }) }),
  getPaymentSettings: () => request('/shop/payments'),
  setPaymentSettings: (body) =>
    request('/shop/payments', { method: 'PATCH', body: JSON.stringify(body) }),
  getDeliverySettings: () => request('/shop/delivery'),
  setDeliverySettings: (body) =>
    request('/shop/delivery', { method: 'PATCH', body: JSON.stringify(body) }),
  getStorefrontImages: () => request('/shop/storefront-images'),
  updateStorefrontImages: (body) =>
    request('/shop/storefront-images', { method: 'PATCH', body: JSON.stringify(body) }),
};

export function formatPrice(amount) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(amount);
}
