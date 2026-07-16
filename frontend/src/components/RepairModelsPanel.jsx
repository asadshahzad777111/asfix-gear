import { REPAIR_DEVICE_BRANDS, generalRepairQuoteContactPath } from '../config/repairModels';
import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import SearchBrandIcon from './nav/SearchBrandIcon';
import { getShopBrandIdFromRepairBrand } from '../utils/brandIcon';
import ModelThumb from './ModelThumb';

export default function RepairModelsPanel() {
  const { t } = useTranslation();

  return (
    <div className="repair-models-panel glass-card">
      <div className="repair-models-head">
        <span className="eyebrow">📱 {t('repair.modelsEyebrow')}</span>
        <h3>{t('repair.modelsHead')}</h3>
        <p>{t('repair.modelsDesc')}</p>
      </div>

      <div className="repair-models-grid">
        {REPAIR_DEVICE_BRANDS.map((group) => (
          <div key={group.brand} className="repair-model-group">
            <strong className="repair-model-group-brand">
              <SearchBrandIcon brandId={getShopBrandIdFromRepairBrand(group.brand)} />
              <span>{group.brand}</span>
            </strong>
            <div className="repair-model-group-body">
              {group.series.map((series) => (
                <div key={series.name} className="repair-model-series">
                  <span className="repair-model-series-name">{series.name}</span>
                  <div className="repair-model-chips">
                    {series.models.map((model) => (
                      <Link
                        key={model}
                        to={generalRepairQuoteContactPath(`${group.brand} ${model}`)}
                        className="repair-model-chip"
                      >
                        <ModelThumb brand={group.brand} model={model} />
                        <span>{model}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Link
        to={generalRepairQuoteContactPath()}
        className="btn btn-whatsapp btn-block"
      >
        💬 {t('repair.modelsWhatsApp')}
      </Link>
    </div>
  );
}
