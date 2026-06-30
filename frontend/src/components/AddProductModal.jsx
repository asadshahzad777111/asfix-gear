import AddProductForm from './AddProductForm';

export default function AddProductModal({ open, onClose, onSuccess }) {
  if (!open) return null;

  const handleSuccess = (product) => {
    if (onSuccess) onSuccess(product);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Add product">
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        <AddProductForm onSuccess={handleSuccess} onCancel={onClose} />
      </div>
    </div>
  );
}
