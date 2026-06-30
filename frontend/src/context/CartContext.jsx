import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { maxCartQty } from '../utils/stock';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [fly, setFly] = useState(null);

  const addItem = useCallback((product, fromRect) => {
    if (!product || Number(product.stock) <= 0) return;
    setFly({
      product,
      fromRect,
      id: `${product.id}-${Date.now()}`,
    });
  }, []);

  const completeFly = useCallback((product) => {
    const limit = maxCartQty(product);
    if (limit <= 0) {
      setFly(null);
      return;
    }
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.id === product.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: Math.min(next[idx].qty + 1, limit), stock: product.stock };
        return next;
      }
      return [...prev, { ...product, qty: 1 }];
    });
    setFly(null);
    setOpen(true);
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const updateQty = useCallback((id, qty) => {
    if (qty < 1) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      return;
    }
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const limit = maxCartQty(i);
        return { ...i, qty: Math.min(qty, limit || qty) };
      })
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const count = useMemo(() => items.reduce((sum, i) => sum + i.qty, 0), [items]);

  const value = useMemo(
    () => ({
      items,
      count,
      open,
      setOpen,
      fly,
      addItem,
      completeFly,
      removeItem,
      updateQty,
      clearCart,
    }),
    [items, count, open, fly, addItem, completeFly, removeItem, updateQty, clearCart]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
