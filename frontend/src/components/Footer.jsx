import { Link } from 'react-router-dom';
import Logo from './Logo';
import { SHOP, directionsContactPath, generalContactPath } from '../config/shop';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';

export default function Footer() {
  const { isStaff } = useAuth();
  const { t } = useTranslation();

  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" aria-label={SHOP.name}>
            <Logo size={44} showText />
          </Link>
          <p>{t('footer.tagline')}</p>
          <div className="footer-meta">
            <strong>📍 {SHOP.addressLine1}</strong>
            <p>{SHOP.addressLine2}</p>
            <p>📞 {SHOP.phone} · 🕐 {t('shop.hours')}</p>
          </div>
        </div>

        <div className="footer-nav-columns">
          <div className="footer-col footer-col--explore">
            <h4>{t('common.explore')}</h4>
            <ul className="footer-links">
              <li><Link to="/gaming">🎮 {t('common.gamingZone')}</Link></li>
              <li><Link to="/shop">{t('common.accessoriesShop')}</Link></li>
              {isStaff && <li><Link to="/shop?add=1">{t('common.addProductStaff')}</Link></li>}
              <li><Link to="/repair">{t('common.bookRepair')}</Link></li>
              <li><Link to="/contact">{t('common.contactMap')}</Link></li>
            </ul>
          </div>

          <div className="footer-col footer-col--contact">
            <h4>{t('nav.contact')}</h4>
            <ul className="footer-links">
              <li><a href={`tel:+${SHOP.phoneIntl}`}>{SHOP.phone}</a></li>
              <li><a href={`mailto:${SHOP.email}`}>{SHOP.email}</a></li>
              <li>
                <a href={SHOP.mapsUrl} target="_blank" rel="noopener noreferrer">
                  {t('location.googleMaps')}
                </a>
              </li>
              <li>
                <Link to={generalContactPath()}>
                  {t('nav.whatsapp')}
                </Link>
              </li>
              <li>
                <Link to={directionsContactPath()}>
                  {t('common.getDirections')}
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <div className="container footer-bottom">
        © {new Date().getFullYear()} {SHOP.name} — {SHOP.owner}. {t('footer.crafted')}
      </div>
    </footer>
  );
}
