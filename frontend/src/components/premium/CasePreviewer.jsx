import { motion } from 'framer-motion';

/**
 * Full product image preview — no phone bezel, notch, or colored stage wash.
 * Prefer ProductDetailGallery on the detail page; this stays as a simple fallback.
 */
export default function CasePreviewer({ product }) {
  if (!product?.image) return null;

  return (
    <div className="case-previewer glass-card case-previewer--simple case-previewer--full">
      <div className="case-previewer-head">
        <span className="eyebrow">Preview</span>
        <h3>{product.name}</h3>
      </div>

      <div className="case-previewer-stage case-previewer-stage--full">
        <motion.img
          key={product.image}
          className="case-previewer-full-img"
          src={product.image}
          alt={product.name}
          initial={{ opacity: 0, scale: 0.985 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        />
      </div>
    </div>
  );
}
