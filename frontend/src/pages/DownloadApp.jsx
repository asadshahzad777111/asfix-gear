import { Link } from 'react-router-dom';
import { useTranslation } from '../context/LanguageContext';
import './download-app.css';

const POS_APK_HREF = '/downloads/AsFix-POS.apk';

export default function DownloadApp() {
  const { t } = useTranslation();

  return (
    <div className="download-app">
      <div className="container download-app__inner">
        <p className="download-app__eyebrow">{t('downloadApp.eyebrow')}</p>
        <h1 className="download-app__title">{t('downloadApp.title')}</h1>
        <p className="download-app__lead">{t('downloadApp.lead')}</p>

        <a
          className="btn btn-primary download-app__cta"
          href={POS_APK_HREF}
          download="AsFix-POS.apk"
          type="application/vnd.android.package-archive"
        >
          {t('downloadApp.downloadCta')}
        </a>

        <div className="download-app__notice" role="note">
          <strong>{t('downloadApp.noticeTitle')}</strong>
          <p>{t('downloadApp.noticeBody')}</p>
          <ul>
            <li>{t('downloadApp.tip1')}</li>
            <li>{t('downloadApp.tip2')}</li>
            <li>{t('downloadApp.tip3')}</li>
          </ul>
        </div>

        <p className="download-app__updates">{t('downloadApp.updates')}</p>

        <p className="download-app__back">
          <Link to="/">{t('downloadApp.backHome')}</Link>
          {' · '}
          <Link to="/pos">{t('downloadApp.openPos')}</Link>
        </p>
      </div>
    </div>
  );
}
