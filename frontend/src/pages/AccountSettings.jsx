import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../context/LanguageContext';
import PageHeader from '../components/PageHeader';

export default function AccountSettings() {
  const { user, logout, refreshUser } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [name, setName] = useState(user?.name || '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [profileErr, setProfileErr] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState('');
  const [pwErr, setPwErr] = useState('');

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMsg('');
    setProfileErr('');
    try {
      const data = await api.updateProfile({ name: name.trim() });
      await refreshUser();
      setProfileMsg(t('settings.profileSaved'));
      if (data.user?.name) setName(data.user.name);
    } catch (err) {
      setProfileErr(err.message || t('settings.saveFailed'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPwSaving(true);
    setPwMsg('');
    setPwErr('');
    try {
      await api.changePassword({ currentPassword, newPassword, confirmPassword });
      setPwMsg(t('settings.passwordSaved'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPwErr(err.message || t('settings.passwordFailed'));
    } finally {
      setPwSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <>
      <PageHeader
        eyebrow={t('settings.eyebrow')}
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
      />

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container settings-wrap">
          <div className="glass-card settings-card">
            <div className="settings-section">
              <h2>{t('settings.profileSection')}</h2>
              <form onSubmit={handleProfileSave}>
                {profileErr && <div className="alert alert-error">{profileErr}</div>}
                {profileMsg && <div className="alert alert-success">{profileMsg}</div>}

                <div className="form-group">
                  <label htmlFor="settings-name">{t('contact.name')}</label>
                  <input
                    id="settings-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={120}
                  />
                </div>

                <div className="form-group">
                  <label>{t('account.username')}</label>
                  <input value={user?.username || ''} disabled className="input-readonly" />
                </div>

                <div className="form-group">
                  <label>{t('account.gmailOptional')}</label>
                  <input value={user?.email || '—'} disabled className="input-readonly" />
                </div>

                <div className="form-group">
                  <label>{t('account.phoneOptional')}</label>
                  <input value={user?.phone || '—'} disabled className="input-readonly" />
                </div>

                <button type="submit" className="btn btn-primary" disabled={profileSaving}>
                  {profileSaving ? t('settings.saving') : t('settings.saveProfile')}
                </button>
              </form>
            </div>

            <div className="settings-divider" />

            <div className="settings-section">
              <h2>{t('settings.passwordSection')}</h2>
              <form onSubmit={handlePasswordChange}>
                {pwErr && <div className="alert alert-error">{pwErr}</div>}
                {pwMsg && <div className="alert alert-success">{pwMsg}</div>}

                <div className="form-group">
                  <label htmlFor="current-pw">{t('settings.currentPassword')}</label>
                  <input
                    id="current-pw"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="new-pw">{t('settings.newPassword')}</label>
                  <input
                    id="new-pw"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    minLength={6}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="confirm-pw">{t('account.confirmPassword')}</label>
                  <input
                    id="confirm-pw"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    autoComplete="new-password"
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" disabled={pwSaving}>
                  {pwSaving ? t('settings.saving') : t('settings.changePassword')}
                </button>
              </form>
            </div>

            <div className="settings-divider" />

            <div className="settings-section settings-actions">
              <Link to="/account" className="btn btn-ghost">{t('nav.myOrders')}</Link>
              <button type="button" className="btn btn-ghost settings-logout" onClick={handleLogout}>
                {t('account.logout')}
              </button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
