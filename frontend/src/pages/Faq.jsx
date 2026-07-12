import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import BackButton from '../components/BackButton';
import DocumentHead from '../components/seo/DocumentHead';
import { useTranslation } from '../context/LanguageContext';
import { getFaqPage, FAQ_UPDATED } from '../content/faqPages';
import { generalContactPath } from '../config/shop';

export default function Faq() {
  const { t, lang } = useTranslation();
  const doc = getFaqPage(lang === 'roman' ? 'roman' : 'en');

  return (
    <>
      <DocumentHead
        title={doc.title}
        description={doc.intro.slice(0, 155)}
        path="/faq"
      />
      <PageHeader title={doc.title} subtitle={t('legal.lastUpdated', { date: FAQ_UPDATED })} />
      <div className="container section legal-page faq-page">
        <BackButton to="/" label={t('nav.home')} className="back-nav-btn--spaced" />
        <p className="legal-intro">{doc.intro}</p>
        {doc.items.map((item) => (
          <section key={item.q} className="legal-section faq-item">
            <h2>{item.q}</h2>
            <p>{item.a}</p>
          </section>
        ))}
        <p className="legal-contact-cta">
          <Link to={generalContactPath()} className="btn btn-outline btn-sm">
            {t('nav.contact')}
          </Link>
          {' '}
          <Link to="/shipping" className="btn btn-outline btn-sm">
            {t('footer.shipping')}
          </Link>
        </p>
      </div>
    </>
  );
}
