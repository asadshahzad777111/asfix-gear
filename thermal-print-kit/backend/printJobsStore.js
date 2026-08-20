/**
 * Standalone print-jobs store for the thermal print kit.
 *
 * Decoupled from AsFix's big store.js: keeps print jobs in memory, with
 * optional JSON-file persistence so jobs survive a server restart. For most POS
 * setups (one backend process) in-memory is enough — a job only lives ~10 min.
 *
 * Usage (in your Express app):
 *   import { createPrintJobsStore } from './printJobsStore.js';
 *   const printStore = createPrintJobsStore();               // in-memory
 *   // or: createPrintJobsStore({ filePath: './data/print-jobs.json' });
 *
 * Then pass `printStore` into createPrintJobsRouter (see printJobsRoute.js).
 */
import fs from 'node:fs';
import path from 'node:path';

export const PRINT_JOB_TARGETS = ['any', 'android', 'laptop', 'local'];
export const PRINT_JOB_STATUSES = ['pending', 'printing', 'done', 'failed', 'expired'];
export const PRINT_JOB_TTL_MS = 10 * 60_000;
const PRINT_JOB_MAX_TEXT = 32_000;
const PRINT_JOB_MAX_BASE64 = 128_000;
const PRINT_JOB_KEEP = 200;

const nowIso = () => new Date().toISOString();

function isJobExpired(job, at = Date.now()) {
  if (!job) return true;
  if (job.status === 'expired') return true;
  if (job.status !== 'pending' && job.status !== 'printing') return false;
  const expires = Date.parse(job.expires_at || '');
  return Number.isFinite(expires) && expires <= at;
}

function publicPrintJob(job) {
  if (!job) return null;
  const expired = isJobExpired(job);
  return {
    id: job.id,
    status: expired && (job.status === 'pending' || job.status === 'printing') ? 'expired' : job.status,
    target: job.target,
    text: job.text,
    data_base64: job.data_base64 || null,
    thermal_width: job.thermal_width,
    order_id: job.order_id ?? null,
    order_ref: job.order_ref ?? null,
    created_by_staff_id: job.created_by_staff_id ?? null,
    created_by_staff_name: job.created_by_staff_name || '',
    created_at: job.created_at,
    expires_at: job.expires_at,
    claimed_by: job.claimed_by || null,
    claimed_at: job.claimed_at || null,
    finished_at: job.finished_at || null,
    error: expired && !job.error ? 'expired' : (job.error || null),
  };
}

function jobMatchesStation(job, station) {
  if (!job || job.status !== 'pending' || isJobExpired(job)) return false;
  if (job.target === 'any') return station === 'android' || station === 'laptop';
  return job.target === station;
}

export function createPrintJobsStore({ filePath = null } = {}) {
  const state = { jobs: [], nextId: 1 };

  const persist = () => {
    if (!filePath) return;
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(state), 'utf8');
    } catch {
      /* persistence is best-effort */
    }
  };

  if (filePath) {
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.jobs)) state.jobs = parsed.jobs;
      if (Number.isFinite(parsed.nextId)) state.nextId = parsed.nextId;
    } catch {
      /* start fresh if file missing/corrupt */
    }
  }

  const expireInPlace = (at = Date.now()) => {
    for (const job of state.jobs) {
      if (job.status !== 'pending' && job.status !== 'printing') continue;
      if (!isJobExpired(job, at)) continue;
      job.status = 'expired';
      job.finished_at = nowIso();
      job.error = job.error || 'expired';
    }
  };

  return {
    createPrintJob(input = {}) {
      expireInPlace();
      const text = String(input.text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      if (!text.trim()) throw new Error('Receipt text is required');
      if (text.length > PRINT_JOB_MAX_TEXT) throw new Error('Receipt text is too long');
      const dataBase64 = String(input.data_base64 || '').trim();
      if (dataBase64 && !/^[A-Za-z0-9+/]+={0,2}$/.test(dataBase64)) {
        throw new Error('Receipt ESC/POS data is invalid');
      }
      if (dataBase64.length > PRINT_JOB_MAX_BASE64) {
        throw new Error('Receipt ESC/POS data is too long');
      }
      let target = String(input.target || 'any').trim().toLowerCase();
      if (!PRINT_JOB_TARGETS.includes(target)) target = 'any';
      if (target === 'local') {
        throw new Error('Use local print on the device — do not enqueue local jobs');
      }
      const thermalWidth = input.thermal_width === '80mm' ? '80mm' : '58mm';
      const staff = input.staff_user || {};
      const job = {
        id: state.nextId++,
        status: 'pending',
        target,
        text,
        data_base64: dataBase64 || null,
        thermal_width: thermalWidth,
        order_id: input.order_id ?? null,
        order_ref: input.order_ref ? String(input.order_ref).slice(0, 40) : null,
        created_by_staff_id: staff.id ?? null,
        created_by_staff_name: String(staff.name || staff.username || '').slice(0, 120),
        created_at: nowIso(),
        expires_at: new Date(Date.now() + PRINT_JOB_TTL_MS).toISOString(),
        claimed_by: null,
        claimed_at: null,
        finished_at: null,
        error: null,
      };
      state.jobs.unshift(job);
      state.jobs = state.jobs.slice(0, PRINT_JOB_KEEP);
      persist();
      return publicPrintJob(job);
    },

    listPendingPrintJobs({ station = null } = {}) {
      expireInPlace();
      const stationKey = station === 'android' || station === 'laptop' ? station : null;
      let jobs = state.jobs.filter((job) => job.status === 'pending' && !isJobExpired(job));
      if (stationKey) {
        jobs = jobs.filter((job) => jobMatchesStation(job, stationKey));
      } else {
        jobs = jobs.filter((job) => job.target === 'any' || job.target === 'android' || job.target === 'laptop');
      }
      return jobs
        .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
        .map(publicPrintJob);
    },

    claimPrintJob(id, { station, user = null } = {}) {
      expireInPlace();
      const stationKey = station === 'android' || station === 'laptop' ? station : null;
      if (!stationKey) throw new Error('station must be android or laptop');
      const index = state.jobs.findIndex((job) => Number(job.id) === Number(id));
      if (index === -1) return null;
      const job = state.jobs[index];
      if (job.status === 'expired') return null;
      if (job.status !== 'pending') throw new Error('Print job is no longer pending');
      if (!jobMatchesStation(job, stationKey)) {
        throw new Error('Print job target does not match this station');
      }
      state.jobs[index] = {
        ...job,
        status: 'printing',
        claimed_at: nowIso(),
        claimed_by: { station: stationKey, user_id: user?.id ?? null, name: user?.name || stationKey },
      };
      persist();
      return publicPrintJob(state.jobs[index]);
    },

    completePrintJob(id, { status = 'done', error = null, user = null } = {}) {
      expireInPlace();
      const nextStatus = status === 'failed' ? 'failed' : 'done';
      const index = state.jobs.findIndex((job) => Number(job.id) === Number(id));
      if (index === -1) return null;
      const job = state.jobs[index];
      if (job.status === 'done' || job.status === 'failed' || job.status === 'expired') {
        return publicPrintJob(job);
      }
      if (job.status !== 'printing' && job.status !== 'pending') {
        throw new Error('Print job cannot be completed');
      }
      state.jobs[index] = {
        ...job,
        status: nextStatus,
        finished_at: nowIso(),
        error: nextStatus === 'failed' ? String(error || 'print_failed').trim().slice(0, 300) : null,
        claimed_by: job.claimed_by || { station: 'unknown', user_id: user?.id ?? null, name: user?.name || '' },
      };
      persist();
      return publicPrintJob(state.jobs[index]);
    },

    getPrintJob(id) {
      const job = state.jobs.find((entry) => Number(entry.id) === Number(id));
      return publicPrintJob(job);
    },
  };
}
