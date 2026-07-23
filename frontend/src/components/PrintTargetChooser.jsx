import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from '../context/LanguageContext';
import {
  defaultPrintTarget,
  fetchPrintStations,
  isAppleMobileDevice,
  isDesktopDevice,
  writePrintTarget,
} from '../utils/remoteThermalPrint';
import './print-target-chooser.css';

const LOCAL_TARGETS = new Set(['direct', 'local']);

/**
 * Modal to pick Direct / local share vs remote thermal print station.
 * Same options on laptop and phone (Direct = system print on laptop, Share on phone).
 * Portaled to body above POS dock; dock is hidden while open (body.pos-modal-open).
 */
export default function PrintTargetChooser({
  open,
  onClose,
  onSelect,
  busy = false,
  initialTarget = null,
  mode = 'print', /* print | configure */
}) {
  const { t } = useTranslation();
  const [target, setTarget] = useState(() => initialTarget || defaultPrintTarget());
  const [stations, setStations] = useState({
    android: { online: false },
    laptop: { online: false },
  });
  const [loadingStations, setLoadingStations] = useState(false);
  const ios = isAppleMobileDevice();
  const desktop = isDesktopDevice();
  const configuring = mode === 'configure';

  useEffect(() => {
    if (!open) return undefined;
    setTarget(initialTarget || defaultPrintTarget());
    let cancelled = false;
    setLoadingStations(true);
    (async () => {
      const next = await fetchPrintStations();
      if (!cancelled) {
        setStations(next);
        setLoadingStations(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, initialTarget]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return undefined;
    const { body, documentElement } = document;
    const prevOverflow = body.style.overflow;
    body.classList.add('pos-modal-open');
    documentElement.classList.add('pos-modal-open');
    body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      body.classList.remove('pos-modal-open');
      documentElement.classList.remove('pos-modal-open');
      body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  const androidOnline = Boolean(stations?.android?.online);
  const laptopOnline = Boolean(stations?.laptop?.online);
  const anyOnline = androidOnline || laptopOnline;
  const needsStation = !LOCAL_TARGETS.has(target);

  const options = [
    {
      id: 'direct',
      title: t('admin.printTargetDirect'),
      hint: ios
        ? t('admin.printTargetDirectIosHint')
        : desktop
          ? t('admin.printTargetDirectHint')
          : t('admin.printTargetDirectMobileHint'),
      online: true,
      highlight: desktop || ios,
    },
    {
      id: 'local',
      title: ios ? t('admin.printTargetIos') : t('admin.printTargetLocal'),
      hint: ios ? t('admin.printTargetLocalIosHint') : t('admin.printTargetLocalHint'),
      online: true,
      highlight: false,
    },
    {
      id: 'android',
      title: t('admin.printTargetAndroid'),
      hint: t('admin.printTargetAndroidHint'),
      online: androidOnline,
      highlight: ios,
    },
    {
      id: 'laptop',
      title: t('admin.printTargetLaptop'),
      hint: t('admin.printTargetLaptopHint'),
      online: laptopOnline,
      highlight: false,
    },
    {
      id: 'any',
      title: t('admin.printTargetAny'),
      hint: t('admin.printTargetAnyHint'),
      online: anyOnline,
      highlight: false,
    },
  ];

  const confirm = () => {
    writePrintTarget(target);
    onSelect?.(target, { stations });
  };

  return createPortal(
    <div className="print-target-chooser" role="dialog" aria-modal="true" aria-label={t('admin.printTargetTitle')}>
      <button type="button" className="print-target-chooser__backdrop" aria-label={t('admin.printTargetCancel')} onClick={onClose} />
      <div className="print-target-chooser__card glass-card">
        <div className="print-target-chooser__head">
          <h3>{configuring ? t('admin.printStationBarTitle') : t('admin.printTargetTitle')}</h3>
          <p>{configuring ? (ios ? t('admin.printStationIosHint') : t('admin.printStationWebHint')) : t('admin.printTargetSub')}</p>
        </div>

        <div className="print-target-chooser__options" role="radiogroup" aria-label={t('admin.printTargetTitle')}>
          {options.map((opt) => (
            <label
              key={opt.id}
              className={[
                'print-target-chooser__option',
                target === opt.id ? 'is-selected' : '',
                opt.highlight ? 'is-preferred' : '',
                !LOCAL_TARGETS.has(opt.id) && !opt.online ? 'is-offline' : '',
              ].filter(Boolean).join(' ')}
            >
              <input
                type="radio"
                name="asfix-print-target"
                value={opt.id}
                checked={target === opt.id}
                onChange={() => setTarget(opt.id)}
                disabled={busy}
              />
              <span className="print-target-chooser__option-body">
                <strong>{opt.title}</strong>
                <span>{opt.hint}</span>
                {!LOCAL_TARGETS.has(opt.id) ? (
                  <em className={opt.online ? 'is-on' : 'is-off'}>
                    {loadingStations
                      ? t('admin.printTargetChecking')
                      : opt.online
                        ? t('admin.printTargetOnline')
                        : t('admin.printTargetOffline')}
                  </em>
                ) : (
                  <em className="is-on">{t('admin.printTargetNoStationNeeded')}</em>
                )}
              </span>
            </label>
          ))}
        </div>

        {needsStation && !anyOnline ? (
          <p className="print-target-chooser__warn">{t('admin.printTargetNoStation')}</p>
        ) : null}

        <div className="print-target-chooser__foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {t('admin.printTargetCancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy}>
            {busy
              ? t('admin.printTargetSending')
              : configuring
                ? t('admin.printStationSave')
                : t('admin.printTargetConfirm')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
