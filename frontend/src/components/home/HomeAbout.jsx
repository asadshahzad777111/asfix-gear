import { Link } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import Reveal from '../motion/Reveal';

export default function HomeAbout() {
  const { t } = useTranslation();

  return (
    <section className="loco-about">
      <div className="container">
        <div className="loco-about__grid">
          <Reveal>
            <p className="loco-about__label">{t('home.aboutLabel')}</p>
          </Reveal>
          <Reveal delay={80}>
            <p className="loco-about__text">{t('home.aboutText')}</p>
            <Link to="/repair" className="loco-about__cta">
              {t('home.aboutCta')} →
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
