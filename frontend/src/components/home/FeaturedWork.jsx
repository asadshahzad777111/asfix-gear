import { Link } from 'react-router-dom';
import { useTranslation } from '../../context/LanguageContext';
import Reveal from '../motion/Reveal';

const FEATURED = [
  { to: '/repair', index: '01', nameKey: 'home.featuredRepair', metaKey: 'home.featuredRepairMeta' },
  { to: '/shop', index: '02', nameKey: 'home.featuredShop', metaKey: 'home.featuredShopMeta' },
  { to: '/gaming', index: '03', nameKey: 'home.featuredGaming', metaKey: 'home.featuredGamingMeta' },
  { to: '/contact', index: '04', nameKey: 'home.featuredContact', metaKey: 'home.featuredContactMeta' },
];

export default function FeaturedWork() {
  const { t } = useTranslation();

  return (
    <section className="loco-featured" aria-labelledby="featured-work-title">
      <div className="container">
        <Reveal className="loco-featured__head">
          <h2 id="featured-work-title" className="loco-featured__title">
            {t('home.featuredWork')}
          </h2>
          <span className="loco-featured__count">{t('home.featuredWorkCount')}</span>
        </Reveal>

        <ul className="loco-featured__list">
          {FEATURED.map((item, i) => (
            <Reveal key={item.to} as="li" className="loco-featured__item" delay={i * 60}>
              <Link to={item.to} className="loco-featured__link">
                <span className="loco-featured__index">{item.index}</span>
                <h3 className="loco-featured__name">{t(item.nameKey)}</h3>
                <span className="loco-featured__meta">{t(item.metaKey)}</span>
              </Link>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
