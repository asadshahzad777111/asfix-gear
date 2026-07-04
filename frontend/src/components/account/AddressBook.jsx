import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useTranslation } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import MapAddressPicker from '../MapAddressPicker';
import { SHOP } from '../../config/shop';

const EMPTY_FORM = {
  name: '',
  phone: '',
  text: '',
  lat: SHOP.lat,
  lng: SHOP.lng,
  is_default: false,
};

export default function AddressBook() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const loadAddresses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getMyAddresses();
      setAddresses(data);
    } catch (err) {
      setError(err.message || t('address.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAddresses();
  }, [loadAddresses]);

  useEffect(() => {
    if (!user) return;
    setForm((prev) => ({
      ...prev,
      name: prev.name || user.name || '',
      phone: prev.phone || user.phone || '',
    }));
  }, [user]);

  const resetForm = () => {
    setEditingId(null);
    setForm({
      ...EMPTY_FORM,
      name: user?.name || '',
      phone: user?.phone || '',
      is_default: addresses.length === 0,
    });
  };

  const startEdit = (addr) => {
    setEditingId(addr.id);
    setForm({
      name: addr.name,
      phone: addr.phone,
      text: addr.text,
      lat: addr.lat,
      lng: addr.lng,
      is_default: Boolean(addr.is_default),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.text.trim()) {
      setError(t('address.requiredFields'));
      return;
    }
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const updated = await api.updateAddress(editingId, form);
        setAddresses((prev) => prev.map((a) => (a.id === editingId ? updated : a)));
      } else {
        const created = await api.addAddress(form);
        setAddresses((prev) => [created, ...prev]);
      }
      resetForm();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('address.deleteConfirm'))) return;
    try {
      await api.deleteAddress(id);
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <p className="loading">{t('common.loading')}</p>;

  return (
    <div className="address-book">
      {error && <div className="alert alert-error">{error}</div>}

      {addresses.length === 0 ? (
        <p className="account-empty-note">{t('address.empty')}</p>
      ) : (
        <ul className="address-book-list">
          {addresses.map((addr) => (
            <li key={addr.id} className={`address-book-item${addr.is_default ? ' is-default' : ''}`}>
              <div>
                <strong>{addr.name}</strong>
                {addr.is_default && <span className="address-default-badge">{t('address.defaultBadge')}</span>}
                <p>{addr.phone}</p>
                <p>{addr.text}</p>
                <p className="address-coords">{addr.lat?.toFixed(5)}, {addr.lng?.toFixed(5)}</p>
              </div>
              <div className="address-book-actions">
                <button type="button" className="btn btn-outline btn-sm" onClick={() => startEdit(addr)}>
                  {t('address.edit')}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDelete(addr.id)}>
                  {t('address.delete')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form className="address-book-form glass-card" onSubmit={handleSubmit}>
        <h3>{editingId ? t('address.editTitle') : t('address.addTitle')}</h3>
        <input
          placeholder={t('address.namePh')}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          required
        />
        <input
          placeholder={t('address.phonePh')}
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          required
        />
        <textarea
          placeholder={t('address.textPh')}
          value={form.text}
          onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
          rows={3}
          required
        />
        <p className="address-map-hint">{t('address.mapHint')}</p>
        <MapAddressPicker
          lat={form.lat}
          lng={form.lng}
          onChange={({ lat, lng }) => setForm((f) => ({ ...f, lat, lng }))}
        />
        <label className="address-default-check">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
          />
          {t('address.setDefault')}
        </label>
        <div className="address-form-actions">
          {editingId && (
            <button type="button" className="btn btn-ghost" onClick={resetForm}>
              {t('address.cancelEdit')}
            </button>
          )}
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? t('common.saving') : editingId ? t('address.save') : t('address.add')}
          </button>
        </div>
      </form>
    </div>
  );
}
