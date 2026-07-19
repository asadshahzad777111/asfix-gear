import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { uploadProductImageFile } from '../../utils/productImageUpload';

const DRAFT_KEY = 'asfix_hero_ads_draft_v1';
const MAX_SLIDES = 8;

const emptySlide = () => ({ image: '', title: '', subtitle: '', href: '/shop' });

function normalizeSlides(slides) {
  if (!Array.isArray(slides)) return [];
  return slides.slice(0, MAX_SLIDES).map((s) => ({
    image: String(s?.image || s?.src || ''),
    title: String(s?.title || ''),
    subtitle: String(s?.subtitle || ''),
    href: String(s?.href || '/shop'),
  }));
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed?.slides)) return null;
    return normalizeSlides(parsed.slides);
  } catch {
    return null;
  }
}

function saveDraft(slides) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ slides, saved_at: Date.now() }));
  } catch {
    /* ignore quota */
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export default function AdminHeroAds() {
  const [heroSlides, setHeroSlides] = useState([]);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const fileInputs = useRef({});
  const skipDraftWrite = useRef(true);

  useEffect(() => {
    let cancelled = false;
    const draft = loadDraft();

    api
      .getStorefrontImages()
      .then((data) => {
        if (cancelled) return;
        const serverSlides = normalizeSlides(data?.hero_slides);
        if (draft?.length && JSON.stringify(draft) !== JSON.stringify(serverSlides)) {
          setHeroSlides(draft);
          setDraftRestored(true);
          setStatus('Local draft restored — Save to publish on the website.');
        } else {
          setHeroSlides(serverSlides);
        }
        setLoaded(true);
        skipDraftWrite.current = false;
      })
      .catch(() => {
        if (cancelled) return;
        if (draft?.length) {
          setHeroSlides(draft);
          setDraftRestored(true);
          setStatus('Could not load server — showing local draft.');
        }
        setLoaded(true);
        skipDraftWrite.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!loaded || skipDraftWrite.current) return;
    saveDraft(heroSlides);
  }, [heroSlides, loaded]);

  const updateSlide = (index, field, value) => {
    setHeroSlides((prev) =>
      prev.map((slide, i) => (i === index ? { ...slide, [field]: value } : slide))
    );
  };

  const addSlide = () => {
    setHeroSlides((prev) => (prev.length >= MAX_SLIDES ? prev : [...prev, emptySlide()]));
  };

  const removeSlide = (index) => {
    setHeroSlides((prev) => prev.filter((_, i) => i !== index));
  };

  const moveSlide = (index, dir) => {
    setHeroSlides((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const uploadSlideImage = async (index, file) => {
    if (!file) return;
    setStatus('');
    setUploadingIndex(index);
    try {
      const url = await uploadProductImageFile(file, {
        onPreview: (preview) => updateSlide(index, 'image', preview),
      });
      updateSlide(index, 'image', url);
      setStatus('Photo ready — press Save Home Ads to show it on the site.');
    } catch (err) {
      setStatus(err.message || 'Image upload failed');
    } finally {
      setUploadingIndex(null);
      const input = fileInputs.current[index];
      if (input) input.value = '';
    }
  };

  const save = async () => {
    setSaving(true);
    setStatus('');
    try {
      const current = await api.getStorefrontImages();
      const hero_slides = heroSlides
        .map((s) => ({
          image: String(s.image || '').trim(),
          title: String(s.title || '').trim(),
          subtitle: String(s.subtitle || '').trim(),
          href: String(s.href || '/shop').trim() || '/shop',
        }))
        .filter((s) => s.image && !s.image.startsWith('blob:'));

      if (!hero_slides.length) {
        setStatus('Add at least one photo before saving.');
        setSaving(false);
        return;
      }

      const invalid = hero_slides.find(
        (s) => !/^https?:\/\//i.test(s.image) && !s.image.startsWith('/')
      );
      if (invalid) {
        setStatus('Wait for photo upload to finish, then save again.');
        setSaving(false);
        return;
      }

      await api.updateStorefrontImages({
        category_images: current?.category_images || {},
        hero_slides,
      });
      setHeroSlides(hero_slides);
      clearDraft();
      setDraftRestored(false);
      setStatus('Saved — home page will show your selected photos.');
    } catch (err) {
      setStatus(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const discardDraft = () => {
    clearDraft();
    setDraftRestored(false);
    api
      .getStorefrontImages()
      .then((data) => {
        setHeroSlides(normalizeSlides(data?.hero_slides));
        setStatus('Draft discarded — showing live website ads.');
      })
      .catch(() => setStatus('Could not reload live ads.'));
  };

  return (
    <div className="wp-settings admin-hero-ads">
      <div className="wp-postbox">
        <div className="wp-postbox-head">Home floating ads (hero photos)</div>
        <div className="wp-postbox-body">
          <p style={{ fontSize: '0.88rem', color: '#50575e', marginTop: 0, lineHeight: 1.45 }}>
            Yahan se homepage header ke neeche wali floating / sliding photos control hoti hain.
            Apni marzi ki pic upload karo, title/ad text likho, Save dabao — website pe wahi chalega.
          </p>
          <p style={{ fontSize: '0.82rem', color: '#646970', marginTop: 0 }}>
            Max {MAX_SLIDES} slides. Changes apply without redeploy.{' '}
            <Link to="/" target="_blank" rel="noreferrer">
              View home page
            </Link>
          </p>

          {!loaded && <p style={{ fontSize: '0.84rem' }}>Loading…</p>}

          {heroSlides.length === 0 && loaded && (
            <p style={{ fontSize: '0.84rem', color: '#646970' }}>
              Abhi koi custom ad nahi — niche + Add photo se pehli slide banao.
            </p>
          )}

          {heroSlides.map((slide, index) => (
            <div
              key={`hero-ad-${index}`}
              className="admin-hero-ad-card"
              style={{
                border: '1px solid #dcdcde',
                borderRadius: 10,
                padding: '0.9rem',
                marginBottom: '0.85rem',
                background: '#fcfcfc',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '0.5rem',
                  marginBottom: '0.65rem',
                  flexWrap: 'wrap',
                }}
              >
                <strong style={{ fontSize: '0.9rem' }}>Ad {index + 1}</strong>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="wp-button wp-button--secondary"
                    disabled={index === 0}
                    onClick={() => moveSlide(index, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="wp-button wp-button--secondary"
                    disabled={index >= heroSlides.length - 1}
                    onClick={() => moveSlide(index, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="wp-button wp-button--secondary"
                    onClick={() => removeSlide(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <label
                htmlFor={`hero-ad-upload-${index}`}
                style={{
                  display: 'block',
                  border: '2px dashed #c3c4c7',
                  borderRadius: 10,
                  padding: slide.image ? '0.4rem' : '1.25rem',
                  textAlign: 'center',
                  cursor: uploadingIndex === index ? 'wait' : 'pointer',
                  background: '#fff',
                  marginBottom: '0.65rem',
                }}
              >
                {slide.image ? (
                  <img
                    src={slide.image}
                    alt=""
                    style={{
                      width: '100%',
                      maxHeight: 200,
                      objectFit: 'cover',
                      borderRadius: 8,
                      display: 'block',
                    }}
                  />
                ) : (
                  <span style={{ fontSize: '0.9rem', color: '#1d2327', fontWeight: 600 }}>
                    {uploadingIndex === index ? 'Uploading…' : 'Tap to choose photo from gallery'}
                  </span>
                )}
                <input
                  ref={(el) => {
                    fileInputs.current[index] = el;
                  }}
                  id={`hero-ad-upload-${index}`}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  disabled={uploadingIndex === index}
                  onChange={(e) => uploadSlideImage(index, e.target.files?.[0])}
                />
              </label>

              {slide.image && (
                <div style={{ marginBottom: '0.65rem' }}>
                  <label htmlFor={`hero-ad-upload-${index}`} className="wp-button wp-button--secondary" style={{ cursor: 'pointer' }}>
                    {uploadingIndex === index ? 'Uploading…' : 'Change photo'}
                  </label>
                </div>
              )}

              <label style={{ display: 'block', marginBottom: '0.55rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Ad title</span>
                <input
                  type="text"
                  className="wp-input"
                  style={{ width: '100%', marginTop: 4 }}
                  value={slide.title}
                  onChange={(e) => updateSlide(index, 'title', e.target.value)}
                  placeholder="Cases & Screen Guards"
                  maxLength={120}
                />
              </label>

              <label style={{ display: 'block', marginBottom: '0.55rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Ad text (subtitle)</span>
                <input
                  type="text"
                  className="wp-input"
                  style={{ width: '100%', marginTop: 4 }}
                  value={slide.subtitle}
                  onChange={(e) => updateSlide(index, 'subtitle', e.target.value)}
                  placeholder="Premium protection — WhatsApp orders welcome"
                  maxLength={160}
                />
              </label>

              <label style={{ display: 'block' }}>
                <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Tap opens (link)</span>
                <input
                  type="text"
                  className="wp-input"
                  style={{ width: '100%', marginTop: 4 }}
                  value={slide.href}
                  onChange={(e) => updateSlide(index, 'href', e.target.value)}
                  placeholder="/shop or /shop?category=Cases"
                  maxLength={200}
                />
              </label>
            </div>
          ))}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: 4 }}>
            <button
              type="button"
              className="wp-button wp-button--secondary"
              onClick={addSlide}
              disabled={heroSlides.length >= MAX_SLIDES}
            >
              + Add photo / ad
            </button>
            <button type="button" className="wp-button" onClick={save} disabled={saving || !loaded}>
              {saving ? 'Saving…' : 'Save Home Ads'}
            </button>
            {draftRestored && (
              <button type="button" className="wp-button wp-button--secondary" onClick={discardDraft}>
                Discard local draft
              </button>
            )}
          </div>
          {status && (
            <p style={{ marginTop: 10, fontSize: '0.86rem', color: status.includes('fail') || status.includes('Could not') ? '#b32d2e' : '#1d2327' }}>
              {status}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
