import { useEffect, useRef, useState } from 'react';
import { api } from '../../api/client';
import { CATEGORIES, DEFAULT_IMAGES } from '../../config/products';
import { uploadProductImageFile } from '../../utils/productImageUpload';

const KEYS = CATEGORIES.filter((c) => c !== 'Gaming');

const emptySlide = () => ({ image: '', title: '', subtitle: '', href: '/shop' });

function normalizeSlides(slides) {
  if (!Array.isArray(slides)) return [];
  return slides.map((s) => ({
    image: String(s?.image || s?.src || ''),
    title: String(s?.title || ''),
    subtitle: String(s?.subtitle || ''),
    href: String(s?.href || '/shop'),
  }));
}

export default function AdminStorefrontImages() {
  const [images, setImages] = useState(() =>
    Object.fromEntries(KEYS.map((k) => [k, DEFAULT_IMAGES[k] || '']))
  );
  const [heroSlides, setHeroSlides] = useState([]);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const fileInputs = useRef({});

  useEffect(() => {
    api
      .getStorefrontImages()
      .then((data) => {
        if (data?.category_images) {
          setImages((prev) => ({ ...prev, ...data.category_images }));
        }
        if (Array.isArray(data?.hero_slides)) {
          setHeroSlides(normalizeSlides(data.hero_slides));
        }
      })
      .catch(() => {});
  }, []);

  const updateSlide = (index, field, value) => {
    setHeroSlides((prev) =>
      prev.map((slide, i) => (i === index ? { ...slide, [field]: value } : slide))
    );
  };

  const addSlide = () => {
    setHeroSlides((prev) => [...prev, emptySlide()]);
  };

  const removeSlide = (index) => {
    setHeroSlides((prev) => prev.filter((_, i) => i !== index));
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
      const hero_slides = heroSlides
        .map((s) => ({
          image: String(s.image || '').trim(),
          title: String(s.title || '').trim(),
          subtitle: String(s.subtitle || '').trim(),
          href: String(s.href || '/shop').trim() || '/shop',
        }))
        .filter((s) => s.image);

      await api.updateStorefrontImages({ category_images: images, hero_slides });
      setHeroSlides(hero_slides);
      setStatus('Saved — home gallery will use these URLs.');
    } catch (err) {
      setStatus(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wp-postbox">
      <div className="wp-postbox-head">Storefront gallery images</div>
      <div className="wp-postbox-body">
        <p style={{ fontSize: '0.84rem', color: '#50575e', marginTop: 0 }}>
          Set collection images and hero carousel slides. Changes apply site-wide without a redeploy.
        </p>

        <h3 style={{ fontSize: '0.9rem', margin: '0 0 0.65rem' }}>Category / trending images</h3>
        {KEYS.map((key) => (
          <label key={key} style={{ display: 'block', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{key}</span>
            <input
              type="url"
              className="wp-input"
              style={{ width: '100%', marginTop: 4 }}
              value={images[key] || ''}
              onChange={(e) => setImages((prev) => ({ ...prev, [key]: e.target.value }))}
              placeholder="https://…"
            />
            {(images[key] || DEFAULT_IMAGES[key]) && (
              <img
                src={images[key] || DEFAULT_IMAGES[key]}
                alt=""
                style={{ marginTop: 6, width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }}
              />
            )}
          </label>
        ))}

        <h3 style={{ fontSize: '0.9rem', margin: '1.25rem 0 0.35rem' }}>Hero slides</h3>
        <p style={{ fontSize: '0.8rem', color: '#50575e', marginTop: 0 }}>
          Each slide needs an image (URL or upload). Title, subtitle, and link are optional.
        </p>

        {heroSlides.length === 0 && (
          <p style={{ fontSize: '0.84rem', color: '#646970' }}>No hero slides yet — add one below.</p>
        )}

        {heroSlides.map((slide, index) => (
          <div
            key={`hero-slide-${index}`}
            style={{
              border: '1px solid #dcdcde',
              borderRadius: 8,
              padding: '0.85rem',
              marginBottom: '0.75rem',
              background: '#fcfcfc',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.65rem',
              }}
            >
              <strong style={{ fontSize: '0.85rem' }}>Slide {index + 1}</strong>
              <button type="button" className="wp-button wp-button--secondary" onClick={() => removeSlide(index)}>
                Remove
              </button>
            </div>

            <label style={{ display: 'block', marginBottom: '0.55rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Image URL</span>
              <input
                type="url"
                className="wp-input"
                style={{ width: '100%', marginTop: 4 }}
                value={slide.image}
                onChange={(e) => updateSlide(index, 'image', e.target.value)}
                placeholder="https://… or upload below"
              />
            </label>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '0.55rem' }}>
              <input
                ref={(el) => {
                  fileInputs.current[index] = el;
                }}
                type="file"
                accept="image/*"
                className="sr-only"
                id={`hero-slide-upload-${index}`}
                onChange={(e) => uploadSlideImage(index, e.target.files?.[0])}
              />
              <label htmlFor={`hero-slide-upload-${index}`} className="wp-button wp-button--secondary" style={{ cursor: 'pointer' }}>
                {uploadingIndex === index ? 'Uploading…' : 'Upload image'}
              </label>
              {slide.image && (
                <img
                  src={slide.image}
                  alt=""
                  style={{ width: 72, height: 44, objectFit: 'cover', borderRadius: 6, border: '1px solid #dcdcde' }}
                />
              )}
            </div>

            <label style={{ display: 'block', marginBottom: '0.55rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Title</span>
              <input
                type="text"
                className="wp-input"
                style={{ width: '100%', marginTop: 4 }}
                value={slide.title}
                onChange={(e) => updateSlide(index, 'title', e.target.value)}
                placeholder="Premium Cases"
                maxLength={120}
              />
            </label>

            <label style={{ display: 'block', marginBottom: '0.55rem' }}>
              <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Subtitle</span>
              <input
                type="text"
                className="wp-input"
                style={{ width: '100%', marginTop: 4 }}
                value={slide.subtitle}
                onChange={(e) => updateSlide(index, 'subtitle', e.target.value)}
                placeholder="iPhone series"
                maxLength={160}
              />
            </label>

            <label style={{ display: 'block' }}>
              <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Link (href)</span>
              <input
                type="text"
                className="wp-input"
                style={{ width: '100%', marginTop: 4 }}
                value={slide.href}
                onChange={(e) => updateSlide(index, 'href', e.target.value)}
                placeholder="/shop"
                maxLength={200}
              />
            </label>
          </div>
        ))}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: 4 }}>
          <button type="button" className="wp-button wp-button--secondary" onClick={addSlide}>
            + Add slide
          </button>
          <button type="button" className="wp-button" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save gallery'}
          </button>
        </div>
        {status && <p style={{ marginTop: 8, fontSize: '0.84rem' }}>{status}</p>}
      </div>
    </div>
  );
}
