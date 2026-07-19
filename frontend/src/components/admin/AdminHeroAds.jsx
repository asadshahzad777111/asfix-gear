import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { defaultHeroSlidesForAdmin } from '../../config/heroSlides';
import { getDefaultImage } from '../../config/products';
import { productPath } from '../../utils/slug';
import { detectMediaType, uploadHeroMediaFile } from '../../utils/heroMediaUpload';
import { ProductPrice } from '../DiscountPicker';

const DRAFT_KEY = 'asfix_hero_ads_draft_v3';
const MAX_SLIDES = 8;

const emptySlide = () => ({
  image: '',
  media_type: 'image',
  title: '',
  subtitle: '',
  href: '/shop',
  product_id: null,
  source: 'custom',
});

function normalizeSlides(slides) {
  if (!Array.isArray(slides)) return [];
  return slides.slice(0, MAX_SLIDES).map((s) => {
    const image = String(s?.image || s?.src || '');
    return {
      image,
      media_type: detectMediaType(image, s?.media_type),
      title: String(s?.title || ''),
      subtitle: String(s?.subtitle || ''),
      href: String(s?.href || '/shop'),
      product_id: s?.product_id || null,
      source: s?.source || (s?.product_id ? 'product' : 'custom'),
    };
  });
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

function productImage(product) {
  const gallery = Array.isArray(product?.gallery) ? product.gallery : [];
  return (
    String(product?.image || '').trim()
    || String(gallery[0] || '').trim()
    || getDefaultImage(product?.category)
  );
}

export default function AdminHeroAds() {
  const [heroSlides, setHeroSlides] = useState([]);
  const [usingDefaults, setUsingDefaults] = useState(false);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const fileInputs = useRef({});
  const skipDraftWrite = useRef(true);
  const heroSlidesRef = useRef(heroSlides);
  heroSlidesRef.current = heroSlides;

  useEffect(() => {
    let cancelled = false;
    const draft = loadDraft();

    Promise.all([
      api.getStorefrontImages().catch(() => null),
      api.getProducts().catch(() => []),
    ]).then(([data, productList]) => {
      if (cancelled) return;
      const list = Array.isArray(productList) ? productList : productList?.products || [];
      setProducts(list);

      const serverSlides = normalizeSlides(data?.hero_slides);
        if (draft?.length && JSON.stringify(draft) !== JSON.stringify(serverSlides.length ? serverSlides : defaultHeroSlidesForAdmin())) {
          setHeroSlides(draft);
          setUsingDefaults(false);
          setDraftRestored(true);
          setDirty(true);
          setStatus('Pehli wali upload draft me mili — neeche Save changes dabao taake live pe aa jaye.');
        } else if (serverSlides.length) {
        setHeroSlides(serverSlides);
        setUsingDefaults(false);
      } else {
        // Show the slides currently running on the home page (defaults)
        setHeroSlides(defaultHeroSlidesForAdmin());
        setUsingDefaults(true);
        setStatus('Ye abhi home pe chal rahi default slides hain — edit / product add / naya photo laga ke Save karo.');
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

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const active = products.filter((p) => p && p.status !== 'archived' && p.status !== 'hidden');
    if (!q) return active.slice(0, 40);
    return active
      .filter((p) => {
        const hay = `${p.name || ''} ${p.category || ''} ${p.brand || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 40);
  }, [products, productSearch]);

  const markDirty = () => {
    setUsingDefaults(false);
    setDirty(true);
  };

  const updateSlide = (index, field, value) => {
    markDirty();
    setHeroSlides((prev) =>
      prev.map((slide, i) => (i === index ? { ...slide, [field]: value, source: 'custom' } : slide))
    );
  };

  const addSlide = () => {
    markDirty();
    setHeroSlides((prev) => (prev.length >= MAX_SLIDES ? prev : [...prev, emptySlide()]));
  };

  const removeSlide = (index) => {
    markDirty();
    setHeroSlides((prev) => prev.filter((_, i) => i !== index));
  };

  const moveSlide = (index, dir) => {
    markDirty();
    setHeroSlides((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const addProductAsAd = async (product) => {
    if (!product) return;
    if (heroSlidesRef.current.length >= MAX_SLIDES) {
      setStatus(`Max ${MAX_SLIDES} slides — pehle koi slide remove karo.`);
      return;
    }
    const image = productImage(product);
    const href = productPath(product);
    const priceBit = product.price != null ? `Rs ${Number(product.price).toLocaleString('en-PK')}` : '';
    const next = {
      image,
      media_type: 'image',
      title: String(product.name || 'Product').slice(0, 120),
      subtitle: [product.category, priceBit].filter(Boolean).join(' · ').slice(0, 160),
      href,
      product_id: product.id || null,
      source: 'product',
    };
    markDirty();
    const nextSlides = [...heroSlidesRef.current, next];
    setHeroSlides(nextSlides);
    setStatus(`“${product.name}” add ho gaya — live pe save ho raha hai…`);
    await save(nextSlides, { silent: true });
  };

  const save = async (slidesOverride, { silent } = {}) => {
    const sourceSlides = slidesOverride || heroSlidesRef.current;
    setSaving(true);
    if (!silent) setStatus('');
    try {
      const current = await api.getStorefrontImages();
      const hero_slides = sourceSlides
        .map((s, i) => ({
          id: s.product_id ? `product-${s.product_id}` : `slide-${i}`,
          image: String(s.image || '').trim(),
          media_type: detectMediaType(s.image, s.media_type),
          title: String(s.title || '').trim(),
          subtitle: String(s.subtitle || '').trim(),
          href: String(s.href || '/shop').trim() || '/shop',
          product_id: s.product_id || null,
        }))
        .filter((s) => s.image && !s.image.startsWith('blob:') && !s.image.startsWith('data:'));

      if (!hero_slides.length) {
        setStatus('Add at least one photo or product before saving.');
        setSaving(false);
        return false;
      }

      const invalid = hero_slides.find(
        (s) => !/^https?:\/\//i.test(s.image) && !s.image.startsWith('/')
      );
      if (invalid) {
        setStatus('Wait for photo upload to finish, then save again.');
        setSaving(false);
        return false;
      }

      await api.updateStorefrontImages({
        category_images: current?.category_images || {},
        hero_slides,
      });
      setHeroSlides(normalizeSlides(hero_slides));
      setUsingDefaults(false);
      setDirty(false);
      setLastSavedAt(Date.now());
      clearDraft();
      setDraftRestored(false);
      setStatus('✓ Saved — live home page pe ab yehi ads dikhengi. Redeploy se ye wipe nahi hongi.');
      return true;
    } catch (err) {
      setStatus(err.message || 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const uploadSlideMedia = async (index, file) => {
    if (!file) return;
    setStatus('');
    setUploadingIndex(index);
    markDirty();
    try {
      const { url, media_type } = await uploadHeroMediaFile(file, {
        onPreview: (preview, type) => {
          setHeroSlides((prev) =>
            prev.map((slide, i) =>
              i === index
                ? { ...slide, image: preview, media_type: type || 'image', source: 'custom' }
                : slide
            )
          );
        },
      });
      const nextSlides = heroSlidesRef.current.map((slide, i) =>
        i === index
          ? { ...slide, image: url, media_type: media_type || 'image', source: 'custom' }
          : slide
      );
      setHeroSlides(nextSlides);
      setStatus('Uploading done — ab live pe save ho raha hai…');
      await save(nextSlides, { silent: true });
    } catch (err) {
      setStatus(err.message || 'Upload failed');
    } finally {
      setUploadingIndex(null);
      const input = fileInputs.current[index];
      if (input) input.value = '';
    }
  };

  const discardDraft = () => {
    clearDraft();
    setDraftRestored(false);
    api
      .getStorefrontImages()
      .then((data) => {
        const serverSlides = normalizeSlides(data?.hero_slides);
        if (serverSlides.length) {
          setHeroSlides(serverSlides);
          setUsingDefaults(false);
        } else {
          setHeroSlides(defaultHeroSlidesForAdmin());
          setUsingDefaults(true);
        }
        setStatus('Draft discarded — showing live website ads.');
      })
      .catch(() => setStatus('Could not reload live ads.'));
  };

  const resetToDefault = async () => {
    if (!window.confirm('Custom home ads hata ke default slides wapas?')) return;
    setSaving(true);
    setStatus('');
    try {
      const current = await api.getStorefrontImages();
      await api.updateStorefrontImages({
        category_images: current?.category_images || {},
        hero_slides: [],
      });
      setHeroSlides(defaultHeroSlidesForAdmin());
      setUsingDefaults(true);
      clearDraft();
      setDraftRestored(false);
      setStatus('Default slides restore ho gayi — home pe wahi chalengi.');
    } catch (err) {
      setStatus(err.message || 'Reset failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="wp-settings admin-hero-ads">
      <div className="wp-postbox">
        <div className="wp-postbox-head">Home floating ads (hero photos)</div>
        <div className="wp-postbox-body">
          <p style={{ fontSize: '0.88rem', color: '#50575e', marginTop: 0, lineHeight: 1.45 }}>
            Photo/video upload ke baad <strong>auto-save</strong> ho jata hai (live site update).
            Title/text change ke baad neeche sticky <strong>Save changes</strong> dabao.
            MongoDB pe save hota hai — redeploy se ye ads wipe nahi hongi.
          </p>
          <p style={{ fontSize: '0.82rem', color: '#646970', marginTop: 0 }}>
            Max {MAX_SLIDES} slides.{' '}
            {usingDefaults ? <strong>Default slides</strong> : <strong>Custom ads (live)</strong>}
            {lastSavedAt ? ` · Last saved ${new Date(lastSavedAt).toLocaleTimeString()}` : ''}
            {' · '}
            <Link to="/" target="_blank" rel="noreferrer">
              View home page
            </Link>
          </p>
          {dirty && (
            <p className="admin-hero-ads-unsaved" style={{ fontSize: '0.86rem', color: '#b32d2e', fontWeight: 600 }}>
              Unsaved changes — neeche “Save changes” dabao.
            </p>
          )}

          {!loaded && <p style={{ fontSize: '0.84rem' }}>Loading…</p>}

          {heroSlides.map((slide, index) => (
            <div
              key={`hero-ad-${index}-${slide.product_id || 'x'}`}
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
                <strong style={{ fontSize: '0.9rem' }}>
                  Ad {index + 1}
                  {slide.media_type === 'video' ? ' · Video' : ''}
                  {slide.source === 'product' ? ' · Product' : ''}
                  {slide.source === 'default' ? ' · Default' : ''}
                </strong>
                <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                  <button type="button" className="wp-button wp-button--secondary" disabled={index === 0} onClick={() => moveSlide(index, -1)}>
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
                  <button type="button" className="wp-button wp-button--secondary" onClick={() => removeSlide(index)}>
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
                  slide.media_type === 'video' ? (
                    <video
                      src={slide.image}
                      muted
                      playsInline
                      loop
                      autoPlay
                      style={{
                        width: '100%',
                        maxHeight: 200,
                        objectFit: 'cover',
                        borderRadius: 8,
                        display: 'block',
                        background: '#111',
                      }}
                    />
                  ) : (
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
                  )
                ) : (
                  <span style={{ fontSize: '0.9rem', color: '#1d2327', fontWeight: 600 }}>
                    {uploadingIndex === index
                      ? 'Uploading…'
                      : 'Tap — gallery se photo ya short video choose karo'}
                  </span>
                )}
                <input
                  ref={(el) => {
                    fileInputs.current[index] = el;
                  }}
                  id={`hero-ad-upload-${index}`}
                  type="file"
                  accept="image/*,video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov"
                  className="sr-only"
                  disabled={uploadingIndex === index}
                  onChange={(e) => uploadSlideMedia(index, e.target.files?.[0])}
                />
              </label>

              {slide.image && (
                <div style={{ marginBottom: '0.65rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  <label htmlFor={`hero-ad-upload-${index}`} className="wp-button wp-button--secondary" style={{ cursor: 'pointer' }}>
                    {uploadingIndex === index ? 'Uploading…' : 'Change photo / video (gallery)'}
                  </label>
                </div>
              )}

              <label style={{ display: 'block', marginBottom: '0.55rem' }}>
                <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Media URL (optional)</span>
                <input
                  type="url"
                  className="wp-input"
                  style={{ width: '100%', marginTop: 4 }}
                  value={slide.image?.startsWith('blob:') ? '' : slide.image}
                  onChange={(e) => {
                    const value = e.target.value;
                    markDirty();
                    setHeroSlides((prev) =>
                      prev.map((item, i) =>
                        i === index
                          ? {
                              ...item,
                              image: value,
                              media_type: detectMediaType(value, item.media_type),
                              source: 'custom',
                            }
                          : item
                      )
                    );
                  }}
                  placeholder="https://… image or .mp4/.webm"
                />
              </label>

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
                  placeholder="/shop or /shop/p/your-product"
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
              + Blank photo / video slide
            </button>
            {draftRestored && (
              <button type="button" className="wp-button wp-button--secondary" onClick={discardDraft}>
                Discard local draft
              </button>
            )}
            <button
              type="button"
              className="wp-button wp-button--secondary"
              onClick={resetToDefault}
              disabled={saving || !loaded}
            >
              Reset to default slides
            </button>
          </div>
          {status && (
            <p
              style={{
                marginTop: 10,
                fontSize: '0.86rem',
                color: status.toLowerCase().includes('fail') || status.includes('Could not') || status.includes('Unsaved')
                  ? '#b32d2e'
                  : '#1d2327',
              }}
            >
              {status}
            </p>
          )}
        </div>
      </div>

      <div className={`admin-hero-ads-sticky${dirty ? ' is-dirty' : ''}`} role="region" aria-label="Save home ads">
        <div className="admin-hero-ads-sticky-inner">
          <span className="admin-hero-ads-sticky-msg">
            {saving
              ? 'Saving…'
              : dirty
                ? 'Changes ready — Save dabao (live update)'
                : lastSavedAt
                  ? 'Live pe saved ✓'
                  : 'Upload auto-saves · text ke liye Save'}
          </span>
          <button
            type="button"
            className="wp-button admin-hero-ads-sticky-btn"
            onClick={() => save()}
            disabled={saving || !loaded}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

      <div className="wp-postbox" style={{ marginTop: '1rem' }}>
        <div className="wp-postbox-head">Products → Home Ad</div>
        <div className="wp-postbox-body">
          <p style={{ fontSize: '0.84rem', color: '#50575e', marginTop: 0 }}>
            Product tap karo — image + name add hogi aur auto-save ho jayegi. Title edit ke baad sticky Save changes use karo.
          </p>
          <label style={{ display: 'block', marginBottom: '0.75rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>Search products</span>
            <input
              type="search"
              className="wp-input"
              style={{ width: '100%', marginTop: 4 }}
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              placeholder="Name, category, brand…"
            />
          </label>

          {filteredProducts.length === 0 ? (
            <p style={{ fontSize: '0.84rem', color: '#646970' }}>Koi product nahi mila.</p>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '0.65rem',
              }}
            >
              {filteredProducts.map((product) => {
                const img = productImage(product);
                const already = heroSlides.some((s) => String(s.product_id) === String(product.id));
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProductAsAd(product)}
                    disabled={heroSlides.length >= MAX_SLIDES}
                    style={{
                      border: already ? '2px solid #2271b1' : '1px solid #dcdcde',
                      borderRadius: 10,
                      padding: '0.45rem',
                      background: '#fff',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <img
                      src={img}
                      alt=""
                      style={{
                        width: '100%',
                        aspectRatio: '1',
                        objectFit: 'cover',
                        borderRadius: 8,
                        display: 'block',
                        marginBottom: 6,
                        background: '#f0f0f1',
                      }}
                    />
                    <span
                      style={{
                        display: 'block',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        lineHeight: 1.25,
                        color: '#1d2327',
                      }}
                    >
                      {product.name}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: '#646970', marginTop: 2 }}>
                      <ProductPrice product={product} />
                    </span>
                    <span style={{ display: 'block', fontSize: '0.72rem', color: '#2271b1', marginTop: 4, fontWeight: 600 }}>
                      {already ? 'Add again' : '+ Home Ad'}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
