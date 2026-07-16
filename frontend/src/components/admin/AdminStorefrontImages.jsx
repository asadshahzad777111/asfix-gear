import { useEffect, useState } from 'react';
import { api } from '../../api/client';
import { CATEGORIES, DEFAULT_IMAGES } from '../../config/products';

const KEYS = CATEGORIES.filter((c) => c !== 'Gaming');

export default function AdminStorefrontImages() {
  const [images, setImages] = useState(() =>
    Object.fromEntries(KEYS.map((k) => [k, DEFAULT_IMAGES[k] || '']))
  );
  const [heroJson, setHeroJson] = useState('[]');
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getStorefrontImages()
      .then((data) => {
        if (data?.category_images) {
          setImages((prev) => ({ ...prev, ...data.category_images }));
        }
        if (Array.isArray(data?.hero_slides)) {
          setHeroJson(JSON.stringify(data.hero_slides, null, 2));
        }
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setStatus('');
    try {
      let hero_slides = [];
      try {
        hero_slides = JSON.parse(heroJson || '[]');
        if (!Array.isArray(hero_slides)) throw new Error('Hero slides must be an array');
      } catch (e) {
        setStatus(e.message || 'Invalid hero JSON');
        setSaving(false);
        return;
      }
      await api.updateStorefrontImages({ category_images: images, hero_slides });
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
          Paste image URLs for home collections / trending circles. Changes apply site-wide without a redeploy.
        </p>
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
        <label style={{ display: 'block', marginTop: '1rem' }}>
          <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Hero slides (JSON array)</span>
          <textarea
            className="wp-input"
            rows={8}
            style={{ width: '100%', marginTop: 4, fontFamily: 'monospace', fontSize: '0.78rem' }}
            value={heroJson}
            onChange={(e) => setHeroJson(e.target.value)}
            placeholder='[{"image":"https://…","title":"Premium Cases","subtitle":"iPhone series","href":"/shop"}]'
          />
        </label>
        <button type="button" className="wp-button" onClick={save} disabled={saving} style={{ marginTop: 12 }}>
          {saving ? 'Saving…' : 'Save gallery'}
        </button>
        {status && <p style={{ marginTop: 8, fontSize: '0.84rem' }}>{status}</p>}
      </div>
    </div>
  );
}
