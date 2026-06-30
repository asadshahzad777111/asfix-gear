import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { CASE_PREVIEW_COLORS } from '../../utils/productAnimation';

export default function CasePreviewer({ product }) {
  const [color, setColor] = useState(CASE_PREVIEW_COLORS[0]);

  return (
    <div className="case-previewer glass-card">
      <div className="case-previewer-head">
        <span className="eyebrow">Live Preview</span>
        <h3>Custom Case Studio</h3>
        <p>Color toggle karein — premium finish dekhein before you order.</p>
      </div>

      <div className="case-previewer-stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={color.id}
            className="case-previewer-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            style={{ background: `radial-gradient(circle at 30% 20%, ${color.accent}33, ${color.bg})` }}
          />
        </AnimatePresence>

        <motion.div
          className="case-previewer-phone"
          style={{ borderColor: color.accent }}
          whileHover={{ rotateY: 12, rotateX: -6 }}
          transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        >
          <div className="case-previewer-notch" />
          <motion.img
            key={`${product.id}-${color.id}`}
            src={product.image}
            alt={product.name}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          />
          <span className="case-previewer-accent" style={{ background: color.accent }} />
        </motion.div>
      </div>

      <div className="case-previewer-swatches">
        {CASE_PREVIEW_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`case-swatch ${color.id === c.id ? 'active' : ''}`}
            style={{ '--swatch': c.accent }}
            onClick={() => setColor(c)}
            aria-label={c.label}
            title={c.label}
          >
            <span />
          </button>
        ))}
      </div>
      <p className="case-previewer-label">Selected: <strong>{color.label}</strong></p>
    </div>
  );
}
