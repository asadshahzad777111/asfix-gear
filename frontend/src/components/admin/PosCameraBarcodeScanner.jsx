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

function supportsBarcodeDetector() {
  return typeof window !== 'undefined' && typeof window.BarcodeDetector === 'function';
}

function supportsCamera() {
  return (
    typeof navigator !== 'undefined'
    && Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

/**
 * Full-screen camera barcode scanner for POS Sale bill.
 * Uses native BarcodeDetector when available (Chrome / Android WebView).
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
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(0);
  const lastCodeRef = useRef('');
  const lastAtRef = useRef(0);
  const onDetectedRef = useRef(onDetected);
  const [status, setStatus] = useState('idle'); /* idle | starting | ready | unsupported | denied | error */
  const [statusText, setStatusText] = useState('');
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    onDetectedRef.current = onDetected;
  }, [onDetected]);

  const stopCamera = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
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
  }, []);

  const handleDetected = useCallback((raw) => {
    const code = String(raw || '').trim();
    if (!code) return;
    const now = Date.now();
    if (code === lastCodeRef.current && now - lastAtRef.current < 1600) return;
    lastCodeRef.current = code;
    lastAtRef.current = now;
    onDetectedRef.current?.(code);
  }, []);

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
      return undefined;
    }

    let cancelled = false;
    let permissionTimer = 0;

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      const detector = detectorRef.current;
      if (video && detector && video.readyState >= 2) {
        try {
          const codes = await detector.detect(video);
          if (!cancelled && codes?.length) {
            const value = codes[0]?.rawValue;
            if (value) handleDetected(value);
          }
        } catch {
          /* frame skipped */
        }
      }
      if (!cancelled) {
        rafRef.current = requestAnimationFrame(() => {
          void tick();
        });
      }
    };

    const failDenied = () => {
      if (cancelled) return;
      setStatus('denied');
      setStatusText(deniedHint);
      stopCamera();
    };

    const start = async () => {
      if (!supportsCamera() || !supportsBarcodeDetector()) {
        setStatus('unsupported');
        setStatusText(unsupportedHint);
        return;
      }
      setStatus('starting');
      setStatusText(permissionLabel);
      // Old APKs without CAMERA never show a system prompt — don't soft-lock on "Allow…"
      permissionTimer = window.setTimeout(() => {
        if (!cancelled) failDenied();
      }, 12000);
      try {
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
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        window.clearTimeout(permissionTimer);
        permissionTimer = 0;
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        video.srcObject = stream;
        video.setAttribute('playsinline', 'true');
        video.muted = true;
        await video.play();
        if (cancelled) return;
        setStatus('ready');
        setStatusText(scanningLabel);
        rafRef.current = requestAnimationFrame(() => {
          void tick();
        });
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
          <button type="button" className="pos-cam-scan__close" onClick={onClose}>
            {closeLabel}
          </button>
        </header>

        <div className={`pos-cam-scan__stage${showVideo ? '' : ' pos-cam-scan__stage--message'}`}>
          {showVideo ? (
            <>
              <video ref={videoRef} className="pos-cam-scan__video" playsInline muted autoPlay />
              {status === 'ready' ? <div className="pos-cam-scan__frame" aria-hidden="true" /> : null}
            </>
          ) : (
            <p className="pos-cam-scan__message">
              {statusText || unsupportedHint}
            </p>
          )}
        </div>

        {showVideo && statusText ? (
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
