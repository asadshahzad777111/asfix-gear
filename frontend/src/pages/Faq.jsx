import { useState } from 'react';
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
  const [openIndex, setOpenIndex] = useState(0);

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
        <p className="legal-intro faq-intro">{doc.intro}</p>
        <div className="faq-accordion">
          {doc.items.map((item, i) => {
            const isOpen = openIndex === i;
            return (
              <section
                key={item.q}
                className={`legal-section faq-item${isOpen ? ' is-open' : ''}`}
              >
                <h2 className="faq-item-heading">
                  <button
                    type="button"
                    className="faq-item-trigger"
                    aria-expanded={isOpen}
                    aria-controls={`faq-panel-${i}`}
                    id={`faq-trigger-${i}`}
                    onClick={() => setOpenIndex(isOpen ? -1 : i)}
                  >
                    <span>{item.q}</span>
                    <span className="faq-item-chevron" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4">
                        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                </h2>
                {isOpen && (
                  <div
                    id={`faq-panel-${i}`}
                    role="region"
                    aria-labelledby={`faq-trigger-${i}`}
                    className="faq-item-panel"
                  >
                    <p>{item.a}</p>
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <p className="legal-contact-cta">
          <Link to={generalContactPath()} className="btn btn-outline btn-sm">
            {t('nav.contact')}
          </Link>
          <Link to="/shipping" className="btn btn-outline btn-sm">
            {t('footer.shipping')}
          </Link>
        </p>
      </div>
    </>
  );
}
