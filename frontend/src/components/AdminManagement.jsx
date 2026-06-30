import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { roleLabel, isValidStaffGmail } from '../config/permissions';
import { useTranslation } from '../context/LanguageContext';
import PasswordRevealModal from './PasswordRevealModal';

const INITIAL_FORM = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  role: 'editor',
};

function formatLastLogin(iso, t) {
  if (!iso) return t('team.neverLoggedIn');
  return new Date(iso).toLocaleString('en-PK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminManagement({ compact = false }) {
  const { t } = useTranslation();
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState(INITIAL_FORM);
  const [passwordReveal, setPasswordReveal] = useState({ open: false, password: '', title: '' });
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState('');

  const loadStaff = async () => {
    setLoading(true);
    try {
      const data = await api.getTeam();
      setStaff(data);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!isValidStaffGmail(form.email)) {
      setMessage({ type: 'error', text: t('team.errGmail') });
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage({ type: 'error', text: t('team.errPasswordMatch') });
      return;
    }
    if (form.password.length < 6) {
      setMessage({ type: 'error', text: t('team.errPasswordLength') });
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.createTeamMember({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        role: form.role,
      });
      setStaff((prev) => [...prev, res.user]);
      setForm(INITIAL_FORM);
      setPasswordReveal({
        open: true,
        password: res.temporary_password,
        title: t('team.createdTitle', { name: res.user.name }),
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleBlock = async (member) => {
    if (member.role === 'super_admin') return;
    try {
      const updated = await api.toggleTeamBlock(member.id, !member.blocked);
      setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      alert(err.message);
    }
  };

  const submitResetPassword = async (e) => {
    e.preventDefault();
    if (!resetTarget || resetPassword.length < 6) {
      alert(t('team.errPasswordLength'));
      return;
    }
    try {
      const res = await api.resetTeamPassword(resetTarget.id, resetPassword);
      setPasswordReveal({
        open: true,
        password: res.temporary_password,
        title: t('team.resetTitle', { name: resetTarget.name }),
      });
      setResetTarget(null);
      setResetPassword('');
    } catch (err) {
      alert(err.message);
    }
  };

  const removeStaff = async (member) => {
    if (member.role === 'super_admin') return;
    if (!window.confirm(t('team.removeConfirm', { name: member.name }))) return;
    try {
      await api.removeTeamMember(member.id);
      setStaff((prev) => prev.filter((s) => s.id !== member.id));
    } catch (err) {
      alert(err.message);
    }
  };

  const changeRole = async (member, role) => {
    if (member.role === 'super_admin') return;
    try {
      const updated = await api.updateTeamMember(member.id, { role });
      setStaff((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className={`admin-management team-access ${compact ? 'admin-management--compact' : ''}`}>
      <div className="glass-card admin-mgmt-form-wrap team-access-form">
        <h3>{t('team.addTitle')}</h3>
        <p className="field-hint">{t('team.addHint')}</p>

        {message.text && (
          <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`}>
            {message.text}
          </div>
        )}

        <form className="admin-mgmt-form" onSubmit={handleSubmit}>
          <div className="form-row-2">
            <div className="form-group">
              <label>{t('team.name')} *</label>
              <input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t('team.namePh')}
                required
              />
            </div>
            <div className="form-group">
              <label>{t('team.gmail')} *</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="staff@gmail.com"
                required
              />
            </div>
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>{t('team.password')} *</label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder={t('team.passwordPh')}
                minLength={6}
                required
              />
            </div>
            <div className="form-group">
              <label>{t('team.confirmPassword')} *</label>
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(e) => setForm((f) => ({ ...f, confirmPassword: e.target.value }))}
                placeholder={t('team.confirmPasswordPh')}
                minLength={6}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>{t('team.role')} *</label>
            <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
              <option value="editor">{t('team.roleStaff')}</option>
              <option value="admin">{t('team.roleAdmin')}</option>
            </select>
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? t('team.adding') : t('team.addButton')}
          </button>
        </form>
      </div>

      {!compact ? (
        <div className="glass-card admin-mgmt-list-wrap team-access-list">
          <h3>{t('team.listTitle')}</h3>
          {loading ? (
            <div className="loading">{t('team.loading')}</div>
          ) : staff.length === 0 ? (
            <p className="field-hint">{t('team.empty')}</p>
          ) : (
            <div className="admin-mgmt-table-wrap team-table-wrap">
              <table className="admin-table team-table">
                <thead>
                  <tr>
                    <th>{t('team.colName')}</th>
                    <th>{t('team.colGmail')}</th>
                    <th>{t('team.colRole')}</th>
                    <th>{t('team.colStatus')}</th>
                    <th>{t('team.colLastLogin')}</th>
                    <th>{t('team.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id} className={member.blocked ? 'team-row-blocked' : ''}>
                      <td><strong>{member.name}</strong></td>
                      <td><small>{member.email}</small></td>
                      <td>
                        {member.role === 'super_admin' ? (
                          <span className="role-badge role-super">{roleLabel(member.role)}</span>
                        ) : (
                          <select
                            className="status-select"
                            value={member.role}
                            onChange={(e) => changeRole(member, e.target.value)}
                          >
                            <option value="admin">{t('team.roleAdmin')}</option>
                            <option value="editor">{t('team.roleStaff')}</option>
                          </select>
                        )}
                      </td>
                      <td>
                        <span className={`status-pill ${member.blocked ? 'blocked' : 'active'}`}>
                          {member.blocked ? t('team.statusBlocked') : t('team.statusActive')}
                        </span>
                      </td>
                      <td><small>{formatLastLogin(member.last_login, t)}</small></td>
                      <td>
                        {member.role !== 'super_admin' && (
                          <div className="team-actions">
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => toggleBlock(member)}
                            >
                              {member.blocked ? t('team.unblock') : t('team.block')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => {
                                setResetTarget(member);
                                setResetPassword('');
                              }}
                            >
                              {t('team.resetPw')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm team-btn-remove"
                              onClick={() => removeStaff(member)}
                            >
                              {t('team.remove')}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="glass-card admin-mgmt-list-wrap team-access-list team-access-list--compact">
          <h3>{t('team.listTitle')}</h3>
          {loading ? (
            <div className="loading">{t('team.loading')}</div>
          ) : staff.length === 0 ? (
            <p className="field-hint">{t('team.empty')}</p>
          ) : (
            <div className="admin-mgmt-table-wrap team-table-wrap">
              <table className="admin-table team-table team-table--compact">
                <thead>
                  <tr>
                    <th>{t('team.colName')}</th>
                    <th>{t('team.colStatus')}</th>
                    <th>{t('team.colActions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {staff.map((member) => (
                    <tr key={member.id}>
                      <td>
                        <strong>{member.name}</strong>
                        <br /><small>{member.email}</small>
                      </td>
                      <td>
                        <span className={`status-pill ${member.blocked ? 'blocked' : 'active'}`}>
                          {member.blocked ? t('team.statusBlocked') : t('team.statusActive')}
                        </span>
                      </td>
                      <td>
                        {member.role !== 'super_admin' && (
                          <div className="team-actions">
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => toggleBlock(member)}>
                              {member.blocked ? t('team.unblock') : t('team.block')}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => {
                                setResetTarget(member);
                                setResetPassword('');
                              }}
                            >
                              {t('team.resetPw')}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="field-hint">{t('team.compactHint')}</p>
        </div>
      )}

      {resetTarget && (
        <div className="password-reveal-backdrop" role="dialog" aria-modal="true">
          <div className="password-reveal-modal glass-card">
            <h3>{t('team.resetTitle', { name: resetTarget.name })}</h3>
            <form onSubmit={submitResetPassword}>
              <div className="form-group">
                <label>{t('team.newPassword')}</label>
                <input
                  type="password"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  minLength={6}
                  required
                  autoFocus
                />
              </div>
              <div className="team-reset-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => setResetTarget(null)}>
                  {t('team.cancel')}
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  {t('team.resetConfirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <PasswordRevealModal
        open={passwordReveal.open}
        password={passwordReveal.password}
        title={passwordReveal.title}
        onClose={() => setPasswordReveal({ open: false, password: '', title: '' })}
      />
    </div>
  );
}
