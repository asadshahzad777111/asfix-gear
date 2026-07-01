import { SHOP, directionsContactPath, generalContactPath } from '../config/shop';
import { Link } from 'react-router-dom';
import OpenBadge from './OpenBadge';
import { useTranslation } from '../context/LanguageContext';

export default function LocationSection({ showMap = true }) {
  const { t } = useTranslation();

  return (
    <section className="location-section">
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
              {SHOP.landmark && <p className="location-landmark">📌 {SHOP.landmark}</p>}
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
                {t('location.directions')} ↗
              </a>
              <a
                href={SHOP.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-outline"
              >
                {t('location.googleMaps')}
              </a>
              <Link
                to={directionsContactPath()}
                className="btn btn-whatsapp"
              >
                {t('common.getDirections')}
              </Link>
              <Link
                to={generalContactPath()}
                className="btn btn-outline"
              >
                {t('nav.whatsapp')}
              </Link>
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
