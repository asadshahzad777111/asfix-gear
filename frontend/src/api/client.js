const API_BASE = '/api';
const TOKEN_KEY = 'asfix_auth_token';

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

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 8000);

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      headers,
      signal: controller.signal,
      ...options,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Server slow hai — thori der baad dubara try karein.');
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
      if (!res.ok) {
        throw new Error(
          res.status === 502 || res.status === 503 || res.status === 504
            ? 'Backend server is not running. Start it with: npm run dev (port 5000)'
            : 'Something went wrong'
        );
      }
    }
  }

  if (!res.ok) {
    const error = new Error(data.error || 'Something went wrong');
    error.status = res.status;
    throw error;
  }
  return data;
}

export const api = {
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  registerStart: (body) => request('/auth/register/start', { method: 'POST', body: JSON.stringify(body) }),
  registerVerify: (body) => request('/auth/register/verify', { method: 'POST', body: JSON.stringify(body) }),
  loginOtpStart: (body) => request('/auth/login/otp/start', { method: 'POST', body: JSON.stringify(body) }),
  loginOtpVerify: (body) => request('/auth/login/otp/verify', { method: 'POST', body: JSON.stringify(body) }),
  updateProfile: (body) => request('/auth/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  changePassword: (body) => request('/auth/change-password', { method: 'PATCH', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  getMyOrders: () => request('/auth/my-orders'),
  getMyMessages: () => request('/auth/my-messages'),
  getAdmins: () => request('/auth/users'),
  getTeam: () => request('/auth/users'),
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
  getCategories: () => request('/products/categories'),
  createProduct: (body) => request('/products', { method: 'POST', body: JSON.stringify(body) }),
  updateProduct: (id, body) => request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  setProductDiscount: (id, discount_percent) =>
    request(`/products/${id}/discount`, { method: 'PATCH', body: JSON.stringify({ discount_percent }) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: 'DELETE' }),

  getRepairServices: () => request('/repairs/services'),
  bookRepair: (body) => request('/repairs/book', { method: 'POST', body: JSON.stringify(body) }),
  getBookings: () => request('/repairs/bookings'),
  updateBookingStatus: (id, status) =>
    request(`/repairs/bookings/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  placeOrder: (body) => request('/orders', { method: 'POST', body: JSON.stringify(body) }),
  getOrders: () => request('/orders'),
  trackOrder: (orderId, phone) => {
    const q = new URLSearchParams({ orderId, phone }).toString();
    return request(`/orders/track?${q}`);
  },
  saveOrderGmail: (id, body) =>
    request(`/orders/${id}/gmail`, { method: 'PATCH', body: JSON.stringify(body) }),
  updateOrderStatus: (id, shipping_status) =>
    request(`/orders/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ shipping_status }),
    }),

  sendContact: (body) => request('/contact', { method: 'POST', body: JSON.stringify(body) }),
  getContactMessages: () => request('/contact'),
  replyContactMessage: (id, reply) =>
    request(`/contact/${id}/reply`, { method: 'PATCH', body: JSON.stringify({ reply }) }),
  getSalesReport: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request(`/admin/sales-report${query ? `?${query}` : ''}`);
  },

  getStats: () => request('/stats'),
  getShopStatus: () => request('/shop/status'),
  setShopStatus: (manual_override) =>
    request('/shop/status', { method: 'PATCH', body: JSON.stringify({ manual_override }) }),
};

export function formatPrice(amount) {
  return new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  }).format(amount);
}
