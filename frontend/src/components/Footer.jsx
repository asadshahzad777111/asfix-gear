import { Link } from 'react-router-dom';
import Logo from './Logo';
import { SHOP, directionsContactPath, generalContactPath, whatsappLink } from '../config/shop';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import { canManageProducts } from '../config/permissions';

export default function Footer() {
  const { isStaff, user } = useAuth();
  const canAddProducts = canManageProducts(user);
  const { t } = useTranslation();
  const waHref = whatsappLink(
    `Assalam o Alaikum! ${SHOP.name} — I have a question.`
  );

  return (
    <footer className="footer">
      <div className="footer-top-glow" aria-hidden="true" />

      <div className="container footer-grid">
        <div className="footer-brand">
          <Link to="/" className="footer-brand-link" aria-label={SHOP.name}>
            <Logo size={40} showText />
          </Link>
          <p className="footer-tagline">{t('footer.tagline')}</p>

          <div className="footer-meta">
            <strong className="footer-meta-place">{SHOP.addressLine1}</strong>
            <p>{SHOP.addressLine2}</p>
            <p className="footer-meta-hours">{t('shop.hours')}</p>
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
              <li><Link to="/wishlist">{t('wishlist.nav')}</Link></li>
              <li><Link to="/faq">{t('footer.faq')}</Link></li>
              <li><Link to="/contact">{t('common.contactMap')}</Link></li>
            </ul>
          </div>

          <div className="footer-col footer-col--contact">
            <h4>{t('nav.contact')}</h4>
            <ul className="footer-contact-list">
              <li className="footer-contact-row">
                <span className="footer-contact-label">{t('footer.phoneLabel')}</span>
                <a href={`tel:+${SHOP.phoneIntl}`} className="footer-contact-value">
                  {SHOP.phoneDisplay}
                </a>
              </li>
              <li className="footer-contact-row">
                <span className="footer-contact-label">{t('footer.emailLabel')}</span>
                <a href={`mailto:${SHOP.email}`} className="footer-contact-value footer-contact-value--email">
                  {SHOP.email}
                </a>
              </li>
              <li className="footer-contact-actions">
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="footer-contact-chip footer-contact-chip--wa"
                >
                  {t('nav.whatsapp')}
                </a>
                <a href={SHOP.mapsUrl} target="_blank" rel="noopener noreferrer" className="footer-contact-chip">
                  {t('location.googleMaps')}
                </a>
                <Link to={directionsContactPath()} className="footer-contact-chip">
                  {t('common.getDirections')}
                </Link>
              </li>
              <li>
                <Link to={generalContactPath()} className="footer-contact-link">
                  {t('footer.messageUs')}
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
