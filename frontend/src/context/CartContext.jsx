import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { isInStock, maxCartQty } from '../utils/stock';
import { isPublishedProduct } from '../utils/productStatus';

const CartContext = createContext(null);
const CART_KEY = 'asfix_cart';

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && item.id != null && Number(item.qty) > 0)
      .map((item) => ({
        ...item,
        id: Number(item.id) || item.id,
        qty: Math.max(1, Math.min(99, Number(item.qty) || 1)),
      }));
  } catch {
    return [];
  }
}

function persistCart(items) {
  try {
    const slim = items.map((i) => ({
      id: i.id,
      qty: i.qty,
      name: i.name,
      price: i.price,
      image: i.image,
      stock: i.stock,
      category: i.category,
      brand: i.brand,
      slug: i.slug,
      discount_percent: i.discount_percent,
      status: i.status,
      warranty: i.warranty,
    }));
    localStorage.setItem(CART_KEY, JSON.stringify(slim));
  } catch {
    /* quota / private mode */
  }
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => loadCart());
  const [open, setOpen] = useState(false);
  const [fly, setFly] = useState(null);

  useEffect(() => {
    persistCart(items);
  }, [items]);

  const addItem = useCallback((product, fromRect) => {
    if (!product || !isPublishedProduct(product) || !isInStock(product.stock)) return;
    setFly({
      product,
      fromRect,
      id: `${product.id}-${Date.now()}`,
    });
  }, []);

  const completeFly = useCallback((product) => {
    if (!isPublishedProduct(product)) {
      setFly(null);
      return;
    }
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
