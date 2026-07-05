import { useTranslation } from '../context/LanguageContext';

export default function RepairPhotosGrid({ photosBefore = [], photosAfter = [] }) {
  const { t } = useTranslation();
  const hasBefore = photosBefore.length > 0;
  const hasAfter = photosAfter.length > 0;

  if (!hasBefore && !hasAfter) return null;

  return (
    <div className="repair-photos-grid">
      {hasBefore && (
        <div className="repair-photos-group">
          <h4>{t('track.repairPhotosBefore')}</h4>
          <div className="repair-photos-row">
            {photosBefore.map((url, idx) => (
              <a key={`before-${idx}`} href={url} target="_blank" rel="noopener noreferrer" className="repair-photo-thumb">
                <img src={url} alt={t('track.repairPhotoBeforeAlt', { n: idx + 1 })} loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      )}
      {hasAfter && (
        <div className="repair-photos-group">
          <h4>{t('track.repairPhotosAfter')}</h4>
          <div className="repair-photos-row">
            {photosAfter.map((url, idx) => (
              <a key={`after-${idx}`} href={url} target="_blank" rel="noopener noreferrer" className="repair-photo-thumb">
                <img src={url} alt={t('track.repairPhotoAfterAlt', { n: idx + 1 })} loading="lazy" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
