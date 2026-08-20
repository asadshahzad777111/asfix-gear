import { useCallback, useEffect, useRef, useState } from 'react';
import PrintTargetChooser from './PrintTargetChooser';
import { printLocalReceipt } from './localPrint';
import {
  buildThermalReceiptEscPosBase64,
  buildThermalReceiptText,
} from './receiptEscPos';
import {
  canPrintLocallyNative,
  defaultPrintTarget,
  enqueueRemotePrintJob,
  writePrintTarget,
} from './remoteThermalPrint';
import { resolvePrintAgentStation, startPrintJobAgent } from './printJobAgent';

/**
 * Shared Print flow: native+printer → local; else chooser → local or remote queue.
 * Kit version: self-contained, no AsFix internal imports.
 *
 * @param {{ thermalWidth?: string, agentReady?: boolean, labels?: object }} [opts]
 */
export function useSmartThermalPrint({ thermalWidth = '58mm', agentReady = true, labels } = {}) {
  const [chooserOpen, setChooserOpen] = useState(false);
  const [chooserBusy, setChooserBusy] = useState(false);
  const pendingRef = useRef(null);

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
    if (!order) return { ok: false, reason: 'no_order', message: 'No receipt to print' };
    const width = opts.thermalWidth || thermalWidth;

    if (await canPrintLocallyNative()) {
      return printLocalReceipt({ order, thermalWidth: width });
    }

    return new Promise((resolve) => {
      pendingRef.current = { resolve, order, thermalWidth: width };
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
      if (target === 'local') {
        const result = await printLocalReceipt({
          order: pending.order,
          thermalWidth: pending.thermalWidth,
        });
        finishChooser(result);
        return;
      }

      const text = buildThermalReceiptText(pending.order);
      const dataBase64 = buildThermalReceiptEscPosBase64(pending.order, pending.thermalWidth);
      const result = await enqueueRemotePrintJob({
        order: pending.order,
        text,
        dataBase64,
        target,
        thermalWidth: pending.thermalWidth,
      });
      finishChooser(result);
    } catch (err) {
      finishChooser({ ok: false, reason: 'print_failed', message: err?.message || 'Print failed' });
    }
  }, [finishChooser]);

  const chooser = (
    <PrintTargetChooser
      open={chooserOpen}
      busy={chooserBusy}
      initialTarget={defaultPrintTarget()}
      onClose={onChooserClose}
      onSelect={onChooserSelect}
      labels={labels}
    />
  );

  return { printSmart, chooser, chooserOpen };
}
