import { useShopStatus } from '../context/ShopStatusContext';
import { useTranslation } from '../context/LanguageContext';

export default function OpenBadge({ compact = false }) {
  const { isOpen } = useShopStatus();
  const { t } = useTranslation();

  const openLabel = compact ? t('shop.openBadgeShort') : t('shop.openNow');
  const closedLabel = compact ? t('shop.closedBadgeShort') : t('shop.closedOpens');

  return (
    <span
      className={`open-badge ${compact ? 'open-badge--compact' : ''} ${isOpen ? 'is-open' : 'is-closed'}`}
      title={isOpen ? t('shop.openNow') : t('shop.closedOpens')}
    >
      <span className="open-badge-pulse" />
      {isOpen ? openLabel : closedLabel}
    </span>
  );
}

export function OpenBadgeLarge() {
  const { isOpen } = useShopStatus();
  const { t } = useTranslation();

  return (
    <div className={`open-card ${isOpen ? 'is-open' : 'is-closed'}`}>
      <div className="open-card-icon">{isOpen ? '🟢' : '🔴'}</div>
      <div>
        <strong>{isOpen ? t('shop.openLarge') : t('shop.closedLarge')}</strong>
        <p>{t('shop.hours')}</p>
      </div>
    </div>
  );
}
