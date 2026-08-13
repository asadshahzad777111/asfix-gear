import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { DEFAULT_PAYMENTS, mergePaymentSettings } from '../../config/payments';
import { mergeDeliverySettings } from '../../config/delivery';
import { DEFAULT_ADDRESS_SETTINGS, mergeAddressSettings } from '../../config/addressSettings';
import {
  DEFAULT_POS_PAYMENT_QR_CARDS,
  formatPaymentDisplayNumber,
  mergePosPaymentQrCards,
} from '../../config/posPaymentQr';
import {
  CUSTOM_BILL_MEDIA_ASFIN,
  CUSTOM_BILL_MEDIA_CUSTOM,
  CUSTOM_BILL_MEDIA_NONE,
  CUSTOM_BILL_MEDIA_OWN,
  CUSTOM_BILL_PROFILE_ASFIN,
  CUSTOM_BILL_PROFILE_OTHER,
  CUSTOM_BILL_PROFILE_OWN,
  DEFAULT_CUSTOM_BILL_ASFIN,
  DEFAULT_CUSTOM_BILL_OTHER,
  DEFAULT_CUSTOM_BILL_OWN,
  normalizeCustomBillSettings,
  normalizeProfileId,
} from '../../config/posCustomBillProfiles';
import PosPaymentQrPanel from './PosPaymentQrPanel';
import { printPaymentQrSlip } from '../../utils/paymentQrPrint';

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

const DEFAULT_POS_SETTINGS = {
  posReturnWindowHours: 24,
  posDiscountMaxPercentWithoutPin: 10,
  posDiscountMaxAmountWithoutPin: 500,
  ...normalizeCustomBillSettings({}),
};

export default function AdminPayments() {
  const [form, setForm] = useState(mergePaymentSettings());
  const [delivery, setDelivery] = useState(mergeDeliverySettings());
  const [postexStatus, setPostexStatus] = useState(null);
  const [postexForm, setPostexForm] = useState({
    token: '',
    webhook_secret: '',
    webhook_header: 'x-postex-secret',
    pickup_address_code: '',
    enabled: true,
    auto_book_on_paid: false,
  });
  const [postexSecretOnce, setPostexSecretOnce] = useState('');
  const [postexSecretCopied, setPostexSecretCopied] = useState(false);
  const [savingPostex, setSavingPostex] = useState(false);
  const [addressSettings, setAddressSettings] = useState(mergeAddressSettings());
  const [posSettings, setPosSettings] = useState(DEFAULT_POS_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDelivery, setSavingDelivery] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [savingPos, setSavingPos] = useState(false);
  const [msg, setMsg] = useState('');
  const [deliveryMsg, setDeliveryMsg] = useState('');
  const [postexMsg, setPostexMsg] = useState('');
  const [addressMsg, setAddressMsg] = useState('');
  const [posMsg, setPosMsg] = useState('');
  const [qrPanelOpen, setQrPanelOpen] = useState(false);
  const [qrPrintBusy, setQrPrintBusy] = useState('');

  useEffect(() => {
    Promise.all([
      api.getPaymentSettings().catch(() => null),
      api.getDeliverySettings().catch(() => null),
      api.getAddressSettings().catch(() => null),
      api.getPosSettings().catch(() => null),
      api.getPostExSettings().catch(() => api.getPostExStatus().catch(() => null)),
    ])
      .then(([pay, del, address, pos, postex]) => {
        setForm(mergePaymentSettings(pay));
        setDelivery(mergeDeliverySettings(del));
        setAddressSettings(mergeAddressSettings(address));
        setPostexStatus(postex);
        if (postex) {
          setPostexForm((f) => ({
            ...f,
            webhook_header: postex.webhook_header || 'x-postex-secret',
            pickup_address_code: postex.pickup_address_code || '',
            enabled: postex.enabled !== false,
            auto_book_on_paid: postex.auto_book_on_paid === true,
          }));
        }
        setPosSettings({
          ...DEFAULT_POS_SETTINGS,
          ...(pos || {}),
          ...normalizeCustomBillSettings(pos || {}),
        });
      })
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

  const saveDelivery = async () => {
    setSavingDelivery(true);
    setDeliveryMsg('');
    try {
      const saved = await api.setDeliverySettings(delivery);
      setDelivery(mergeDeliverySettings(saved));
      setDeliveryMsg('Delivery settings saved.');
    } catch (err) {
      setDeliveryMsg(err.message || 'Save failed');
    } finally {
      setSavingDelivery(false);
    }
  };

  const savePostex = async (opts = {}) => {
    const forceNewSecret = Boolean(opts.forceNewSecret);
    setSavingPostex(true);
    setPostexMsg('');
    setPostexSecretOnce('');
    setPostexSecretCopied(false);
    try {
      const body = {
        enabled: postexForm.enabled !== false,
        auto_book_on_paid: postexForm.auto_book_on_paid === true,
        webhook_header: postexForm.webhook_header || 'x-postex-secret',
        pickup_address_code: postexForm.pickup_address_code || '',
        generate_webhook_secret:
          forceNewSecret || (!postexStatus?.webhook_secret_set && !postexForm.webhook_secret.trim()),
      };
      if (forceNewSecret) body.force_new_webhook_secret = true;
      if (postexForm.token.trim()) body.token = postexForm.token.trim();
      if (!forceNewSecret && postexForm.webhook_secret.trim()) {
        body.webhook_secret = postexForm.webhook_secret.trim();
      }
      const saved = await api.setPostExSettings(body);
      setPostexStatus(saved);
      setDelivery((d) => mergeDeliverySettings({ ...d, mode: saved.configured ? 'postex' : 'manual', postex_configured: saved.configured }));
      if (saved.webhook_secret_once) {
        setPostexSecretOnce(saved.webhook_secret_once);
        // Scroll reveal into view on small screens
        requestAnimationFrame(() => {
          document.getElementById('postex-secret-once')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
      setPostexForm((f) => ({ ...f, token: '', webhook_secret: '' }));
      setPostexMsg(
        forceNewSecret
          ? 'New webhook secret generated — copy Header Value below into PostEx.'
          : saved.configured
            ? 'PostEx saved — manual delivery fee is now off.'
            : 'PostEx settings saved.'
      );
    } catch (err) {
      setPostexMsg(err.message || 'PostEx save failed');
    } finally {
      setSavingPostex(false);
    }
  };

  const copyPostexSecret = async () => {
    if (!postexSecretOnce) return;
    try {
      await navigator.clipboard.writeText(postexSecretOnce);
      setPostexSecretCopied(true);
      setTimeout(() => setPostexSecretCopied(false), 2500);
    } catch {
      setPostexMsg('Copy failed — secret select karke manually copy karo.');
    }
  };

  const saveAddressSettings = async () => {
    setSavingAddress(true);
    setAddressMsg('');
    try {
      const saved = await api.setAddressSettings(addressSettings);
      setAddressSettings(mergeAddressSettings(saved));
      setAddressMsg('Checkout address settings saved.');
    } catch (err) {
      setAddressMsg(err.message || 'Save failed');
    } finally {
      setSavingAddress(false);
    }
  };

  const savePosSettings = async () => {
    setSavingPos(true);
    setPosMsg('');
    try {
      const saved = await api.setPosSettings(posSettings);
      setPosSettings({
        ...DEFAULT_POS_SETTINGS,
        ...(saved || {}),
        ...normalizeCustomBillSettings(saved || {}),
      });
      setPosMsg('POS settings saved.');
    } catch (err) {
      setPosMsg(err.message || 'Save failed');
    } finally {
      setSavingPos(false);
    }
  };

  const toggleAddressSetting = (key) => {
    setAddressSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const resetDefaults = () => {
    if (!confirm('Reset all payment details to defaults?')) return;
    setForm(mergePaymentSettings({
      ...DEFAULT_PAYMENTS,
      posQrCards: DEFAULT_POS_PAYMENT_QR_CARDS,
    }));
  };

  const setQrCardField = (index, field, value) => {
    setForm((prev) => {
      const cards = mergePosPaymentQrCards(prev.posQrCards).map((c) => ({ ...c }));
      if (!cards[index]) return prev;
      cards[index] = { ...cards[index], [field]: value };
      if (field === 'number' || field === 'iban') {
        cards[index].payload = String(value || cards[index].payload || '').trim();
      }
      return { ...prev, posQrCards: cards };
    });
  };

  const printQrCard = async (card) => {
    setQrPrintBusy(card.id);
    try {
      const result = await printPaymentQrSlip(card, { thermalWidth: '58mm' });
      if (!result?.ok) window.alert?.(result?.message || 'Print failed');
    } catch (err) {
      window.alert?.(err?.message || 'Print failed');
    } finally {
      setQrPrintBusy('');
    }
  };

  if (loading) return <div className="wp-loading">Loading payments…</div>;

  return (
    <div className="wp-payments">
      <p style={{ fontSize: '0.88rem', color: '#50575e', marginTop: 0 }}>
        Checkout par customer ko yeh accounts dikhenge. JazzCash aur EasyPaisa abhi same number use karte hain. COD Lahore delivery / shop pickup ke liye — advance transfer nahi.
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
                No account fields. Customer pays cash on delivery or at shop pickup (Lahore). Orders show as <strong>COD</strong> in admin.
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

      <div className="wp-postbox" style={{ marginTop: '1.5rem' }}>
        <div className="wp-postbox-head">POS Payment QR slips (thermal)</div>
        <div className="wp-postbox-body">
          <p style={{ marginTop: 0, fontSize: '0.88rem', color: '#50575e' }}>
            Har number ka bada QR slip. Print pe account name upar <strong>STAFF ONLY — TEAR HERE</strong> strip
            mein hota hai — customer hisse mein naam nahi. POS Billing mein bhi yahi button hai.
          </p>
          <div className="wp-payments-actions" style={{ marginBottom: '1rem' }}>
            <button type="button" className="wp-button" onClick={() => setQrPanelOpen(true)}>
              Open QR print panel
            </button>
          </div>
          {mergePosPaymentQrCards(form.posQrCards).map((card, index) => (
            <div
              key={card.id}
              style={{
                border: '1px solid #dcdcde',
                borderRadius: 8,
                padding: '0.75rem',
                marginBottom: '0.75rem',
              }}
            >
              <div className="wp-payments-grid">
                <label className="wp-payments-field">
                  <span>Label (JazzCash / EasyPaisa / Bank)</span>
                  <input
                    type="text"
                    value={card.label || card.method || ''}
                    onChange={(e) => setQrCardField(index, 'label', e.target.value)}
                  />
                </label>
                <label className="wp-payments-field">
                  <span>Number / IBAN</span>
                  <input
                    type="text"
                    value={card.number || card.iban || ''}
                    onChange={(e) => setQrCardField(index, 'number', e.target.value)}
                  />
                </label>
                <label className="wp-payments-field">
                  <span>Account name (staff / tear strip only)</span>
                  <input
                    type="text"
                    value={card.accountName || ''}
                    onChange={(e) => setQrCardField(index, 'accountName', e.target.value)}
                  />
                </label>
                <label className="wp-payments-field">
                  <span>QR payload</span>
                  <input
                    type="text"
                    value={card.payload || ''}
                    onChange={(e) => setQrCardField(index, 'payload', e.target.value)}
                  />
                </label>
              </div>
              <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#50575e' }}>
                Preview: {formatPaymentDisplayNumber(card.number || card.iban)} · Staff: {card.accountName || '—'}
              </p>
              <div className="wp-payments-actions" style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="wp-button wp-button--secondary"
                  disabled={Boolean(qrPrintBusy)}
                  onClick={() => printQrCard(card)}
                >
                  {qrPrintBusy === card.id ? 'Printing…' : 'Print this QR'}
                </button>
              </div>
            </div>
          ))}
          <p style={{ fontSize: '0.8rem', color: '#646970' }}>
            Save payment settings dabane se ye QR cards bhi save ho jate hain.
          </p>
        </div>
      </div>

      <PosPaymentQrPanel open={qrPanelOpen} onClose={() => setQrPanelOpen(false)} />

      <div className="wp-postbox" style={{ marginTop: '1.5rem' }}>
        <div className="wp-postbox-head">PostEx courier (official API)</div>
        <div className="wp-postbox-body">
          <p style={{ marginTop: 0, fontSize: '0.88rem', color: '#50575e' }}>
            Paste token from <strong>merchant.postex.pk → Setting / Integration</strong>. Token yahan save hota hai
            (baad mein change kar sakte ho). Jab token save ho, checkout se manual Rs fee band ho jati hai.
          </p>

          <div className="wp-payments-grid">
            <label className="wp-payments-field" style={{ gridColumn: '1 / -1' }}>
              <span>
                API token {postexStatus?.token_masked ? `(saved ${postexStatus.token_masked})` : ''}
              </span>
              <input
                type="password"
                autoComplete="off"
                placeholder={postexStatus?.configured ? 'Leave blank to keep current token' : 'Paste PostEx API token'}
                value={postexForm.token}
                onChange={(e) => setPostexForm((f) => ({ ...f, token: e.target.value }))}
              />
            </label>
            <label className="wp-payments-field">
              <span>Webhook header key</span>
              <input
                type="text"
                value={postexForm.webhook_header}
                onChange={(e) => setPostexForm((f) => ({ ...f, webhook_header: e.target.value }))}
              />
            </label>
            <label className="wp-payments-field">
              <span>
                Webhook secret {postexStatus?.webhook_secret_masked ? `(saved ${postexStatus.webhook_secret_masked})` : ''}
              </span>
              <input
                type="password"
                autoComplete="off"
                placeholder="Blank chhoro = Save pe auto-generate (ek dafa dikhega)"
                value={postexForm.webhook_secret}
                onChange={(e) => setPostexForm((f) => ({ ...f, webhook_secret: e.target.value }))}
              />
              <small style={{ display: 'block', marginTop: 4, color: '#646970' }}>
                Is password box mein kuch paste karne ki zarurat nahi. Khali chhoro → Save → neeche plaintext + Copy button aayega.
              </small>
            </label>
            <label className="wp-payments-field" style={{ gridColumn: '1 / -1' }}>
              <span>Pickup address code (optional)</span>
              <input
                type="text"
                value={postexForm.pickup_address_code}
                onChange={(e) => setPostexForm((f) => ({ ...f, pickup_address_code: e.target.value }))}
                placeholder="From PostEx get-merchant-address"
              />
            </label>
            <label className="wp-address-setting-row" style={{ gridColumn: '1 / -1' }}>
              <input
                type="checkbox"
                checked={postexForm.enabled !== false}
                onChange={(e) => setPostexForm((f) => ({ ...f, enabled: e.target.checked }))}
              />
              <span>
                <strong>Enable PostEx for online delivery</strong>
                <small>Off = temporary fall back to manual Lahore fee.</small>
              </span>
            </label>
            <p style={{ gridColumn: '1 / -1', fontSize: '0.82rem', color: '#646970', margin: '0 0 0.75rem' }}>
              <strong>Settlements (staff):</strong> PostEx/COD settlement aksar 1–7 din cuts ke baad aati hai.
              Cancel ke baad courier fee cut ho sakti hai — customer ko sirf soft refund message; fee details sirf Admin
              cancel panel / apni books mein. Full accounting app mein nahi.
            </p>
            <label className="wp-address-setting-row" style={{ gridColumn: '1 / -1' }}>
              <input
                type="checkbox"
                checked={postexForm.auto_book_on_paid === true}
                onChange={(e) => setPostexForm((f) => ({ ...f, auto_book_on_paid: e.target.checked }))}
              />
              <span>
                <strong>Auto-book when paid / COD confirmed</strong>
                <small>
                  Default OFF. When ON, Mark Paid / Confirm COD also books PostEx. Manual{' '}
                  <strong>Book on PostEx</strong> always stays available — verify stock/pack first if you keep this off.
                </small>
              </span>
            </label>
          </div>

          <div className="wp-payments-actions" style={{ marginTop: '1rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button type="button" className="wp-button" onClick={() => savePostex()} disabled={savingPostex}>
              {savingPostex ? 'Saving…' : 'Save PostEx settings'}
            </button>
            <button
              type="button"
              className="wp-button"
              style={{ background: '#2271b1' }}
              onClick={() => {
                if (
                  !window.confirm?.(
                    'Naya webhook Header Value generate karein? Purana PostEx portal pe update karna hoga.'
                  )
                ) {
                  return;
                }
                savePostex({ forceNewSecret: true });
              }}
              disabled={savingPostex}
            >
              Generate new Header Value
            </button>
          </div>
          {postexMsg ? <p className="wp-payments-msg">{postexMsg}</p> : null}

          {(postexStatus?.configured || postexSecretOnce || postexStatus?.webhook_secret_set) && (
            <div style={{ marginTop: '1rem', padding: '0.85rem 1rem', background: '#f6f7f7', borderRadius: 8 }}>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.88rem', color: '#1a7f37' }}>
                Status: {postexStatus?.configured ? 'Connected' : 'Not connected'}
                {postexStatus?.token_source ? ` (${postexStatus.token_source})` : ''}
              </p>
              <p style={{ margin: '0 0 0.35rem', fontSize: '0.82rem', color: '#50575e' }}>
                Webhook URL (merchant.postex.pk pe paste):
                <br />
                <code style={{ wordBreak: 'break-all' }}>
                  {postexStatus?.webhook_url || 'https://asfixgear.com/api/webhooks/postex'}
                </code>
              </p>
              <p style={{ margin: '0 0 0.5rem', fontSize: '0.82rem', color: '#50575e' }}>
                Header Key: <code>{postexStatus?.webhook_header || 'x-postex-secret'}</code>
              </p>
              {postexSecretOnce ? (
                <div
                  id="postex-secret-once"
                  style={{
                    marginTop: '0.5rem',
                    padding: '0.75rem 0.85rem',
                    background: '#fff8e5',
                    border: '2px solid #dba617',
                    borderRadius: 8,
                  }}
                >
                  <p style={{ margin: '0 0 0.4rem', fontSize: '0.9rem', fontWeight: 700, color: '#1d2327' }}>
                    Header Value — abhi copy karo (sirf ek dafa plaintext dikhega)
                  </p>
                  <p style={{ margin: '0 0 0.65rem', fontSize: '0.8rem', color: '#50575e' }}>
                    Ye value PostEx portal ke <strong>Header Value</strong> field mein paste karo.
                  </p>
                  <code
                    style={{
                      display: 'block',
                      wordBreak: 'break-all',
                      fontSize: '0.95rem',
                      padding: '0.5rem 0.6rem',
                      background: '#fff',
                      border: '1px solid #c3c4c7',
                      borderRadius: 4,
                      color: '#1d2327',
                      userSelect: 'all',
                    }}
                  >
                    {postexSecretOnce}
                  </code>
                  <div style={{ marginTop: '0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                    <button type="button" className="wp-button" onClick={copyPostexSecret}>
                      {postexSecretCopied ? 'Copied!' : 'Copy Header Value'}
                    </button>
                    <span style={{ fontSize: '0.78rem', color: '#b32d2e' }}>
                      Page refresh ke baad ye phir nahi dikhega — pehle copy kar lo.
                    </span>
                  </div>
                </div>
              ) : (
                <p style={{ margin: 0, fontSize: '0.8rem', color: '#646970' }}>
                  Webhook secret already saved ({postexStatus?.webhook_secret_masked || '••••'} — dots only, full value
                  nahi dikhti). Miss ho gaya tha? Upar <strong>Generate new Header Value</strong> dabao → copy → PostEx
                  mein paste.
                </p>
              )}
              <p style={{ margin: '0.65rem 0 0', fontSize: '0.8rem', color: '#646970' }}>
                Orders book: <strong>Admin → Orders → Book on PostEx</strong>
                {postexStatus?.auto_book_on_paid
                  ? ' · Auto-book ON (paid/COD)'
                  : ' · Auto-book OFF (manual only)'}
              </p>
            </div>
          )}

          {!postexStatus?.configured && (
            <>
              <p style={{ marginTop: '1.25rem', fontSize: '0.88rem', color: '#50575e' }}>
                Token se pehle legacy Lahore fee (optional):
              </p>
              <div className="wp-payments-grid">
                <label className="wp-payments-field">
                  <span>Lahore estimated fee (PKR)</span>
                  <input
                    type="number"
                    min={0}
                    max={50000}
                    step={1}
                    value={delivery.lahore_fee}
                    onChange={(e) => setDelivery((d) => ({ ...d, lahore_fee: e.target.value }))}
                  />
                </label>
                <label className="wp-payments-field" style={{ gridColumn: '1 / -1' }}>
                  <span>Outside Lahore note</span>
                  <input
                    type="text"
                    value={delivery.outside_note || ''}
                    onChange={(e) => setDelivery((d) => ({ ...d, outside_note: e.target.value }))}
                  />
                </label>
              </div>
              <div className="wp-payments-actions" style={{ marginTop: '1rem' }}>
                <button type="button" className="wp-button wp-button--secondary" onClick={saveDelivery} disabled={savingDelivery}>
                  {savingDelivery ? 'Saving…' : 'Save legacy delivery fee'}
                </button>
              </div>
              {deliveryMsg ? <p className="wp-payments-msg">{deliveryMsg}</p> : null}
            </>
          )}
        </div>
      </div>

      <div className="wp-postbox" style={{ marginTop: '1.5rem' }}>
        <div className="wp-postbox-head">POS billing controls</div>
        <div className="wp-postbox-body">
          <p style={{ marginTop: 0, fontSize: '0.88rem', color: '#50575e' }}>
            Controls return timing and when POS discounts need manager approval. Defaults: 24 hours, 10%, Rs. 500.
          </p>
          <div className="wp-payments-grid">
            <label className="wp-payments-field">
              <span>Return window (hours)</span>
              <input
                type="number"
                min={0}
                max={720}
                step={1}
                value={posSettings.posReturnWindowHours}
                onChange={(e) => setPosSettings((p) => ({ ...p, posReturnWindowHours: e.target.value }))}
              />
            </label>
            <label className="wp-payments-field">
              <span>Max discount percent without PIN</span>
              <input
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={posSettings.posDiscountMaxPercentWithoutPin}
                onChange={(e) => setPosSettings((p) => ({ ...p, posDiscountMaxPercentWithoutPin: e.target.value }))}
              />
            </label>
            <label className="wp-payments-field">
              <span>Max discount amount without PIN (PKR)</span>
              <input
                type="number"
                min={0}
                max={1000000}
                step={1}
                value={posSettings.posDiscountMaxAmountWithoutPin}
                onChange={(e) => setPosSettings((p) => ({ ...p, posDiscountMaxAmountWithoutPin: e.target.value }))}
              />
            </label>
          </div>
          <div className="wp-payments-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="wp-button" onClick={savePosSettings} disabled={savingPos}>
              {savingPos ? 'Saving…' : 'Save POS settings'}
            </button>
            <button
              type="button"
              className="wp-button wp-button--secondary"
              onClick={() => setPosSettings(DEFAULT_POS_SETTINGS)}
            >
              Reset POS defaults
            </button>
          </div>
          {posMsg ? <p className="wp-payments-msg">{posMsg}</p> : null}
        </div>
      </div>

      <div className="wp-postbox" style={{ marginTop: '1.5rem' }}>
        <div className="wp-postbox-head">POS Custom bill — shop identity</div>
        <div className="wp-postbox-body">
          <p style={{ marginTop: 0, fontSize: '0.88rem', color: '#50575e' }}>
            Laptop + phone POS pe same shop names. <strong>AsFix</strong>, <strong>ASPLYWOOD (ASFIN)</strong>, ya <strong>Someone else</strong>.
            Logo/scanner defaults sirf Custom bill print pe — AsFix Sale bill receipts alag rehti hain.
          </p>
          <label className="wp-payments-field" style={{ display: 'block', marginBottom: '0.85rem' }}>
            <span>Default profile on Custom bill</span>
            <select
              value={posSettings.customBillActiveProfile || CUSTOM_BILL_PROFILE_OWN}
              onChange={(e) => setPosSettings((p) => ({
                ...p,
                customBillActiveProfile: normalizeProfileId(e.target.value, CUSTOM_BILL_PROFILE_OWN),
              }))}
            >
              <option value={CUSTOM_BILL_PROFILE_OWN}>My shop (AsFix)</option>
              <option value={CUSTOM_BILL_PROFILE_ASFIN}>ASPLYWOOD (ASFIN)</option>
              <option value={CUSTOM_BILL_PROFILE_OTHER}>Someone else</option>
            </select>
          </label>
          {[
            { key: 'customBillOwn', title: 'My shop (AsFix)', defaults: DEFAULT_CUSTOM_BILL_OWN },
            { key: 'customBillAsfin', title: 'ASPLYWOOD (ASFIN)', defaults: DEFAULT_CUSTOM_BILL_ASFIN },
            { key: 'customBillOther', title: 'Someone else', defaults: DEFAULT_CUSTOM_BILL_OTHER },
          ].map(({ key, title, defaults }) => {
            const profile = { ...defaults, ...(posSettings[key] || {}) };
            const setProfileField = (field, value) => {
              setPosSettings((p) => ({
                ...p,
                [key]: { ...defaults, ...(p[key] || {}), [field]: value },
              }));
            };
            return (
              <div key={key} style={{ marginBottom: '1rem', paddingTop: '0.5rem', borderTop: '1px solid #dcdcde' }}>
                <strong style={{ display: 'block', marginBottom: '0.5rem' }}>{title}</strong>
                <div className="wp-payments-grid">
                  <label className="wp-payments-field">
                    <span>Shop name</span>
                    <input
                      type="text"
                      value={profile.shopName || ''}
                      onChange={(e) => setProfileField('shopName', e.target.value)}
                    />
                  </label>
                  <label className="wp-payments-field">
                    <span>Place / market</span>
                    <input
                      type="text"
                      value={profile.shopPlace || ''}
                      onChange={(e) => setProfileField('shopPlace', e.target.value)}
                    />
                  </label>
                  <label className="wp-payments-field">
                    <span>Shop phone</span>
                    <input
                      type="text"
                      value={profile.shopPhone || ''}
                      onChange={(e) => setProfileField('shopPhone', e.target.value)}
                    />
                  </label>
                  <label className="wp-payments-field">
                    <span>QR link / text</span>
                    <input
                      type="text"
                      value={profile.qrPayload || ''}
                      onChange={(e) => setProfileField('qrPayload', e.target.value)}
                    />
                  </label>
                </div>
                <div className="wp-payments-grid" style={{ marginTop: '0.65rem' }}>
                  <label className="wp-payments-field">
                    <span>Logo default</span>
                    <select
                      value={profile.logoSource || CUSTOM_BILL_MEDIA_NONE}
                      onChange={(e) => {
                        const logoSource = e.target.value;
                        setPosSettings((p) => ({
                          ...p,
                          [key]: {
                            ...defaults,
                            ...(p[key] || {}),
                            logoSource,
                            includeLogo: logoSource !== CUSTOM_BILL_MEDIA_NONE,
                          },
                        }));
                      }}
                    >
                      <option value={CUSTOM_BILL_MEDIA_NONE}>No logo</option>
                      <option value={CUSTOM_BILL_MEDIA_OWN}>Your own logo (AsFix)</option>
                      <option value={CUSTOM_BILL_MEDIA_ASFIN}>ASFIN / ASPLYWOOD logo</option>
                      <option value={CUSTOM_BILL_MEDIA_CUSTOM}>Upload other logo</option>
                    </select>
                  </label>
                  <label className="wp-payments-field">
                    <span>Scanner default</span>
                    <select
                      value={profile.scannerSource || CUSTOM_BILL_MEDIA_NONE}
                      onChange={(e) => {
                        const scannerSource = e.target.value;
                        setPosSettings((p) => ({
                          ...p,
                          [key]: {
                            ...defaults,
                            ...(p[key] || {}),
                            scannerSource,
                            includeQr: scannerSource !== CUSTOM_BILL_MEDIA_NONE,
                          },
                        }));
                      }}
                    >
                      <option value={CUSTOM_BILL_MEDIA_NONE}>No scanner</option>
                      <option value={CUSTOM_BILL_MEDIA_OWN}>Your own scanner (asfixgear.com)</option>
                      <option value={CUSTOM_BILL_MEDIA_ASFIN}>ASFIN scanner (asfins.com)</option>
                      <option value={CUSTOM_BILL_MEDIA_CUSTOM}>Other scanner / QR</option>
                    </select>
                  </label>
                </div>
              </div>
            );
          })}
          <div className="wp-payments-actions" style={{ marginTop: '0.5rem' }}>
            <button type="button" className="wp-button" onClick={savePosSettings} disabled={savingPos}>
              {savingPos ? 'Saving…' : 'Save custom bill settings'}
            </button>
          </div>
        </div>
      </div>

      <div className="wp-postbox" style={{ marginTop: '1.5rem' }}>
        <div className="wp-postbox-head">Checkout / Address methods</div>
        <div className="wp-postbox-body">
          <p style={{ marginTop: 0, fontSize: '0.88rem', color: '#50575e' }}>
            Customer account address book aur checkout address form ke methods yahan control hote hain. Courier safe location ko courier partner setup ke baad enable karein.
          </p>
          <div className="wp-address-settings-list">
            <label className="wp-address-setting-row">
              <input
                type="checkbox"
                checked={addressSettings.addressStructuredFormEnabled}
                onChange={() => toggleAddressSetting('addressStructuredFormEnabled')}
              />
              <span>
                <strong>Structured address form</strong>
                <small>Name, country, province, city, postal code, street, house/building fields.</small>
              </span>
            </label>
            <label className="wp-address-setting-row">
              <input
                type="checkbox"
                checked={addressSettings.addressMapPickerEnabled}
                onChange={() => toggleAddressSetting('addressMapPickerEnabled')}
              />
              <span>
                <strong>Map picker</strong>
                <small>Keep customer drop-pin coordinates with saved addresses.</small>
              </span>
            </label>
            <label className="wp-address-setting-row">
              <input
                type="checkbox"
                checked={addressSettings.addressCourierSafeLocationEnabled}
                onChange={() => toggleAddressSetting('addressCourierSafeLocationEnabled')}
              />
              <span>
                <strong>Courier safe location</strong>
                <small>
                  {delivery.mode === 'postex' || postexStatus?.configured
                    ? 'PostEx is active — enable this so customers can mark a safe drop-off point for courier.'
                    : 'Enable after PostEx token is saved above (Admin → Payments → PostEx).'}
                </small>
              </span>
            </label>
          </div>
          <div className="wp-payments-actions" style={{ marginTop: '1rem' }}>
            <button type="button" className="wp-button" onClick={saveAddressSettings} disabled={savingAddress}>
              {savingAddress ? 'Saving…' : 'Save address settings'}
            </button>
            <button
              type="button"
              className="wp-button wp-button--secondary"
              onClick={() => setAddressSettings(mergeAddressSettings(DEFAULT_ADDRESS_SETTINGS))}
            >
              Reset address defaults
            </button>
          </div>
          {addressMsg ? <p className="wp-payments-msg">{addressMsg}</p> : null}
        </div>
      </div>
    </div>
  );
}
