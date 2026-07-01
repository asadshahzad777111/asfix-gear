import { useState, useEffect, useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import LocationSection from '../components/LocationSection';
import { SHOP, whatsappLink } from '../config/shop';
import { composeContactWhatsAppBody } from '../utils/contactPrefill';
import { useTranslation } from '../context/LanguageContext';

function readPrefill(searchParams, locationState) {
  const fromState = locationState?.contactPrefill;
  if (fromState?.subject || fromState?.message) {
    return {
      subject: fromState.subject || '',
      message: fromState.message || '',
      prefilled: true,
    };
  }

  const subject = searchParams.get('subject') || '';
  const message = searchParams.get('message') || '';
  return {
    subject,
    message,
    prefilled: Boolean(subject || message),
  };
}

export default function Contact() {
  const { t } = useTranslation();
  const { user, isCustomer } = useAuth();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const initialPrefill = useMemo(
    () => readPrefill(searchParams, location.state),
    [searchParams, location.state]
  );

  const [submitting, setSubmitting] = useState(false);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: initialPrefill.subject,
    message: initialPrefill.message,
  });
  const [isPrefilled, setIsPrefilled] = useState(initialPrefill.prefilled);

  useEffect(() => {
    const prefill = readPrefill(searchParams, location.state);
    if (prefill.prefilled) {
      setForm((prev) => ({
        ...prev,
        subject: prefill.subject,
        message: prefill.message,
      }));
      setIsPrefilled(true);
    }
  }, [searchParams, location.state]);

  useEffect(() => {
    if (!isCustomer || !user) return;
    setForm((prev) => ({
      ...prev,
      name: user.name || prev.name,
      email: user.email || prev.email,
      phone: user.phone || prev.phone,
    }));
  }, [isCustomer, user]);

  const waHref = whatsappLink(composeContactWhatsAppBody(form));

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const submitContactMessage = () => {
    const body = form.subject.trim()
      ? `Subject: ${form.subject.trim()}\n\n${form.message.trim()}`
      : form.message.trim();
    return api.sendContact({
      name: form.name,
      email: form.email,
      phone: form.phone,
      message: body,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await submitContactMessage();
      setMessage({ type: 'success', text: res.message });
      setForm({ name: '', email: '', phone: '', subject: '', message: '' });
      setIsPrefilled(false);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Guarantee the message lands in Admin Messages / Ops desk BEFORE the
  // customer navigates away to WhatsApp — WhatsApp itself still requires the
  // customer to manually tap send in their own app, so this is the part of
  // the flow the site can make reliable.
  const handleSendWhatsApp = async () => {
    if (sendingWhatsApp) return;
    setSendingWhatsApp(true);
    try {
      if (form.name.trim() && form.message.trim()) {
        await submitContactMessage();
      }
    } catch (err) {
      console.error('Contact WhatsApp auto-capture failed:', err.message);
    } finally {
      setSendingWhatsApp(false);
      window.open(waHref, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={`📞 ${t('contact.eyebrow')}`}
        title={t('contact.title')}
        subtitle={`${SHOP.name} — ${SHOP.owner}. ${t('contact.subtitle')}`}
      />

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="container contact-grid">
          <div className="glass-card contact-info-card">
            <div className="contact-item">
              <div className="icon">📍</div>
              <div>
                <h4>{t('contact.address')}</h4>
                <p>{SHOP.addressLine1}</p>
                <p>{SHOP.addressLine2}</p>
                {SHOP.landmark && <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>📌 {SHOP.landmark}</p>}
                <p style={{ color: 'var(--mint)', fontWeight: 600 }}>{SHOP.city}</p>
              </div>
            </div>
            <div className="contact-item">
              <div className="icon">📞</div>
              <div>
                <h4>{t('contact.phone')}</h4>
                <a href={`tel:+${SHOP.phoneIntl}`} className="contact-link">{SHOP.phone}</a>
              </div>
            </div>
            <div className="contact-item">
              <div className="icon">💬</div>
              <div>
                <h4>{t('nav.whatsapp')}</h4>
                <a href={`tel:+${SHOP.phoneIntl}`} className="contact-link">{SHOP.phone}</a>
              </div>
            </div>
            <div className="contact-item">
              <div className="icon">✉️</div>
              <div>
                <h4>{t('contact.email')}</h4>
                <a href={`mailto:${SHOP.email}`} className="contact-link">{SHOP.email}</a>
              </div>
            </div>
            <div className="contact-item">
              <div className="icon">🕐</div>
              <div>
                <h4>{t('contact.hours')}</h4>
                <p>{t('shop.hours')}</p>
              </div>
            </div>
            <a href="#contact-form" className="btn btn-outline" style={{ width: '100%' }}>
              {t('contact.sendMessage')}
            </a>
          </div>

          <form id="contact-form" className="glass-card booking-form" onSubmit={handleSubmit}>
            <h2>{t('contact.sendMessage')}</h2>
            <p>{t('contact.formHint')}</p>

            {isPrefilled && (
              <div className="alert alert-success contact-prefill-banner">
                {t('contact.prefillBanner')}
              </div>
            )}

            {message.text && (
              <div className={`alert alert-${message.type === 'success' ? 'success' : 'error'}`}>{message.text}</div>
            )}

            <div className="form-group">
              <label htmlFor="name">{t('contact.name')} *</label>
              <input id="name" name="name" value={form.name} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label htmlFor="email">{t('contact.email')}</label>
              <input id="email" name="email" type="email" value={form.email} onChange={handleChange} placeholder={t('contact.emailOptional')} />
            </div>
            <div className="form-group">
              <label htmlFor="phone">{t('contact.phone')}</label>
              <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} placeholder={SHOP.phone} />
            </div>
            <div className="form-group">
              <label htmlFor="subject">{t('contact.subject')}</label>
              <input id="subject" name="subject" value={form.subject} onChange={handleChange} placeholder={t('contact.subjectPlaceholder')} />
            </div>
            <div className="form-group">
              <label htmlFor="message">{t('contact.message')} *</label>
              <textarea id="message" name="message" value={form.message} onChange={handleChange} required rows={8} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? t('contact.sending') : t('contact.send')}
            </button>
            <button
              type="button"
              onClick={handleSendWhatsApp}
              disabled={sendingWhatsApp}
              className="btn btn-whatsapp"
              style={{ width: '100%', marginTop: '0.75rem' }}
            >
              💬 {t('contact.sendWhatsApp')}
            </button>
            <p className="field-hint" style={{ marginTop: '0.5rem', textAlign: 'center' }}>
              {t('contact.whatsappHint')}
            </p>
          </form>
        </div>
      </section>

      <LocationSection />
    </>
  );
}
