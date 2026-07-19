import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { CATEGORIES, DEFAULT_IMAGES } from '../../config/products';

const KEYS = CATEGORIES.filter((c) => c !== 'Gaming');

export default function AdminStorefrontImages() {
  const [images, setImages] = useState(() =>
    Object.fromEntries(KEYS.map((k) => [k, DEFAULT_IMAGES[k] || '']))
  );
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .getStorefrontImages()
      .then((data) => {
        if (data?.category_images) {
          setImages((prev) => ({ ...prev, ...data.category_images }));
        }
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setStatus('');
    try {
      const current = await api.getStorefrontImages();
      await api.updateStorefrontImages({
        category_images: images,
        hero_slides: current?.hero_slides || [],
      });
      setStatus('Saved — category gallery images updated.');
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
          Category / collection images for the shop grid.{' '}
          <Link to="/admin?tab=hero">Home floating ads (hero photos) →</Link>
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

        <button type="button" className="wp-button" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save category images'}
        </button>
        {status && <p style={{ marginTop: 8, fontSize: '0.84rem' }}>{status}</p>}
      </div>
    </div>
  );
}
