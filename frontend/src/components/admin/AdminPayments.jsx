import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { DEFAULT_PAYMENTS, mergePaymentSettings } from '../../config/payments';

const METHODS = [
  { id: 'jazzcash', title: 'JazzCash', fields: ['number', 'accountName'] },
  { id: 'easypaisa', title: 'EasyPaisa', fields: ['number', 'accountName'] },
  { id: 'bank', title: 'Bank Transfer', fields: ['bankName', 'accountName', 'accountNumber', 'iban', 'branch'] },
  { id: 'cod', title: 'Cash on Delivery (Lahore)', fields: [] },
];

const FIELD_LABELS = {
  number: 'Mobile number',
  accountName: 'Account name',
  bankName: 'Bank name',
  accountNumber: 'Account number',
  iban: 'IBAN',
  branch: 'Branch',
};

export default function AdminPayments() {
  const [form, setForm] = useState(mergePaymentSettings());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api.getPaymentSettings()
      .then((data) => setForm(mergePaymentSettings(data)))
      .catch(() => setForm(mergePaymentSettings()))
      .finally(() => setLoading(false));
  }, []);

  const setField = (methodId, field, value) => {
    setForm((prev) => ({
      ...prev,
      [methodId]: { ...prev[methodId], [field]: value },
    }));
  };

  const toggleEnabled = (methodId) => {
    setForm((prev) => ({
      ...prev,
      [methodId]: { ...prev[methodId], enabled: !prev[methodId]?.enabled },
    }));
  };

  const save = async () => {
    setSaving(true);
    setMsg('');
    try {
      const saved = await api.setPaymentSettings(form);
      setForm(mergePaymentSettings(saved));
      setMsg('Payment settings saved.');
    } catch (err) {
      setMsg(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const resetDefaults = () => {
    if (!confirm('Reset all payment details to defaults?')) return;
    setForm(mergePaymentSettings(DEFAULT_PAYMENTS));
  };

  if (loading) return <div className="wp-loading">Loading payments…</div>;

  return (
    <div className="wp-payments">
      <p style={{ fontSize: '0.88rem', color: '#50575e', marginTop: 0 }}>
        Checkout par customer ko yeh accounts dikhenge. JazzCash aur EasyPaisa abhi same number use karte hain. COD Lahore delivery ke liye — advance transfer nahi.
      </p>
      {METHODS.map(({ id, title, fields }) => (
        <div key={id} className="wp-postbox">
          <div className="wp-postbox-head wp-payments-head">
            <span>{title}</span>
            <label className="wp-payments-toggle">
              <input type="checkbox" checked={form[id]?.enabled !== false} onChange={() => toggleEnabled(id)} />
              Active
            </label>
          </div>
          <div className="wp-postbox-body">
            {id === 'cod' ? (
              <p style={{ margin: 0, fontSize: '0.88rem', color: '#50575e' }}>
                No account fields. Customer pays cash on delivery (Lahore). Orders show as <strong>COD</strong> in admin.
              </p>
            ) : (
              <div className="wp-payments-grid">
                {fields.map((field) => (
                  <label key={field} className="wp-payments-field">
                    <span>{FIELD_LABELS[field]}</span>
                    <input
                      type="text"
                      value={form[id]?.[field] || ''}
                      onChange={(e) => setField(id, field, e.target.value)}
                    />
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
      <div className="wp-payments-actions">
        <button type="button" className="wp-button" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save payment settings'}
        </button>
        <button type="button" className="wp-button wp-button--secondary" onClick={resetDefaults}>
          Reset defaults
        </button>
      </div>
      {msg ? <p className="wp-payments-msg">{msg}</p> : null}
    </div>
  );
}
