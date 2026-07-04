/** Unified customer-facing order status from payment + delivery fields. */
export function getOrderCustomerStatus(order) {
  if (!order) return 'pending';
  if (order.customer_status) return order.customer_status;
  if (order.payment_status === 'pending_payment') return 'pending_payment';
  if (order.delivery_status === 'waiting_for_rider') return 'waiting_for_rider';
  if (order.delivery_status === 'rider_assigned') return 'rider_assigned';
  if (order.delivery_status === 'delivered') return 'delivered';
  if (order.shipping_status === 'cancelled') return 'cancelled';
  return order.shipping_status || 'pending';
}

export const DELIVERY_TIMELINE = [
  { key: 'placed', statuses: ['pending_payment', 'pending', 'paid', 'payment_verified', 'waiting_for_rider', 'rider_assigned', 'out_for_delivery', 'delivered'] },
  { key: 'payment', statuses: ['paid', 'payment_verified', 'waiting_for_rider', 'rider_assigned', 'out_for_delivery', 'delivered'] },
  { key: 'rider', statuses: ['rider_assigned', 'out_for_delivery', 'delivered'] },
  { key: 'delivered', statuses: ['delivered'] },
];

export function getDeliveryTimelineIndex(order) {
  const status = getOrderCustomerStatus(order);
  if (status === 'delivered') return 3;
  if (status === 'rider_assigned') return 2;
  if (status === 'waiting_for_rider' || status === 'payment_verified' || status === 'paid') return 1;
  return 0;
}
