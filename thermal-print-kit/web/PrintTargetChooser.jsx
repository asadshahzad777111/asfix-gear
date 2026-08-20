import { useEffect, useState } from 'react';
import {
  defaultPrintTarget,
  fetchPrintStations,
  isAppleMobileDevice,
  writePrintTarget,
} from './remoteThermalPrint';
import './print-target-chooser.css';

/**
 * Modal to pick local vs remote thermal print station.
 * Kit version: no i18n context — plain English defaults, overridable via `labels`.
 */
const DEFAULT_LABELS = {
  title: 'Where to print?',
  sub: 'Pick a printer / station for this receipt.',
  local: 'This device',
  localHint: 'Print on the printer connected to this device.',
  ios: 'Send to a station',
  localIosHint: 'iPhone cannot Bluetooth-print — send to Android or laptop station.',
  android: 'Android POS station',
  androidHint: 'An Android phone running the POS app with a paired printer.',
  laptop: 'Laptop station',
  laptopHint: 'A laptop running the print bridge (npm run thermal:bridge).',
  any: 'Any online station',
  anyHint: 'Send to whichever station is online.',
  online: 'Online',
  offline: 'Offline',
  checking: 'Checking…',
  noStation: 'No print station online right now.',
  cancel: 'Cancel',
  confirm: 'Print',
  sending: 'Sending…',
};

export default function PrintTargetChooser({
  open,
  onClose,
  onSelect,
  busy = false,
  initialTarget = null,
  labels = {},
}) {
  const L = { ...DEFAULT_LABELS, ...labels };
  const [target, setTarget] = useState(() => initialTarget || defaultPrintTarget());
  const [stations, setStations] = useState({ android: { online: false }, laptop: { online: false } });
  const [loadingStations, setLoadingStations] = useState(false);
  const ios = isAppleMobileDevice();

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

  if (!open) return null;

  const androidOnline = Boolean(stations?.android?.online);
  const laptopOnline = Boolean(stations?.laptop?.online);
  const anyOnline = androidOnline || laptopOnline;

  const options = [
    { id: 'local', title: ios ? L.ios : L.local, hint: ios ? L.localIosHint : L.localHint, online: true, highlight: !ios },
    { id: 'android', title: L.android, hint: L.androidHint, online: androidOnline, highlight: ios },
    { id: 'laptop', title: L.laptop, hint: L.laptopHint, online: laptopOnline, highlight: false },
    { id: 'any', title: L.any, hint: L.anyHint, online: anyOnline, highlight: ios },
  ];

  const confirm = () => {
    writePrintTarget(target);
    onSelect?.(target, { stations });
  };

  return (
    <div className="print-target-chooser" role="dialog" aria-modal="true" aria-label={L.title}>
      <button type="button" className="print-target-chooser__backdrop" aria-label={L.cancel} onClick={onClose} />
      <div className="print-target-chooser__card glass-card">
        <div className="print-target-chooser__head">
          <h3>{L.title}</h3>
          <p>{L.sub}</p>
        </div>

        <div className="print-target-chooser__options" role="radiogroup" aria-label={L.title}>
          {options.map((opt) => (
            <label
              key={opt.id}
              className={[
                'print-target-chooser__option',
                target === opt.id ? 'is-selected' : '',
                opt.highlight ? 'is-preferred' : '',
                opt.id !== 'local' && !opt.online ? 'is-offline' : '',
              ].filter(Boolean).join(' ')}
            >
              <input
                type="radio"
                name="pos-print-target"
                value={opt.id}
                checked={target === opt.id}
                onChange={() => setTarget(opt.id)}
                disabled={busy}
              />
              <span className="print-target-chooser__option-body">
                <strong>{opt.title}</strong>
                <span>{opt.hint}</span>
                {opt.id !== 'local' ? (
                  <em className={opt.online ? 'is-on' : 'is-off'}>
                    {loadingStations ? L.checking : opt.online ? L.online : L.offline}
                  </em>
                ) : null}
              </span>
            </label>
          ))}
        </div>

        {!anyOnline ? <p className="print-target-chooser__warn">{L.noStation}</p> : null}

        <div className="print-target-chooser__foot">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {L.cancel}
          </button>
          <button type="button" className="btn btn-primary" onClick={confirm} disabled={busy}>
            {busy ? L.sending : L.confirm}
          </button>
        </div>
      </div>
    </div>
  );
}
