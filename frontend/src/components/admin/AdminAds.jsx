import { useState } from 'react';
import { api } from '../../api/client';

export default function AdminAds() {
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [format, setFormat] = useState('square');
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onFile = (e) => {
    const f = e.target.files?.[0] || null;
    setFile(f);
    setResult(null);
    setError('');
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const onGenerate = async (e) => {
    e.preventDefault();
    setError('');
    setResult(null);
    if (!file) {
      setError('Pehle product image choose karo');
      return;
    }
    if (!title.trim()) {
      setError('Product name / title likho');
      return;
    }
    setLoading(true);
    try {
      const data = await api.generateAd({
        file,
        title: title.trim(),
        price: price.trim(),
        format,
      });
      setResult(data);
    } catch (err) {
      setError(err.message || 'Ad generate nahi hui');
    } finally {
      setLoading(false);
    }
  };

  const downloadPng = () => {
    if (!result?.image_base64) return;
    const a = document.createElement('a');
    a.href = result.image_base64;
    a.download = `${(result.title || 'asfix-ad').replace(/\s+/g, '-').toLowerCase()}-${result.format}.png`;
    a.click();
  };

  const copyCaption = async () => {
    if (!result?.caption) return;
    try {
      await navigator.clipboard.writeText(result.caption);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="wp-postbox">
      <div className="wp-postbox-header">
        <h2>Create social ad (free)</h2>
      </div>
      <div className="wp-postbox-body">
        <p style={{ marginTop: 0, color: 'var(--text-muted, #666)' }}>
          Sirf <strong>image + name + rate</strong> do — AsFix template, caption aur hashtags khud ban jayenge.
          Canva/Placid ki zaroorat nahi. IG/FB pe abhi download karke post karo; n8n connected ho to cloud URL bhi chali jati hai.
        </p>

        <form onSubmit={onGenerate} className="admin-ads-form" style={{ display: 'grid', gap: '1rem', maxWidth: 520 }}>
          <label>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Product image</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} />
          </label>
          {preview ? (
            <img
              src={preview}
              alt="Upload preview"
              style={{ width: 160, height: 160, objectFit: 'cover', borderRadius: 12, border: '1px solid #ddd' }}
            />
          ) : null}

          <label>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Name / title</span>
            <input
              type="text"
              className="wp-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Luxury MagSafe Case"
              maxLength={120}
              required
            />
          </label>

          <label>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Rate / price</span>
            <input
              type="text"
              className="wp-input"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="650 or Rs 650"
              maxLength={40}
            />
          </label>

          <label>
            <span style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Format</span>
            <select className="wp-input" value={format} onChange={(e) => setFormat(e.target.value)}>
              <option value="square">Instagram / FB square (1080×1080)</option>
              <option value="story">Story (1080×1920)</option>
            </select>
          </label>

          {error ? (
            <div className="wp-notice wp-notice--error" role="alert">
              {error}
            </div>
          ) : null}

          <button type="submit" className="wp-button" disabled={loading}>
            {loading ? 'Generating…' : 'Generate ad'}
          </button>
        </form>

        {result ? (
          <div style={{ marginTop: '1.5rem', display: 'grid', gap: '1rem', maxWidth: 640 }}>
            <h3 style={{ margin: 0 }}>Ready</h3>
            <img
              src={result.image_base64}
              alt={result.title}
              style={{ width: '100%', maxWidth: result.format === 'story' ? 280 : 420, borderRadius: 12, border: '1px solid #ddd' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              <button type="button" className="wp-button" onClick={downloadPng}>
                Download PNG
              </button>
              <button type="button" className="wp-button wp-button--secondary" onClick={copyCaption}>
                Copy caption
              </button>
              {result.image_url ? (
                <a className="wp-button wp-button--secondary" href={result.image_url} target="_blank" rel="noreferrer">
                  Open cloud URL
                </a>
              ) : null}
            </div>
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                background: '#f6f7f7',
                padding: '0.85rem',
                borderRadius: 8,
                fontSize: 13,
              }}
            >
              {result.caption}
            </pre>
            {result.n8n_notified ? (
              <p style={{ margin: 0, color: '#0a7' }}>n8n ko ad_created event bhej diya (agar N8N_WEBHOOK_URL set ho).</p>
            ) : (
              <p style={{ margin: 0, color: '#666' }}>
                Cloud upload / n8n skip (R2 ya webhook off). PNG download karke post kar sakte ho.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
