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
  const [chooserMode, setChooserMode] = useState('print'); /* print | configure */
  const [targetVersion, setTargetVersion] = useState(0);
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
    setChooserMode('print');
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
      setChooserMode('print');
      setChooserOpen(true);
    });
  }, [thermalWidth]);

  /** Open printer / station picker without printing (website + iOS status). */
  const openPrintSetup = useCallback(() => {
    pendingRef.current = null;
    setChooserBusy(false);
    setChooserMode('configure');
    setChooserOpen(true);
  }, []);

  const onChooserClose = useCallback(() => {
    if (chooserMode === 'configure' || !pendingRef.current) {
      setChooserOpen(false);
      setChooserBusy(false);
      setChooserMode('print');
      return;
    }
    finishChooser({ ok: false, reason: 'cancelled' });
  }, [chooserMode, finishChooser]);

  const onChooserSelect = useCallback(async (target) => {
    writePrintTarget(target);
    setTargetVersion((n) => n + 1);

    if (chooserMode === 'configure' || !pendingRef.current) {
      setChooserOpen(false);
      setChooserBusy(false);
      setChooserMode('print');
      return;
    }

    const pending = pendingRef.current;
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
      const dataBase64 = await buildThermalReceiptEscPosBase64(
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
  }, [chooserMode, finishChooser]);

  const chooser = (
    <PrintTargetChooser
      open={chooserOpen}
      busy={chooserBusy}
      mode={chooserMode}
      initialTarget={defaultPrintTarget()}
      onClose={onChooserClose}
      onSelect={onChooserSelect}
    />
  );

  return { printSmart, openPrintSetup, chooser, chooserOpen, targetVersion };
}
