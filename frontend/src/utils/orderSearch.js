/** Client-side order search — name, phone, product, order id, city. */
export function filterOrders(orders, query) {
  if (!Array.isArray(orders)) return [];
  const q = String(query || '').trim().toLowerCase();
  if (!q) return orders;

  const tokens = q.split(/\s+/).filter(Boolean);

  return orders.filter((order) => {
    const haystack = [
      order.order_id,
      order.id,
      order.customer_name,
      order.phone,
      order.city,
      order.gmail,
      order.payment_mode,
      order.payment_status,
      order.shipping_status,
      order.notes,
      ...(order.items || []).map((item) => `${item.name} ${item.qty || 1}`),
      order.shipping_address?.text,
      order.shipping_address?.name,
      order.shipping_address?.phone,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return tokens.every((token) => haystack.includes(token));
  });
}

export function isPaymentVerified(order) {
  if (!order) return false;
  if (order.payment_status === 'payment_verified' || order.payment_status === 'paid') return true;
  const status = order.shipping_status;
  return ['payment_verified', 'shipped', 'out_for_delivery', 'delivered'].includes(status);
}
