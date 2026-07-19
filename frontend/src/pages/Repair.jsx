import { useEffect, useState } from 'react';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import RepairSteps from '../components/RepairSteps';
import RepairIntakeForm from '../components/RepairIntakeForm';
import RepairServiceCard from '../components/RepairServiceCard';
import RepairModelsPanel from '../components/RepairModelsPanel';
import ScreenQualityPicker from '../components/ScreenQualityPicker';
import { SHOP } from '../config/shop';
import { useTranslation } from '../context/LanguageContext';

export default function Repair() {
  const { t } = useTranslation();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [screenQuality, setScreenQuality] = useState('');

  useEffect(() => {
    api.getRepairServices().then(setServices).catch(console.error).finally(() => setLoading(false));
  }, []);

  return (
    <div className="repair-page">
      <PageHeader
        eyebrow={`🔧 ${t('repair.eyebrow')}`}
        title={t('repair.title')}
        subtitle={t('repair.subtitle', { owner: SHOP.owner })}
      />

      <section
        className="section repair-page-block repair-steps-section"
        data-section-strap={t('repair.howItWorks')}
        id="repair-steps"
      >
        <div className="container">
          <RepairSteps />
        </div>
      </section>

      {/* Supported devices (company + photo cards) — keep near top so the change is visible */}
      <section
        id="supported-devices"
        className="section repair-page-block repair-page-block--models"
        data-section-strap={t('repair.modelsEyebrow')}
      >
        <div className="container">
          <RepairModelsPanel />
        </div>
      </section>

      <section
        className="section repair-page-block repair-page-block--intake repair-intake-section-wrap"
        data-section-strap={t('repair.intakeTitle')}
        id="repair-intake"
      >
        <div className="container">
          <RepairIntakeForm />
        </div>
      </section>

      <section
        className="section repair-page-block repair-page-block--screen"
        data-section-strap={t('repair.screenEyebrow')}
        id="repair-screen-quality"
      >
        <div className="container">
          <ScreenQualityPicker
            deviceLabel={t('repair.myPhone')}
            selected={screenQuality}
            onSelect={setScreenQuality}
          />
        </div>
      </section>

      <section
        className="section repair-page-block repair-page-block--services"
        data-section-strap={t('repair.servicesTitle')}
        id="repair-services"
      >
        <div className="container">
          <div className="section-head">
            <span className="eyebrow">{t('repair.servicesEyebrow')}</span>
            <h2 className="section-title">{t('repair.servicesTitle')}</h2>
            <p className="section-subtitle">{t('repair.servicesSub')}</p>
          </div>

          {loading ? (
            <div className="loading">{t('common.loading')}</div>
          ) : (
            <div className="services-grid">
              {services.map((service) => (
                <RepairServiceCard key={service.id} service={service} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
