import { AnimatePresence, motion } from 'framer-motion';

/** Simple product preview — no color swatch row */
export default function CasePreviewer({ product }) {
  if (!product?.image) return null;

  return (
    <div className="case-previewer glass-card case-previewer--simple">
      <div className="case-previewer-head">
        <span className="eyebrow">Preview</span>
        <h3>{product.name}</h3>
      </div>

      <div className="case-previewer-stage">
        <AnimatePresence mode="wait">
          <motion.div
            key={product.image}
            className="case-previewer-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            style={{
              background: 'radial-gradient(circle at 30% 20%, rgba(255,102,0,0.18), #f3f4f6)',
            }}
          />
        </AnimatePresence>

        <motion.div
          className="case-previewer-phone"
          whileHover={{ rotateY: 8, rotateX: -4 }}
          transition={{ type: 'spring', stiffness: 180, damping: 18 }}
        >
          <div className="case-previewer-notch" />
          <motion.img
            key={product.image}
            src={product.image}
            alt={product.name}
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
          />
        </motion.div>
      </div>
    </div>
  );
}
