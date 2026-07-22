import { useCallback, useEffect, useRef, useState } from 'react';
import PrintTargetChooser from '../components/PrintTargetChooser';
import {
  printActiveCounterReceipt,
  printDirectSystemReceipt,
  buildThermalReceiptEscPosBase64,
  buildThermalReceiptText,
} from '../components/admin/AdminCounterBill';
import {
  canPrintLocallyNative,
  defaultPrintTarget,
  enqueueRemotePrintJob,
  writePrintTarget,
} from '../utils/remoteThermalPrint';
import { resolvePrintAgentStation, startPrintJobAgent } from '../utils/printJobAgent';

/**
 * Shared Print flow: native+printer → local; else chooser → Direct / local / remote queue.
 * @param {{ thermalWidth?: string, agentReady?: boolean }} [opts]
 */
export function useSmartThermalPrint({ thermalWidth = '58mm', agentReady = true } = {}) {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [chooserBusy, setChooserBusy] = useState(false);
  const pendingRef = useRef(null);
  const inFlightRef = useRef(false);

  useEffect(() => {
    if (!agentReady) return undefined;
    let stop = () => {};
    let cancelled = false;
    (async () => {
      const station = await resolvePrintAgentStation();
      if (cancelled || !station) return;
      stop = startPrintJobAgent(station);
    })();
    return () => {
      cancelled = true;
      stop();
    };
  }, [agentReady]);

  const finishChooser = useCallback((result) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setChooserOpen(false);
    setChooserBusy(false);
    pending?.resolve(result);
  }, []);

  const printSmart = useCallback(async (order, opts = {}) => {
    if (!order) {
      return { ok: false, reason: 'no_order', message: 'No receipt to print' };
    }
    const width = opts.thermalWidth || thermalWidth;
    const flight = opts.inFlightRef || inFlightRef;

    if (await canPrintLocallyNative()) {
      return printActiveCounterReceipt({
        order,
        thermalWidth: width,
        inFlightRef: flight,
      });
    }

    return new Promise((resolve) => {
      pendingRef.current = { resolve, order, thermalWidth: width, inFlightRef: flight };
      setChooserOpen(true);
    });
  }, [thermalWidth]);

  const onChooserClose = useCallback(() => {
    finishChooser({ ok: false, reason: 'cancelled' });
  }, [finishChooser]);

  const onChooserSelect = useCallback(async (target) => {
    const pending = pendingRef.current;
    if (!pending) {
      setChooserOpen(false);
      return;
    }
    writePrintTarget(target);
    setChooserBusy(true);

    try {
      if (target === 'direct') {
        const result = await printDirectSystemReceipt({
          order: pending.order,
          thermalWidth: pending.thermalWidth,
          inFlightRef: pending.inFlightRef,
        });
        finishChooser(result);
        return;
      }

      if (target === 'local') {
        const result = await printActiveCounterReceipt({
          order: pending.order,
          thermalWidth: pending.thermalWidth,
          inFlightRef: pending.inFlightRef,
        });
        finishChooser(result);
        return;
      }

      const text = buildThermalReceiptText(pending.order, pending.thermalWidth);
      const dataBase64 = buildThermalReceiptEscPosBase64(
        pending.order,
        pending.thermalWidth,
      );
      const result = await enqueueRemotePrintJob({
        order: pending.order,
        text,
        dataBase64,
        target,
        thermalWidth: pending.thermalWidth,
      });
      finishChooser(result);
    } catch (err) {
      finishChooser({
        ok: false,
        reason: 'print_failed',
        message: err?.message || 'Print failed',
      });
    }
  }, [finishChooser]);

  const chooser = (
    <PrintTargetChooser
      open={chooserOpen}
      busy={chooserBusy}
      initialTarget={defaultPrintTarget()}
      onClose={onChooserClose}
      onSelect={onChooserSelect}
    />
  );

  return { printSmart, chooser, chooserOpen };
}
