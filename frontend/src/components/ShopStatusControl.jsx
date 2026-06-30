import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useShopStatus } from '../context/ShopStatusContext';
import { useTranslation } from '../context/LanguageContext';

export default function ShopStatusControl({ compact = false }) {
  const { isStaff } = useAuth();
  const { manual_override, isOpen, setManualOverride } = useShopStatus();
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  if (!isStaff) return null;

  const apply = async (value) => {
    setBusy(true);
    try {
      await setManualOverride(value);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const statusLabel =
    manual_override === 'open'
      ? t('shop.statusForcedOpen')
      : manual_override === 'closed'
        ? t('shop.statusForcedClosed')
        : t('shop.statusAuto');

  return (
    <div className={`shop-status-control glass-card ${compact ? 'shop-status-control--compact' : ''}`}>
      <div className="shop-status-control-head">
        <div>
          <h4>{t('admin.shopControl')}</h4>
          {!compact && <p className="shop-status-control-hint">{t('shop.manualHint')}</p>}
        </div>
        <span className={`shop-status-live ${isOpen ? 'is-open' : 'is-closed'}`}>
          {isOpen ? t('shop.openNow') : t('shop.closedOpens')}
        </span>
      </div>
      <p className="shop-status-control-mode">{statusLabel}</p>
      <div className="shop-status-control-btns">
        <button
          type="button"
          className={`btn btn-sm ${manual_override == null ? 'btn-primary' : 'btn-outline'}`}
          disabled={busy}
          onClick={() => apply(null)}
        >
          {t('shop.manualAuto')}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${manual_override === 'open' ? 'btn-primary' : 'btn-outline'}`}
          disabled={busy}
          onClick={() => apply('open')}
        >
          {t('shop.manualOpen')}
        </button>
        <button
          type="button"
          className={`btn btn-sm ${manual_override === 'closed' ? 'btn-primary' : 'btn-outline'}`}
          disabled={busy}
          onClick={() => apply('closed')}
        >
          {t('shop.manualClose')}
        </button>
      </div>
    </div>
  );
}
