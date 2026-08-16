import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './pos-camera-barcode-scanner.css';

const SCAN_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'codabar',
  'qr_code',
  'itf',
];

/** Same-code debounce so continuous scan does not double-fire (~Zobaze feel). */
const SAME_CODE_DEBOUNCE_MS = 1200;
/** How often we run a detect pass (ms). Faster than waiting full RAF+await stalls. */
const DETECT_INTERVAL_MS = 90;
const FLASH_MS = 900;

function supportsBarcodeDetector() {
  return typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function';
}

function supportsCamera() {
  return (
    typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

function playOverlayBeep(ok = true) {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(ok ? 35 : [30, 40, 30]);
    }
  } catch {
    /* ignore */
  }
  try {
    const Ctx = typeof window !== 'undefined'
      && (window.AudioContext || window.webkitAudioContext);
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = ok ? 980 : 220;
    gain.gain.value = 0.07;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);
    osc.stop(ctx.currentTime + 0.1);
    window.setTimeout(() => {
      try {
        ctx.close();
      } catch {
        /* ignore */
      }
    }, 160);
  } catch {
    /* ignore */
  }
}

function normalizeDetectResult(raw) {
  if (raw == null || raw === true) return { ok: true, message: '', close: false };
  if (raw === false) return { ok: false, message: '', close: false };
  if (typeof raw === 'string') return { ok: true, message: raw, close: false };
  if (typeof raw === 'object') {
    return {
      ok: raw.ok !== false,
      message: String(raw.message || ''),
      close: Boolean(raw.close),
    };
  }
  return { ok: true, message: '', close: false };
}

/**
 * Full-screen camera barcode scanner for POS Sale bill (continuous) + product barcode capture.
 * Prefers native BarcodeDetector; falls back to ZXing. Camera stays open until Close.
 */
export default function PosCameraBarcodeScanner({
  open,
  onClose,
  onDetected,
  title = 'Scan barcode',
  hint = 'Point the camera at a product barcode',
  unsupportedHint = 'Camera scan not supported here. Use a USB scanner in the search box, then press Enter.',
  closeLabel = 'Close',
  scanningLabel = 'Looking for barcode…',
  permissionLabel = 'Allow camera to scan barcodes',
  deniedHint = 'Camera blocked. Close, allow Camera in App Info (or install the latest AsFix POS APK), then try Scan again.',
  torchOnLabel = 'Torch on',
  torchOffLabel = 'Torch off',
  addedFlashLabel = 'Added',
  notFoundFlashLabel = 'Not found',
  /** When true (default), keep camera open after each hit. Product form sets false. */
  continuous = true,
  /** Optional: play beep inside overlay (parent may also beep). */
  beepOnDetect = true,
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const zxingReaderRef = useRef(null);
  const intervalRef = useRef(0);
  const detectBusyRef = useRef(false);
  const lastCodeRef = useRef('');
  const lastAtRef = useRef(0);
  const onDetectedRef = useRef(onDetected);
  const continuousRef = useRef(continuous);
  const [status, setStatus] = useState('idle'); /* idle | starting | ready | unsupported | denied | error */
  const [statusText, setStatusText] = useState('');
  const [retryToken, setRetryToken] = useState(0);
  const [flash, setFlash] = useState(null); /* { type: 'ok'|'err', text } */
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const flashTimerRef = useRef(0);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  useEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = 0;
    }
    detectBusyRef.current = false;
    try {
      zxingReaderRef.current?.reset?.();
      zxingReaderRef.current?.stopContinuousDecode?.();
      zxingReaderRef.current?.stopAsyncDecode?.();
    } catch {
      /* ignore */
    }
    zxingReaderRef.current = null;
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) {
      stream.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          /* ignore */
        }
      });
    }
    const video = videoRef.current;
    if (video) {
      try {
        video.srcObject = null;
      } catch {
        /* ignore */
      }
    }
    detectorRef.current = null;
    setTorchOn(false);
    setTorchAvailable(false);
  }, []);

  const showFlash = useCallback((type, text) => {
    if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
    setFlash({ type, text });
    flashTimerRef.current = window.setTimeout(() => {
      setFlash(null);
      flashTimerRef.current = 0;
    }, FLASH_MS);
  }, []);

  const handleDetected = useCallback(async (raw) => {
    const code = String(raw || '').trim();
    if (!code) return;
    const now = Date.now();
    if (code === lastCodeRef.current && now - lastAtRef.current < SAME_CODE_DEBOUNCE_MS) return;
    lastCodeRef.current = code;
    lastAtRef.current = now;

    let result;
    try {
      result = normalizeDetectResult(await onDetectedRef.current?.(code));
    } catch {
      result = { ok: false, message: notFoundFlashLabel, close: false };
    }

    if (beepOnDetect) playOverlayBeep(result.ok);
    if (result.ok) {
      showFlash('ok', result.message || addedFlashLabel);
    } else {
      showFlash('err', result.message || notFoundFlashLabel);
    }

    const shouldClose = result.close || (!continuousRef.current && result.ok);
    if (shouldClose) {
      window.setTimeout(() => onClose?.(), 280);
    }
  }, [addedFlashLabel, beepOnDetect, notFoundFlashLabel, onClose, showFlash]);

  const toggleTorch = useCallback(async () => {
    const stream = streamRef.current;
    const track = stream?.getVideoTracks?.()?.[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] });
      setTorchOn(next);
    } catch {
      try {
        await track.applyConstraints({ torch: next });
        setTorchOn(next);
      } catch {
        setTorchAvailable(false);
      }
    }
  }, [torchOn]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const { body } = document;
    const prevOverflow = body.style.overflow;
    body.classList.add('pos-modal-open');
    body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      body.classList.remove('pos-modal-open');
      body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      stopCamera();
      setStatus('idle');
      setStatusText('');
      setFlash(null);
      if (flashTimerRef.current) {
        window.clearTimeout(flashTimerRef.current);
        flashTimerRef.current = 0;
      }
      return undefined;
    }

    let cancelled = false;
    let permissionTimer = 0;

    const probeTorch = (stream) => {
      try {
        const track = stream.getVideoTracks?.()?.[0];
        const caps = track?.getCapabilities?.();
        setTorchAvailable(Boolean(caps && 'torch' in caps && caps.torch));
      } catch {
        setTorchAvailable(false);
      }
    };

    const startNativeLoop = () => {
      intervalRef.current = window.setInterval(() => {
        if (cancelled || detectBusyRef.current) return;
        const video = videoRef.current;
        const detector = detectorRef.current;
        if (!video || !detector || video.readyState < 2) return;
        detectBusyRef.current = true;
        void detector.detect(video)
          .then((codes) => {
            if (cancelled || !codes?.length) return;
            const value = codes[0]?.rawValue;
            if (value) void handleDetected(value);
          })
          .catch(() => {
            /* frame skipped */
          })
          .finally(() => {
            detectBusyRef.current = false;
          });
      }, DETECT_INTERVAL_MS);
    };

    const startZxingLoop = async (stream) => {
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      if (cancelled) return;
      const reader = new BrowserMultiFormatReader(undefined, SAME_CODE_DEBOUNCE_MS);
      reader.timeBetweenDecodingAttempts = DETECT_INTERVAL_MS;
      zxingReaderRef.current = reader;
      const video = videoRef.current;
      if (!video) return;
      /* decodeFromStream attaches the stream to the video element */
      void reader.decodeFromStream(stream, video, (result) => {
        if (cancelled || !result) return;
        const text = result.getText?.() || String(result.text || '');
        if (text) void handleDetected(text);
      });
    };

    const failDenied = () => {
      if (cancelled) return;
      setStatus('denied');
      setStatusText(deniedHint);
      stopCamera();
    };

    const start = async () => {
      if (!supportsCamera()) {
        setStatus('unsupported');
        setStatusText(unsupportedHint);
        return;
      }
      setStatus('starting');
      setStatusText(permissionLabel);
      permissionTimer = window.setTimeout(() => {
        if (!cancelled) failDenied();
      }, 12000);

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });
        window.clearTimeout(permissionTimer);
        permissionTimer = 0;
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        try {
          const track = stream.getVideoTracks?.()?.[0];
          const caps = track?.getCapabilities?.();
          if (caps?.focusMode && Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
            await track.applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch {
          /* optional AF */
        }
        probeTorch(stream);

        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        if (supportsBarcodeDetector()) {
          let formats = SCAN_FORMATS;
          try {
            const supported = await window.BarcodeDetector.getSupportedFormats?.();
            if (Array.isArray(supported) && supported.length) {
              formats = SCAN_FORMATS.filter((f) => supported.includes(f));
              if (!formats.length) formats = supported.slice(0, 8);
            }
          } catch {
            /* use defaults */
          }
          detectorRef.current = new window.BarcodeDetector({ formats });
          video.srcObject = stream;
          video.setAttribute('playsinline', 'true');
          video.muted = true;
          await video.play();
          if (cancelled) return;
          setStatus('ready');
          setStatusText(scanningLabel);
          startNativeLoop();
          return;
        }

        /* ZXing fallback (desktop Safari / older WebViews) */
        await startZxingLoop(stream);
        if (cancelled) return;
        setStatus('ready');
        setStatusText(scanningLabel);
      } catch (err) {
        window.clearTimeout(permissionTimer);
        permissionTimer = 0;
        if (cancelled) return;
        const name = String(err?.name || '');
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          failDenied();
        } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
          setStatus('unsupported');
          setStatusText(unsupportedHint);
          stopCamera();
        } else {
          setStatus('error');
          setStatusText(unsupportedHint);
          stopCamera();
        }
      }
    };

    void start();

    return () => {
      cancelled = true;
      if (permissionTimer) window.clearTimeout(permissionTimer);
      stopCamera();
    };
  }, [
    open,
    retryToken,
    deniedHint,
    handleDetected,
    permissionLabel,
    scanningLabel,
    stopCamera,
    unsupportedHint,
  ]);

  if (!open || typeof document === 'undefined') return null;

  const showVideo = status === 'starting' || status === 'ready';
  const canRetry = status === 'denied' || status === 'error' || status === 'unsupported';

  return createPortal(
    <div
      className="pos-cam-scan-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="pos-cam-scan">
        <header className="pos-cam-scan__head">
          <div>
            <h2>{title}</h2>
            <p>{hint}</p>
          </div>
          <div className="pos-cam-scan__head-actions">
            {torchAvailable && showVideo ? (
              <button
                type="button"
                className={`pos-cam-scan__torch${torchOn ? ' is-on' : ''}`}
                onClick={() => void toggleTorch()}
                aria-pressed={torchOn}
                title={torchOn ? torchOffLabel : torchOnLabel}
              >
                {torchOn ? torchOffLabel : torchOnLabel}
              </button>
            ) : null}
            <button type="button" className="pos-cam-scan__close" onClick={onClose}>
              {closeLabel}
            </button>
          </div>
        </header>

        <div className={`pos-cam-scan__stage${showVideo ? '' : ' pos-cam-scan__stage--message'}`}>
          {showVideo ? (
            <>
              <video ref={videoRef} className="pos-cam-scan__video" playsInline muted autoPlay />
              {status === 'ready' ? <div className="pos-cam-scan__frame" aria-hidden="true" /> : null}
              {flash ? (
                <div
                  className={`pos-cam-scan__flash pos-cam-scan__flash--${flash.type}`}
                  role="status"
                  aria-live="polite"
                >
                  {flash.text}
                </div>
              ) : null}
            </>
          ) : (
            <p className="pos-cam-scan__message">
              {statusText || unsupportedHint}
            </p>
          )}
        </div>

        {showVideo && statusText && !flash ? (
          <p className="pos-cam-scan__status">{statusText}</p>
        ) : null}

        <div className="pos-cam-scan__actions">
          {canRetry ? (
            <button
              type="button"
              className="pos-cam-scan__done"
              onClick={() => setRetryToken((n) => n + 1)}
            >
              Retry
            </button>
          ) : null}
          <button type="button" className="pos-cam-scan__done pos-cam-scan__done--secondary" onClick={onClose}>
            {closeLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export { supportsBarcodeDetector, supportsCamera };
