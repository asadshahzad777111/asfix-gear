import { Link } from 'react-router-dom';
import { useMemo } from 'react';
import { useTranslation } from '../context/LanguageContext';
import './download-app.css';

const POS_APK_HREF = '/downloads/AsFix-POS.apk';

function detectPlatform() {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
}

export default function DownloadApp() {
  const { t } = useTranslation();
  const platform = useMemo(() => detectPlatform(), []);

  return (
    <div className="download-app">
      <div className="container download-app__inner">
        <p className="download-app__eyebrow">{t('downloadApp.eyebrow')}</p>
        <h1 className="download-app__title">{t('downloadApp.title')}</h1>
        <p className="download-app__lead">{t('downloadApp.lead')}</p>

        <section className="download-app__card download-app__card--android" aria-labelledby="download-android-title">
          <h2 id="download-android-title">{t('downloadApp.androidTitle')}</h2>
          <p>{t('downloadApp.androidLead')}</p>
          <a
            className="btn btn-primary download-app__cta"
            href={POS_APK_HREF}
            download="AsFix-POS.apk"
            type="application/vnd.android.package-archive"
          >
            {t('downloadApp.downloadCta')}
          </a>
          {platform === 'ios' ? (
            <p className="download-app__platform-note">{t('downloadApp.androidOnIosNote')}</p>
          ) : null}
        </section>

        <section className="download-app__card download-app__card--ios" aria-labelledby="download-ios-title">
          <h2 id="download-ios-title">{t('downloadApp.iosTitle')}</h2>
          <p>{t('downloadApp.iosLead')}</p>
          <ol className="download-app__steps">
            <li>{t('downloadApp.iosStep1')}</li>
            <li>{t('downloadApp.iosStep2')}</li>
            <li>{t('downloadApp.iosStep3')}</li>
            <li>{t('downloadApp.iosStep4')}</li>
          </ol>
          {platform === 'ios' ? (
            <p className="download-app__platform-note download-app__platform-note--accent">
              {t('downloadApp.iosYouAreHere')}
            </p>
          ) : null}
        </section>

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
