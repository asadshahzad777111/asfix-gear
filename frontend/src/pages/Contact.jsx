import { useState, useEffect } from 'react';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import PageHeader from '../components/PageHeader';
import LocationSection from '../components/LocationSection';
import { SHOP, generalWhatsAppMessage } from '../config/shop';
import { useTranslation } from '../context/LanguageContext';

export default function Contact() {
  const { t } = useTranslation();
  const { user, isCustomer } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });

  useEffect(() => {
    if (!isCustomer || !user) return;
    setForm((prev) => ({
      ...prev,
      name: user.name || prev.name,
      email: user.email || prev.email,
      phone: user.phone || prev.phone,
    }));
  }, [isCustomer, user]);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.sendContact(form);
      setMessage({ type: 'success', text: res.message });
      setForm({ name: '', email: '', phone: '', message: '' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSubmitting(false);
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
                <a href={generalWhatsAppMessage()} target="_blank" rel="noopener noreferrer" className="contact-link">{SHOP.phone}</a>
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
            <a href={generalWhatsAppMessage()} target="_blank" rel="noopener noreferrer" className="btn btn-whatsapp" style={{ width: '100%' }}>
              💬 {t('contact.whatsappBtn')}
            </a>
          </div>

          <form className="glass-card booking-form" onSubmit={handleSubmit}>
            <h2>{t('contact.sendMessage')}</h2>
            <p>{t('contact.formHint')}</p>

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
              <label htmlFor="message">{t('contact.message')} *</label>
              <textarea id="message" name="message" value={form.message} onChange={handleChange} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ width: '100%' }}>
              {submitting ? t('contact.sending') : t('contact.send')}
            </button>
          </form>
        </div>
      </section>

      <LocationSection />
    </>
  );
}
