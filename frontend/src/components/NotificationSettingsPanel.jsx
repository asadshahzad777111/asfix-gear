import { useEffect, useState } from 'react';
import {
  CUSTOMER_DEFAULTS,
  STAFF_DEFAULTS,
  getCustomerNotifPrefs,
  getStaffNotifPrefs,
  setCustomerNotifPrefs,
  setStaffNotifPrefs,
} from '../utils/notificationPrefs';
import { ensureStaffNotifyPermissions, isCapacitorNative } from '../utils/staffOrderNotify';
import './notification-settings.css';

function Toggle({ checked, onChange, id, disabled }) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      className={`asfix-notif-switch${checked ? ' is-on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="asfix-notif-switch__knob" aria-hidden />
    </button>
  );
}

function Row({ title, subtitle, checked, onChange, disabled, trailing }) {
  return (
    <div className={`asfix-notif-row${disabled ? ' is-disabled' : ''}`}>
      <div className="asfix-notif-row__text">
        <span className="asfix-notif-row__title">{title}</span>
        {subtitle ? <span className="asfix-notif-row__sub">{subtitle}</span> : null}
      </div>
      {trailing != null ? trailing : <Toggle checked={checked} onChange={onChange} disabled={disabled} />}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="asfix-notif-section">
      <h3 className="asfix-notif-section__label">{title}</h3>
      <div className="asfix-notif-card">{children}</div>
    </section>
  );
}

/**
 * WhatsApp-style notification settings for AsFix.
 * @param {{ mode: 'staff' | 'customer' }} props
 */
export default function NotificationSettingsPanel({ mode = 'staff' }) {
  const isStaff = mode === 'staff';
  const [staff, setStaff] = useState(() => getStaffNotifPrefs());
  const [customer, setCustomer] = useState(() => getCustomerNotifPrefs());
  const [permHint, setPermHint] = useState('');

  useEffect(() => {
    const sync = () => {
      setStaff(getStaffNotifPrefs());
      setCustomer(getCustomerNotifPrefs());
    };
    window.addEventListener('asfix-notif-prefs', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('asfix-notif-prefs', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const patchStaff = (patch) => {
    const next = setStaffNotifPrefs(patch);
    setStaff(next);
  };

  const patchCustomer = (patch) => {
    const next = setCustomerNotifPrefs(patch);
    setCustomer(next);
  };

  const enablePhonePermission = async () => {
    setPermHint('');
    try {
      // Must be from this button tap — Android 13+ ignores silent permission asks.
      const r = await ensureStaffNotifyPermissions({ forceAsk: true });
      if (r.native || r.browser) {
        patchStaff({ orderPhone: true, orderShow: true });
        setPermHint(isCapacitorNative() ? 'Phone notifications allowed.' : 'Browser notifications allowed.');
      } else if (r.display === 'denied') {
        setPermHint(
          'Blocked — Phone Settings → Apps → AsFix POS → Notifications → Allow, then tap again.',
        );
      } else {
        setPermHint('Permission not granted — Allow dabao jab Android dialog aaye.');
      }
    } catch {
      setPermHint('Could not request permission.');
    }
  };

  if (isStaff) {
    return (
      <div className="asfix-notif-panel">
        <header className="asfix-notif-panel__head">
          <h2 className="asfix-notif-panel__title">Notifications</h2>
          <p className="asfix-notif-panel__lead">
            Order alerts, cancel requests, aur customer marketing — is phone / APK ke liye.
            Phone alert ke liye pehle <strong>Enable phone permission</strong> dabao (Android
            Allow dialog).
          </p>
        </header>

        <Section title="Order alerts">
          <Row
            title="Show notifications"
            subtitle="Naya online order aaye to alert"
            checked={staff.orderShow}
            onChange={(v) => patchStaff({ orderShow: v })}
          />
          <Row
            title="Sound"
            subtitle="Beep + vibrate jab order aaye"
            checked={staff.orderSound}
            onChange={(v) => patchStaff({ orderSound: v })}
            disabled={!staff.orderShow}
          />
          <Row
            title="In-app toast"
            subtitle="Screen pe banner (Open Admin / PostEx)"
            checked={staff.orderToast}
            onChange={(v) => patchStaff({ orderToast: v })}
            disabled={!staff.orderShow}
          />
          <Row
            title="Phone notification"
            subtitle={isCapacitorNative() ? 'Android status bar / lock screen' : 'Browser notification'}
            checked={staff.orderPhone}
            onChange={(v) => {
              if (v) void enablePhonePermission();
              else patchStaff({ orderPhone: false });
            }}
            disabled={!staff.orderShow}
          />
        </Section>

        <Section title="Cancel / refund">
          <Row
            title="Show notifications"
            subtitle="Customer cancel ya refund maange"
            checked={staff.cancelShow}
            onChange={(v) => patchStaff({ cancelShow: v })}
          />
          <Row
            title="Sound"
            checked={staff.cancelSound}
            onChange={(v) => patchStaff({ cancelSound: v })}
            disabled={!staff.cancelShow}
          />
        </Section>

        <Section title="Shop activity">
          <Row
            title="Repair bookings"
            subtitle="Nayi repair intake (jab alert ready ho)"
            checked={staff.repairShow}
            onChange={(v) => patchStaff({ repairShow: v })}
          />
          <Row
            title="Contact messages"
            subtitle="Website contact form / messages"
            checked={staff.messageShow}
            onChange={(v) => patchStaff({ messageShow: v })}
          />
        </Section>

        <Section title="Customer alerts (shop side)">
          <Row
            title="New arrivals"
            subtitle="Customers ko naye products ke alerts allow"
            checked={staff.customerNewArrivals}
            onChange={(v) => patchStaff({ customerNewArrivals: v })}
          />
          <Row
            title="Discounts & sales"
            subtitle="Customers ko discount / sale alerts allow"
            checked={staff.customerDiscounts}
            onChange={(v) => patchStaff({ customerDiscounts: v })}
          />
        </Section>

        <div className="asfix-notif-actions">
          <button type="button" className="asfix-notif-btn" onClick={() => void enablePhonePermission()}>
            Enable phone permission
          </button>
          <button
            type="button"
            className="asfix-notif-btn asfix-notif-btn--ghost"
            onClick={() => {
              const next = setStaffNotifPrefs({ ...STAFF_DEFAULTS });
              setStaff(next);
            }}
          >
            Reset defaults
          </button>
        </div>
        {permHint ? <p className="asfix-notif-hint">{permHint}</p> : null}
      </div>
    );
  }

  return (
    <div className="asfix-notif-panel asfix-notif-panel--customer">
      <header className="asfix-notif-panel__head">
        <h2 className="asfix-notif-panel__title">Notifications</h2>
        <p className="asfix-notif-panel__lead">
          Order updates, new arrivals, aur discounts — is device ke liye.
        </p>
      </header>

      <Section title="Order updates">
        <Row
          title="Show notifications"
          subtitle="Order place / status change"
          checked={customer.orderUpdates}
          onChange={(v) => patchCustomer({ orderUpdates: v })}
        />
      </Section>

      <Section title="New arrivals">
        <Row
          title="Show notifications"
          subtitle="Shop mein naya product aaye"
          checked={customer.newArrivals}
          onChange={(v) => patchCustomer({ newArrivals: v })}
        />
      </Section>

      <Section title="Discounts">
        <Row
          title="Show notifications"
          subtitle="Sale / discount offers"
          checked={customer.discounts}
          onChange={(v) => patchCustomer({ discounts: v })}
        />
      </Section>

      <div className="asfix-notif-actions">
        <button
          type="button"
          className="asfix-notif-btn asfix-notif-btn--ghost"
          onClick={() => {
            const next = setCustomerNotifPrefs({ ...CUSTOMER_DEFAULTS });
            setCustomer(next);
          }}
        >
          Reset defaults
        </button>
      </div>
    </div>
  );
}
