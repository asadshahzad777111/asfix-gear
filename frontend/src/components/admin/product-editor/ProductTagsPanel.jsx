import { useState } from 'react';

function parseTagInput(raw) {
  return String(raw || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function ProductTagsPanel({ tags, onChange }) {
  const [input, setInput] = useState('');
  const list = Array.isArray(tags) ? tags : [];

  const addTags = (candidates) => {
    const next = [...list];
    for (const tag of candidates) {
      const value = tag.slice(0, 40);
      if (!value) continue;
      if (next.some((t) => t.toLowerCase() === value.toLowerCase())) continue;
      if (next.length >= 20) break;
      next.push(value);
    }
    if (next.length !== list.length || candidates.some((c) => c && !list.includes(c))) {
      onChange(next);
    }
  };

  const removeTag = (index) => {
    onChange(list.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const parts = parseTagInput(input);
      if (parts.length) {
        addTags(parts);
        setInput('');
      }
    } else if (e.key === 'Backspace' && !input && list.length) {
      removeTag(list.length - 1);
    }
  };

  const handleBlur = () => {
    const parts = parseTagInput(input);
    if (parts.length) {
      addTags(parts);
      setInput('');
    }
  };

  return (
    <div className="wp-postbox">
      <div className="wp-postbox-head">Tags</div>
      <div className="wp-postbox-body">
        <div className="wp-product-tags">
          {list.map((tag, index) => (
            <span key={`${tag}-${index}`} className="wp-product-tag">
              {tag}
              <button
                type="button"
                className="wp-product-tag-remove"
                aria-label={`Remove tag ${tag}`}
                onClick={() => removeTag(index)}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            className="wp-product-tags-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleBlur}
            placeholder={list.length ? 'Add tag…' : 'Type tag, Enter or comma'}
            aria-label="Product tags"
          />
        </div>
        <p className="wp-product-hint">Separate tags with commas or press Enter.</p>
      </div>
    </div>
  );
}
