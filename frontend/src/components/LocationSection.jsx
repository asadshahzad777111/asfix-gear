import { SHOP, whatsappLink } from '../config/shop';
import { buildContactPrefill } from '../utils/contactPrefill';
import OpenBadge from './OpenBadge';
import { useTranslation } from '../context/LanguageContext';

const GENERAL_WHATSAPP_HREF = whatsappLink(buildContactPrefill({ type: 'general' }).message);

export default function LocationSection({ showMap = true }) {
  const { t } = useTranslation();

  return (
    <section className="location-section" data-section-strap={t('location.title')} id="home-location">
      <div className="container">
        <div className="section-head">
          <span className="eyebrow">📍 {t('location.eyebrow')}</span>
          <h2 className="section-title">{t('location.title')}</h2>
          <p className="section-subtitle">
            {t('location.subtitle', { shop: SHOP.name })}
          </p>
        </div>

        <div className="location-grid">
          <div className="location-info glass-card">
            <OpenBadge />

            <div className="location-detail">
              <span className="location-label">{t('location.address')}</span>
              <p className="location-address">{SHOP.addressLine1}</p>
              <p className="location-address">{SHOP.addressLine2}</p>
              <p className="location-landmark">📌 {t('location.landmark')}</p>
              <p className="location-city">{SHOP.city}</p>
              <p className="location-coords">📍 {SHOP.coordinates}</p>
            </div>

            <div className="location-detail">
              <span className="location-label">{t('location.contact')}</span>
              <a href={`tel:+${SHOP.phoneIntl}`} className="location-link">{SHOP.phone}</a>
              <a href={`mailto:${SHOP.email}`} className="location-link">{SHOP.email}</a>
            </div>

            <div className="location-detail">
              <span className="location-label">{t('location.hours')}</span>
              <p>{t('shop.hours')}</p>
            </div>

            <div className="location-actions">
              <a
                href={SHOP.mapsDirectionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary"
              >
                {t('common.getDirections')} ↗
              </a>
              <a
                href={GENERAL_WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
              >
                {t('nav.whatsapp')}
              </a>
            </div>
          </div>

          {showMap && (
            <div className="location-map glass-card">
              <iframe
                title="AsFix & Gear Location"
                src={SHOP.mapsEmbedUrl}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
