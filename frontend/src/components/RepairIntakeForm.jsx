import { useMemo, useState } from 'react';
import RepairSuccessPanel from './RepairSuccessPanel';
import PremiumButton from './premium/PremiumButton';
import ScreenQualityPicker from './ScreenQualityPicker';
import { api } from '../api/client';
import { SHOP } from '../config/shop';
import { useTranslation } from '../context/LanguageContext';
import {
  DEVICE_BRANDS,
  REPAIR_ISSUE_OPTIONS,
  buildIssueSummary,
  getEstimatedRepairTime,
  isDeadMobileIssue,
  isScreenIssue,
  ESTIMATE_STANDARD,
  ESTIMATE_SEVERE,
  ESTIMATE_DEAD,
  ESTIMATE_DIAGNOSTIC,
} from '../config/repairIntake';

const INITIAL = {
  customer_name: '',
  phone: '',
  alternative_contact: '',
  brand_key: '',
  brand_manual: '',
  model_key: '',
  model_manual: '',
  use_manual_model: false,
  issue_types: [],
  issue_other: '',
  screen_quality: '',
  dead_mobile_ack: false,
  terms_accepted: false,
};

const DEAD_POLICY_KEYS = ['deadPolicy1', 'deadPolicy2', 'deadPolicy3', 'deadPolicy4'];

function translateEstimate(raw, t) {
  const map = {
    [ESTIMATE_STANDARD]: t('repairForm.estimateStandard'),
    [ESTIMATE_SEVERE]: t('repairForm.estimateSevere'),
    [ESTIMATE_DEAD]: t('repairForm.estimateDead'),
    [ESTIMATE_DIAGNOSTIC]: t('repairForm.estimateDiagnostic'),
  };
  return map[raw] || raw;
}

export default function RepairIntakeForm() {
  const { t } = useTranslation();
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [successBooking, setSuccessBooking] = useState(null);

  const brandOptions = useMemo(() => [...Object.keys(DEVICE_BRANDS), 'Other'], []);
  const modelOptions = useMemo(() => {
    if (!form.brand_key || form.brand_key === 'Other') return [];
    return DEVICE_BRANDS[form.brand_key] || [];
  }, [form.brand_key]);

  const deviceBrand = form.brand_key === 'Other' ? form.brand_manual.trim() : form.brand_key;
  const deviceModel = form.use_manual_model || form.brand_key === 'Other'
    ? form.model_manual.trim()
    : form.model_key === 'Other model'
      ? form.model_manual.trim()
      : form.model_key;

  const deviceLabel = [deviceBrand, deviceModel].filter(Boolean).join(' ');
  const estimatedTimeRaw = getEstimatedRepairTime(form.issue_types, form.issue_other);
  const estimatedTime = estimatedTimeRaw ? translateEstimate(estimatedTimeRaw, t) : null;
  const hasIssueSelection = form.issue_types.length > 0 || form.issue_other.trim().length > 0;
  const showDeadPolicy = isDeadMobileIssue(form.issue_types);
  const showScreenQuality = isScreenIssue(form.issue_types);

  const setField = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const handleBrandChange = (e) => {
    const brand_key = e.target.value;
    setForm((prev) => ({
      ...prev,
      brand_key,
      brand_manual: brand_key === 'Other' ? prev.brand_manual : '',
      model_key: '',
      model_manual: '',
      use_manual_model: brand_key === 'Other',
    }));
  };

  const toggleIssue = (id) => {
    setForm((prev) => {
      const issue_types = prev.issue_types.includes(id)
        ? prev.issue_types.filter((x) => x !== id)
        : [...prev.issue_types, id];
      return {
        ...prev,
        issue_types,
        dead_mobile_ack: issue_types.includes('suddenly_dead') ? prev.dead_mobile_ack : false,
        screen_quality: issue_types.includes('screen') ? prev.screen_quality : '',
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!form.customer_name.trim() || !form.phone.trim()) {
      setMessage({ type: 'error', text: t('repairForm.errNamePhone') });
      return;
    }
    if (!deviceBrand) {
      setMessage({ type: 'error', text: t('repairForm.errBrand') });
      return;
    }
    if (!deviceModel) {
      setMessage({ type: 'error', text: t('repairForm.errModel') });
      return;
    }
    if (!hasIssueSelection) {
      setMessage({ type: 'error', text: t('repairForm.errIssue') });
      return;
    }
    if (showDeadPolicy && !form.dead_mobile_ack) {
      setMessage({ type: 'error', text: t('repairForm.errDeadPolicy') });
      return;
    }
    if (!form.terms_accepted) {
      setMessage({ type: 'error', text: t('repairForm.errTerms') });
      return;
    }

    setSubmitting(true);
    try {
      const { booking } = await api.bookRepair({
        customer_name: form.customer_name.trim(),
        phone: form.phone.trim(),
        alternative_contact: form.alternative_contact.trim(),
        device_brand: deviceBrand,
        device_model: deviceModel,
        issue_types: form.issue_types,
        issue_other: form.issue_other.trim(),
        issue: buildIssueSummary(form.issue_types, form.issue_other, form.screen_quality),
        estimated_repair_time: estimatedTimeRaw,
        screen_quality: form.screen_quality || '',
        dead_mobile_acknowledged: showDeadPolicy ? form.dead_mobile_ack : false,
        terms_accepted: true,
      });
      setSuccessBooking(booking);
      setForm(INITIAL);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (successBooking) {
    return (
      <RepairSuccessPanel
        booking={successBooking}
        onReset={() => setSuccessBooking(null)}
      />
    );
  }

  return (
    <form className="glass-card repair-intake-form" onSubmit={handleSubmit} noValidate>
      <div className="repair-intake-head">
        <h2>{t('repair.intakeTitle')}</h2>
        <p>{t('repair.intakeDesc')}</p>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`}>{message.text}</div>
      )}

      <div className="repair-intake-section">
        <h3 className="repair-intake-section-title">{t('repairForm.section1')}</h3>
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="customer_name">{t('repairForm.fullName')} *</label>
            <input
              id="customer_name"
              name="customer_name"
              value={form.customer_name}
              onChange={(e) => setField('customer_name', e.target.value)}
              required
              autoComplete="name"
              placeholder="Asad Shahzad"
            />
          </div>
          <div className="form-group">
            <label htmlFor="phone">{t('repairForm.phone')} *</label>
            <input
              id="phone"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setField('phone', e.target.value)}
              required
              autoComplete="tel"
              placeholder="03039227000"
            />
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="alternative_contact">{t('repairForm.altContact')}</label>
          <input
            id="alternative_contact"
            name="alternative_contact"
            type="tel"
            value={form.alternative_contact}
            onChange={(e) => setField('alternative_contact', e.target.value)}
            placeholder={t('repairForm.altContactPh')}
          />
        </div>
      </div>

      <div className="repair-intake-section">
        <h3 className="repair-intake-section-title">{t('repairForm.section2')}</h3>
        <div className="form-row-2">
          <div className="form-group">
            <label htmlFor="brand_key">{t('repairForm.brand')} *</label>
            <select id="brand_key" name="brand_key" value={form.brand_key} onChange={handleBrandChange} required>
              <option value="">{t('repairForm.selectBrand')}</option>
              {brandOptions.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          </div>
          {form.brand_key === 'Other' ? (
            <div className="form-group">
              <label htmlFor="brand_manual">{t('repairForm.typeBrandManual')} *</label>
              <input
                id="brand_manual"
                name="brand_manual"
                value={form.brand_manual}
                onChange={(e) => setField('brand_manual', e.target.value)}
                placeholder={t('repairForm.brandManualPh')}
              />
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="model_key">{t('repairForm.model')} *</label>
              <select
                id="model_key"
                name="model_key"
                value={form.model_key}
                onChange={(e) => setField('model_key', e.target.value)}
                disabled={!form.brand_key}
                required={!form.use_manual_model}
              >
                <option value="">{t('repairForm.selectModel')}</option>
                {modelOptions.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {form.brand_key && form.brand_key !== 'Other' && (
          <label className="checkbox-row repair-manual-toggle">
            <input
              type="checkbox"
              checked={form.use_manual_model}
              onChange={(e) => setField('use_manual_model', e.target.checked)}
            />
            <span>{t('repairForm.typeModelManual')}</span>
          </label>
        )}

        {(form.use_manual_model || form.model_key === 'Other model' || form.brand_key === 'Other') && (
          <div className="form-group">
            <label htmlFor="model_manual">{t('repairForm.modelManual')} *</label>
            <input
              id="model_manual"
              name="model_manual"
              value={form.model_manual}
              onChange={(e) => setField('model_manual', e.target.value)}
              placeholder={t('repairForm.modelManualPh')}
            />
          </div>
        )}
      </div>

      <div className="repair-intake-section">
        <h3 className="repair-intake-section-title">{t('repairForm.section3')}</h3>
        <div className="repair-issue-grid">
          {REPAIR_ISSUE_OPTIONS.map((option) => (
            <label key={option.id} className={`repair-issue-chip ${form.issue_types.includes(option.id) ? 'active' : ''}`}>
              <input
                type="checkbox"
                checked={form.issue_types.includes(option.id)}
                onChange={() => toggleIssue(option.id)}
              />
              <span>{t(`repairForm.issue_${option.id}`)}</span>
            </label>
          ))}
        </div>
      </div>

      {showScreenQuality && (
        <div className="repair-intake-section repair-intake-screen-quality">
          <h3 className="repair-intake-section-title">{t('repairForm.sectionScreen')}</h3>
          <ScreenQualityPicker
            selected={form.screen_quality}
            onSelect={(id) => setField('screen_quality', id)}
            deviceLabel={deviceLabel || t('repair.myPhone')}
            compact
          />
        </div>
      )}

      {showDeadPolicy && (
        <div className="repair-policy-notice repair-policy-notice--dead glass-card">
          <strong>{t('repairForm.deadPolicyTitle')}</strong>
          <ul>
            {DEAD_POLICY_KEYS.map((key) => (
              <li key={key}>{t(`repairForm.${key}`)}</li>
            ))}
          </ul>
          <label className="checkbox-row repair-terms-row">
            <input
              type="checkbox"
              checked={form.dead_mobile_ack}
              onChange={(e) => setField('dead_mobile_ack', e.target.checked)}
            />
            <span>{t('repairForm.deadAck')}</span>
          </label>
        </div>
      )}

      <div className="repair-intake-section">
        <h3 className="repair-intake-section-title">{t('repairForm.section4')}</h3>
        <div className="form-group">
          <label htmlFor="issue_other">{t('repairForm.additionalDetails')}</label>
          <textarea
            id="issue_other"
            name="issue_other"
            value={form.issue_other}
            onChange={(e) => setField('issue_other', e.target.value)}
            placeholder={t('repairForm.otherPlaceholder')}
            rows={4}
          />
        </div>
      </div>

      {estimatedTime && (
        <div className={`repair-estimate-notice ${showDeadPolicy ? 'severe' : form.issue_types.some((id) => ['water_damage'].includes(id)) ? 'severe' : 'standard'}`}>
          <strong>{t('repairForm.estimateTitle')}</strong>
          <p>{estimatedTime}</p>
          <small>{t('repairForm.estimateNote')}</small>
        </div>
      )}

      <div className="repair-intake-section repair-intake-confirm">
        <h3 className="repair-intake-section-title">{t('repairForm.section5')}</h3>
        <label className="checkbox-row repair-terms-row">
          <input
            type="checkbox"
            checked={form.terms_accepted}
            onChange={(e) => setField('terms_accepted', e.target.checked)}
            required
          />
          <span>{t('repairForm.termsConfirm')}</span>
        </label>
        <PremiumButton type="submit" className="btn btn-primary repair-intake-submit" disabled={submitting}>
          {submitting ? t('repairForm.submitting') : t('repairForm.submit')}
        </PremiumButton>
      </div>
    </form>
  );
}
