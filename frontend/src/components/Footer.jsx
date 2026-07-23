import { Link } from 'react-router-dom';
import Logo from './Logo';
import { SHOP, directionsContactPath, generalContactPath } from '../config/shop';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { canManageProducts } from '../config/permissions';

export default function Footer() {
  const { isStaff, user } = useAuth();
  const canAddProducts = canManageProducts(user);
  const { t } = useTranslation();

  return (
    <footer className="footer">
      <div className="footer-cta-band">
        <div className="container footer-cta-band__inner">
          <div className="footer-cta-band__copy">
            <strong className="footer-cta-band__title">{t('footer.ctaTitle')}</strong>
            <p className="footer-cta-band__sub">{t('footer.ctaSub')}</p>
          </div>
          <div className="footer-cta-band__actions">
            <Link to="/repair" className="btn btn-primary btn-sm">
              {t('common.bookRepair')}
            </Link>
            <Link to="/shop" className="btn btn-outline btn-sm">
              {t('common.accessoriesShop')}
            </Link>
          </div>
        </div>
      </div>

      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" aria-label={SHOP.name}>
            <Logo size={40} showText />
          </Link>
          <p>{t('footer.tagline')}</p>
          <div className="footer-meta">
            <strong>{SHOP.addressLine1}</strong>
            <p>{SHOP.addressLine2}</p>
            <p>{SHOP.phone} · {t('shop.hours')}</p>
          </div>
        </div>

        <div className="footer-nav-columns">
          <div className="footer-col footer-col--explore">
            <h4>{t('common.explore')}</h4>
            <ul className="footer-links">
              <li><Link to="/gaming">{t('common.gamingZone')}</Link></li>
              <li><Link to="/shop">{t('common.accessoriesShop')}</Link></li>
              {canAddProducts && <li><Link to="/shop?add=1">{t('common.addProductStaff')}</Link></li>}
              <li><Link to="/repair">{t('common.bookRepair')}</Link></li>
              <li><Link to="/faq">{t('footer.faq')}</Link></li>
              <li><Link to="/download">{t('footer.downloadApp')}</Link></li>
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

      <div className="container footer-legal">
        <ul className="footer-legal-links">
          <li><Link to="/faq">{t('footer.faq')}</Link></li>
          <li><Link to="/privacy">{t('footer.privacy')}</Link></li>
          <li><Link to="/terms">{t('footer.terms')}</Link></li>
          <li><Link to="/refund">{t('footer.refund')}</Link></li>
          <li><Link to="/shipping">{t('footer.shipping')}</Link></li>
        </ul>
      </div>

      <div className="container footer-bottom">
        <p className="footer-bottom-copy">
          © {new Date().getFullYear()} {SHOP.name} — {SHOP.owner}. {t('footer.crafted')}
          {typeof __ASFIX_BUILD_ID__ !== 'undefined'
            && !String(__ASFIX_BUILD_ID__).startsWith('local-') && (
            <>
              {' '}
              <span className="footer-build-id" title="Build id">
                · {__ASFIX_BUILD_ID__}
              </span>
            </>
          )}
        </p>
        {!isStaff && (
          <Link to="/login" className="footer-staff-login">
            {t('footer.staffLogin')}
          </Link>
        )}
      </div>
    </footer>
  );
}
