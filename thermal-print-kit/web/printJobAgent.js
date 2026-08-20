/**
 * Poll remote thermal print jobs and print on this station (Android POS / laptop).
 * Kit version: imports the standalone printApi instead of AsFix `api/client`.
 */
import { printApi } from './printApi';
import { startVisibilityPoll } from './visibilityPoll';
import {
  getSavedPrinter,
  isNativePosApp,
  nativePrintEscPos,
  nativePrintText,
} from './nativePosPrint';
import {
  printEscPosViaThermalBridge,
  probeThermalBridge,
  tryLaptopThermalPrint,
} from './thermalLaptopPrint';
import { isDesktopDevice } from './remoteThermalPrint';

const POLL_MS = 3500;
const inFlight = new Set();
let activeStop = null;
let activeStation = null;
let refCount = 0;

async function processJob(job, station) {
  if (!job?.id || inFlight.has(job.id)) return;
  inFlight.add(job.id);
  try {
    await printApi.claimPrintJob(job.id, { station });
    let printed = { ok: false, reason: 'print_failed', message: 'Print failed' };

    if (station === 'android') {
      printed = job.data_base64
        ? await nativePrintEscPos(job.data_base64)
        : await nativePrintText(job.text || '');
    } else {
      printed = job.data_base64
        ? await printEscPosViaThermalBridge(job.data_base64)
        : await tryLaptopThermalPrint(job.text || '');
    }

    if (printed?.ok) {
      await printApi.completePrintJob(job.id, { status: 'done', station });
    } else {
      await printApi.completePrintJob(job.id, {
        status: 'failed',
        station,
        error: printed?.message || printed?.reason || 'print_failed',
      });
    }
  } catch (err) {
    try {
      await printApi.completePrintJob(job.id, {
        status: 'failed',
        station,
        error: err?.message || 'agent_error',
      });
    } catch {
      /* ignore */
    }
  } finally {
    inFlight.delete(job.id);
  }
}

async function pollOnce(station) {
  try {
    await printApi.printJobHeartbeat({ station });
  } catch {
    /* heartbeat best-effort */
  }
  try {
    const data = await printApi.getPendingPrintJobs({ station });
    const jobs = Array.isArray(data?.jobs) ? data.jobs : [];
    for (const job of jobs.slice(0, 3)) {
      // eslint-disable-next-line no-await-in-loop
      await processJob(job, station);
    }
  } catch {
    /* ignore transient poll errors */
  }
}

/**
 * Start visibility-aware polling for remote print jobs (ref-counted singleton).
 * @param {'android'|'laptop'} station
 * @returns {() => void} stop
 */
export function startPrintJobAgent(station) {
  if (station !== 'android' && station !== 'laptop') return () => {};

  refCount += 1;
  if (!activeStop || activeStation !== station) {
    if (activeStop) {
      activeStop();
      activeStop = null;
    }
    activeStation = station;
    activeStop = startVisibilityPoll(() => {
      void pollOnce(station);
    }, POLL_MS);
  }

  let released = false;
  return () => {
    if (released) return;
    released = true;
    refCount = Math.max(0, refCount - 1);
    if (refCount === 0 && activeStop) {
      activeStop();
      activeStop = null;
      activeStation = null;
    }
  };
}

/**
 * Decide whether this browser/app should run a print agent.
 * @returns {Promise<'android'|'laptop'|null>}
 */
export async function resolvePrintAgentStation() {
  if (isNativePosApp()) {
    const printer = await getSavedPrinter();
    return printer?.address ? 'android' : null;
  }
  if (isDesktopDevice()) {
    const bridge = await probeThermalBridge();
    return bridge?.ok && bridge?.ready && bridge?.com ? 'laptop' : null;
  }
  return null;
}
