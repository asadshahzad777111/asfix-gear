import { REPAIR_DEVICE_BRANDS, generalRepairQuoteContactPath } from '../config/repairModels';
import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import SearchBrandIcon from './nav/SearchBrandIcon';
import { getShopBrandIdFromRepairBrand } from '../utils/brandIcon';
import ModelThumb from './ModelThumb';

export default function RepairModelsPanel() {
  const { t } = useTranslation();

  return (
    <div className="repair-models-panel">
      <div className="repair-models-head">
        <span className="eyebrow">{t('repair.modelsEyebrow')}</span>
        <h3>{t('repair.modelsHead')}</h3>
        <p>{t('repair.modelsDesc')}</p>
      </div>

      <div className="repair-models-list">
        {REPAIR_DEVICE_BRANDS.map((group) => {
          const models = group.series.flatMap((series) => series.models);
          return (
            <section key={group.brand} className="repair-brand-block">
              <h4 className="repair-brand-heading">
                <SearchBrandIcon brandId={getShopBrandIdFromRepairBrand(group.brand)} />
                <span>{group.brand}</span>
              </h4>
              <div className="repair-model-cards">
                {models.map((model) => (
                  <Link
                    key={model}
                    to={generalRepairQuoteContactPath(`${group.brand} ${model}`)}
                    className="repair-model-card"
                  >
                    <ModelThumb brand={group.brand} model={model} className="repair-model-card-img" />
                    <span className="repair-model-card-name">{model}</span>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <Link to={generalRepairQuoteContactPath()} className="btn btn-whatsapp btn-block">
        {t('repair.modelsWhatsApp')}
      </Link>
    </div>
  );
}
