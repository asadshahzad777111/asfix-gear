import { Link } from 'react-router-dom';
import { REPAIR_DEVICE_BRANDS, generalRepairQuoteContactPath } from '../../config/repairModels';
import { useTranslation } from '../../context/LanguageContext';

const POPULAR_MODELS = REPAIR_DEVICE_BRANDS.flatMap((group) =>
  group.models.slice(0, 2).map((model) => ({
    brand: group.brand,
    model,
    key: `${group.brand}-${model}`,
  }))
);

export default function ModelGrid() {
  const { t } = useTranslation();

  return (
    <section className="home-section">
      <div className="container">
        <div className="home-section-head">
          <span className="eyebrow">{t('home.modelsEyebrow')}</span>
          <h2 className="section-title">{t('home.chooseModel')}</h2>
          <p className="section-subtitle">{t('home.chooseModelSub')}</p>
        </div>
        <div className="home-model-grid">
          {POPULAR_MODELS.map(({ brand, model, key }) => (
            <Link
              key={key}
              to={generalRepairQuoteContactPath(`${brand} ${model}`)}
              className="home-model-card"
            >
              <span className="home-model-brand">{brand}</span>
              <span className="home-model-name">{model}</span>
              <span className="home-model-hint">{t('home.modelQuoteHint')}</span>
            </Link>
          ))}
        </div>
        <div className="text-center mt-2">
          <Link to="/repair" className="btn btn-ghost">
            {t('home.viewAllModels')} →
          </Link>
        </div>
      </div>
    </section>
  );
}
