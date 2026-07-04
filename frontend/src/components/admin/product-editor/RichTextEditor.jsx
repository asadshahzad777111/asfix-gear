import { useCallback, useEffect, useRef } from 'react';

const TOOLBAR = [
  { cmd: 'bold', label: 'B', title: 'Bold', className: 'wp-btn-bold' },
  { cmd: 'italic', label: 'I', title: 'Italic', className: 'wp-btn-italic' },
  { cmd: 'insertUnorderedList', label: '•', title: 'Bullet list' },
  { cmd: 'insertOrderedList', label: '1.', title: 'Numbered list' },
];

function isHtmlContent(value) {
  return /<[a-z][\s\S]*>/i.test(String(value || ''));
}

function plainToHtml(text) {
  const raw = String(text || '').trim();
  if (!raw) return '';
  if (isHtmlContent(raw)) return raw;
  return raw
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
    .join('');
}

export default function RichTextEditor({ value, onChange, placeholder = 'Product description…', id = 'product-description' }) {
  const editorRef = useRef(null);
  const lastHtml = useRef('');

  const syncFromDom = useCallback(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML.replace(/^<br>$/i, '').trim();
    const normalized = html === '<br>' ? '' : html;
    lastHtml.current = normalized;
    onChange(normalized);
  }, [onChange]);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const html = plainToHtml(value);
    if (html !== lastHtml.current && html !== el.innerHTML) {
      el.innerHTML = html || '';
      lastHtml.current = html;
    }
  }, [value]);

  const runCommand = (cmd) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, null);
    syncFromDom();
  };

  return (
    <div className="wp-rich-text">
      <div className="wp-rich-text-toolbar" role="toolbar" aria-label="Description formatting">
        {TOOLBAR.map((item) => (
          <button
            key={item.cmd}
            type="button"
            className={`wp-rich-text-btn ${item.className || ''}`}
            title={item.title}
            aria-label={item.title}
            onMouseDown={(e) => {
              e.preventDefault();
              runCommand(item.cmd);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        id={id}
        ref={editorRef}
        className="wp-rich-text-editor"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-labelledby={`${id}-label`}
        data-placeholder={placeholder}
        onInput={syncFromDom}
        onBlur={syncFromDom}
        suppressContentEditableWarning
      />
    </div>
  );
}
