/**
 * Standalone print-jobs API client for the thermal print kit.
 *
 * This replaces the AsFix `src/api/client.js` dependency so the kit can be
 * dropped into any website. Configure it once at app startup:
 *
 *   import { configurePrintApi } from './printApi';
 *   configurePrintApi({
 *     baseUrl: '/api',                 // where your Express API is mounted
 *     getToken: () => localStorage.getItem('my_auth_token'),
 *   });
 *
 * The backend routes live in ../backend/printJobsRoute.js and expect a Bearer
 * token (staff/counter role). If your API is same-origin, baseUrl '/api' works
 * with a dev proxy; on a split deploy set the full origin, e.g.
 * 'https://api.myshop.com/api'.
 */

let config = {
  baseUrl: '/api',
  getToken: () => null,
  fetchImpl: typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null,
};

export function configurePrintApi(next = {}) {
  config = { ...config, ...next };
}

function authHeaders() {
  const token = typeof config.getToken === 'function' ? config.getToken() : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(path, options = {}) {
  const doFetch = config.fetchImpl || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
  if (!doFetch) throw new Error('No fetch implementation available for printApi');
  const res = await doFetch(`${config.baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
      ...(options.headers || {}),
    },
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const message = data?.error || data?.message || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const printApi = {
  createPrintJob: (body) =>
    request('/print-jobs', { method: 'POST', body: JSON.stringify(body) }),
  getPendingPrintJobs: (params = {}) => {
    const query = new URLSearchParams();
    if (params.station) query.set('station', params.station);
    const qs = query.toString();
    return request(`/print-jobs/pending${qs ? `?${qs}` : ''}`);
  },
  getPrintStations: () => request('/print-jobs/stations'),
  printJobHeartbeat: (body) =>
    request('/print-jobs/heartbeat', { method: 'POST', body: JSON.stringify(body) }),
  claimPrintJob: (id, body) =>
    request(`/print-jobs/${encodeURIComponent(id)}/claim`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  completePrintJob: (id, body) =>
    request(`/print-jobs/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  getPrintJob: (id) => request(`/print-jobs/${encodeURIComponent(id)}`),
};
