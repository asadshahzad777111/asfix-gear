import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api/client';
import { useTranslation } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import MapAddressPicker from '../MapAddressPicker';
import { SHOP } from '../../config/shop';
import { mergeAddressSettings } from '../../config/addressSettings';
import { displayAddressLine } from '../../utils/address';

const EMPTY_FORM = {
  name: '',
  phone: '',
  country: 'Pakistan',
  region: '',
  city: '',
  postalCode: '',
  streetAddress: '',
  houseNumber: '',
  landmark: '',
  notes: '',
  text: '',
  lat: SHOP.lat,
  lng: SHOP.lng,
  is_default: false,
};

const structuredRequired = (form) =>
  form.name.trim() && form.phone.trim() && (form.streetAddress.trim() || form.text.trim());

export default function AddressBook() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [settings, setSettings] = useState(() => mergeAddressSettings());
  const [method, setMethod] = useState('manual');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const loadAddresses = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, addressSettings] = await Promise.all([
        api.getMyAddresses(),
        api.getAddressSettings().catch(() => null),
      ]);
      setAddresses(data);
      setSettings(mergeAddressSettings(addressSettings));
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
      country: addr.country || 'Pakistan',
      region: addr.region || '',
      city: addr.city || '',
      postalCode: addr.postalCode || '',
      streetAddress: addr.streetAddress || addr.text || '',
      houseNumber: addr.houseNumber || '',
      landmark: addr.landmark || '',
      notes: addr.notes || '',
      text: addr.text || '',
      lat: addr.lat,
      lng: addr.lng,
      is_default: Boolean(addr.is_default),
    });
    setMethod('manual');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!structuredRequired(form)) {
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
                <p>{displayAddressLine(addr)}</p>
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

      <div className="address-method-tabs" role="tablist" aria-label={t('address.methodLabel')}>
        <button
          type="button"
          className={method === 'manual' ? 'active' : ''}
          onClick={() => setMethod('manual')}
        >
          {t('address.manualMethod')}
        </button>
        <button
          type="button"
          className={method === 'safe' ? 'active' : ''}
          onClick={() => setMethod('safe')}
          aria-disabled={!settings.addressCourierSafeLocationEnabled}
        >
          {t('address.safeMethod')}
        </button>
      </div>

      {method === 'safe' ? (
        <div className="address-safe-location glass-card">
          <h3>{t('address.safeTitle')}</h3>
          <p>
            {settings.addressCourierSafeLocationEnabled
              ? t('address.safeEnabledStub')
              : t('address.safeLocked')}
          </p>
        </div>
      ) : (
        <form className="address-book-form glass-card" onSubmit={handleSubmit}>
          <h3>{editingId ? t('address.editTitle') : t('address.addTitle')}</h3>
          <div className="address-form-grid">
            <label>
              <span>{t('address.fullNameLabel')}</span>
              <input
                placeholder={t('address.namePh')}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </label>
            <label>
              <span>{t('address.phoneLabel')}</span>
              <input
                placeholder={t('address.phonePh')}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                required
              />
            </label>

            {settings.addressStructuredFormEnabled ? (
              <>
                <label>
                  <span>{t('address.countryLabel')}</span>
                  <input
                    value={form.country}
                    onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))}
                  />
                </label>
                <label>
                  <span>{t('address.regionLabel')}</span>
                  <input
                    placeholder={t('address.regionPh')}
                    value={form.region}
                    onChange={(e) => setForm((f) => ({ ...f, region: e.target.value }))}
                  />
                </label>
                <label>
                  <span>{t('address.cityLabel')}</span>
                  <input
                    placeholder={t('address.cityPh')}
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                  />
                </label>
                <label>
                  <span>{t('address.postalCodeLabel')}</span>
                  <input
                    placeholder={t('address.postalCodePh')}
                    value={form.postalCode}
                    onChange={(e) => setForm((f) => ({ ...f, postalCode: e.target.value }))}
                  />
                </label>
                <label className="address-form-wide">
                  <span>{t('address.streetLabel')}</span>
                  <input
                    placeholder={t('address.streetPh')}
                    value={form.streetAddress}
                    onChange={(e) => setForm((f) => ({ ...f, streetAddress: e.target.value }))}
                    required
                  />
                </label>
                <label>
                  <span>{t('address.houseLabel')}</span>
                  <input
                    placeholder={t('address.housePh')}
                    value={form.houseNumber}
                    onChange={(e) => setForm((f) => ({ ...f, houseNumber: e.target.value }))}
                  />
                </label>
                <label>
                  <span>{t('address.landmarkLabel')}</span>
                  <input
                    placeholder={t('address.landmarkPh')}
                    value={form.landmark}
                    onChange={(e) => setForm((f) => ({ ...f, landmark: e.target.value }))}
                  />
                </label>
              </>
            ) : (
              <label className="address-form-wide">
                <span>{t('address.textLabel')}</span>
                <textarea
                  placeholder={t('address.textPh')}
                  value={form.text}
                  onChange={(e) => setForm((f) => ({ ...f, text: e.target.value }))}
                  rows={3}
                  required
                />
              </label>
            )}
            <label className="address-form-wide">
              <span>{t('address.notesLabel')}</span>
              <textarea
                placeholder={t('address.notesPh')}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
              />
            </label>
          </div>
          {settings.addressMapPickerEnabled && (
            <>
              <p className="address-map-hint">{t('address.mapHint')}</p>
              <MapAddressPicker
                lat={form.lat}
                lng={form.lng}
                onChange={({ lat, lng }) => setForm((f) => ({ ...f, lat, lng }))}
              />
            </>
          )}
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
      )}
        </div>
  );
}
