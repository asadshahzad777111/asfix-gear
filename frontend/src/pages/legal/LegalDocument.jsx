import { Link } from 'react-router-dom';
import PageHeader from '../../components/PageHeader';
import BackButton from '../../components/BackButton';
import DocumentHead from '../../components/seo/DocumentHead';
import { useTranslation } from '../../context/LanguageContext';
import { getLegalPage, LEGAL_UPDATED } from '../../content/legalPages';
import { generalContactPath } from '../../config/shop';

export default function LegalDocument({ pageKey }) {
  const { t, lang } = useTranslation();
  const doc = getLegalPage(pageKey, lang === 'roman' ? 'roman' : 'en');

  if (!doc) {
    return (
      <div className="container section">
        <BackButton to="/" label={t('nav.home')} className="back-nav-btn--spaced" />
        <div className="alert alert-error">{t('common.pageNotFound')}</div>
      </div>
    );
  }

  return (
    <>
      <DocumentHead
        title={doc.title}
        description={doc.intro.slice(0, 155)}
        path={`/${pageKey === 'shipping' ? 'shipping' : pageKey}`}
      />
      <PageHeader title={doc.title} subtitle={t('legal.lastUpdated', { date: LEGAL_UPDATED })} />
      <div className="container section legal-page">
        <BackButton to="/" label={t('nav.home')} className="back-nav-btn--spaced" />
        <p className="legal-intro">{doc.intro}</p>
        {doc.sections.map((section) => (
          <section key={section.heading} className="legal-section">
            <h2>{section.heading}</h2>
            {section.body.map((para) => (
              <p key={para}>{para}</p>
            ))}
          </section>
        ))}
        <p className="legal-contact-cta">
          <Link to={generalContactPath()} className="btn btn-outline btn-sm">
            {t('nav.contact')}
          </Link>
        </p>
      </div>
    </>
  );
}
