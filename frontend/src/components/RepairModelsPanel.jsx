import { REPAIR_DEVICE_BRANDS, generalRepairQuoteContactPath } from '../config/repairModels';
import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';

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
            <strong>{group.brand}</strong>
            <div className="repair-model-chips">
              {group.models.map((model) => (
                <Link
                  key={model}
                  to={generalRepairQuoteContactPath(`${group.brand} ${model}`)}
                  className="repair-model-chip"
                >
                  {model}
                </Link>
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
