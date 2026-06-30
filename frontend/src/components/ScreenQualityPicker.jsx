import { SCREEN_QUALITY_TIERS, screenQualityWhatsApp } from '../config/repairIntake';

import { useTranslation } from '../context/LanguageContext';



export default function ScreenQualityPicker({

  selected = '',

  onSelect,

  deviceLabel = '',

  showWhatsApp = true,

  compact = false,

}) {

  const { t } = useTranslation();



  const tierText = (tier) => ({

    badge: t(`screenQuality.${tier.id}.badge`),

    label: t(`screenQuality.${tier.id}.label`),

    description: t(`screenQuality.${tier.id}.description`),

    points: [

      t(`screenQuality.${tier.id}.p1`),

      t(`screenQuality.${tier.id}.p2`),

      t(`screenQuality.${tier.id}.p3`),

    ],

    warranty: t(`screenQuality.${tier.id}.warranty`),

  });



  const selectedTier = SCREEN_QUALITY_TIERS.find((tier) => tier.id === selected);

  const selectedLabel = selectedTier ? tierText(selectedTier).label : selected;



  return (

    <div className={`screen-quality-panel ${compact ? 'compact' : ''}`}>

      <div className="screen-quality-head">

        <span className="eyebrow">📱 {t('repair.screenEyebrow')}</span>

        <h3>{t('repair.screenTitle')}</h3>

        <p>{t('repair.screenDesc')}</p>

      </div>



      <div className="screen-quality-grid">

        {SCREEN_QUALITY_TIERS.map((tier) => {

          const copy = tierText(tier);

          return (

            <button

              key={tier.id}

              type="button"

              className={`screen-quality-card glass-card ${selected === tier.id ? 'active' : ''}`}

              onClick={() => onSelect?.(tier.id)}

            >

              <span className={`screen-quality-badge tier-${tier.id}`}>{copy.badge}</span>

              <h4>{copy.label}</h4>

              <p className="screen-quality-desc">{copy.description}</p>

              <ul className="screen-quality-points">

                {copy.points.map((point) => (

                  <li key={point}>{point}</li>

                ))}

              </ul>

              <span className="screen-quality-warranty">🛡️ {copy.warranty}</span>

            </button>

          );

        })}

      </div>



      {showWhatsApp && (

        <div className="screen-quality-actions">

          {selected ? (

            <a

              href={screenQualityWhatsApp(deviceLabel, selected)}

              target="_blank"

              rel="noopener noreferrer"

              className="btn btn-whatsapp btn-block"

            >

              💬 {t('repair.screenWaConfirm', { quality: selectedLabel })}

            </a>

          ) : (

            <p className="field-hint">{t('repair.screenHint')}</p>

          )}

          <a

            href={screenQualityWhatsApp(deviceLabel, 'compare')}

            target="_blank"

            rel="noopener noreferrer"

            className="btn btn-outline btn-block"

          >

            💬 {t('repair.screenCompare')}

          </a>

        </div>

      )}

    </div>

  );

}

