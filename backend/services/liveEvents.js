import { randomUUID } from 'crypto';

function normalizePhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('92')) return digits;
  if (digits.startsWith('0')) return `92${digits.slice(1)}`;
  return digits;
}

/** Lightweight in-process SSE bus — one Node process (Render web service). */
class LiveEventBus {
  constructor() {
    /** @type {Map<string, { res: import('express').Response, userId: number|null, role: string, phone: string }>} */
    this.clients = new Map();
  }

  addClient(res, user) {
    const id = randomUUID();
    this.clients.set(id, {
      res,
      userId: user?.id != null ? Number(user.id) : null,
      role: user?.role || 'guest',
      phone: normalizePhone(user?.phone),
    });
    return id;
  }

  removeClient(id) {
    this.clients.delete(id);
  }

  clientCount() {
    return this.clients.size;
  }

  /** @param {string} event @param {Record<string, unknown>} data */
  publish(event, data = {}) {
    const payload = JSON.stringify({ event, data, at: new Date().toISOString() });
    for (const [id, client] of this.clients) {
      if (!this.shouldDeliver(client, event, data)) continue;
      try {
        client.res.write(`event: ${event}\n`);
        client.res.write(`data: ${payload}\n\n`);
      } catch {
        this.removeClient(id);
      }
    }
  }

  shouldDeliver(client, event, data) {
    const staffRoles = new Set(['super_admin', 'admin', 'editor']);
    if (staffRoles.has(client.role)) return true;

    if (client.role !== 'customer') return false;

    if (event === 'product_updated') return true;

    if (event.startsWith('order_')) {
      const uid = data.customer_user_id != null ? Number(data.customer_user_id) : null;
      if (uid && client.userId === uid) return true;
      const orderPhone = normalizePhone(data.phone);
      if (orderPhone && client.phone && orderPhone === client.phone) return true;
      return false;
    }

    if (event.startsWith('repair_')) {
      const uid = data.customer_user_id != null ? Number(data.customer_user_id) : null;
      if (uid && client.userId === uid) return true;
      const bookingPhone = normalizePhone(data.phone);
      if (bookingPhone && client.phone && bookingPhone === client.phone) return true;
      return false;
    }

    return false;
  }
}

export const liveEvents = new LiveEventBus();

export function publishOrderEvent(event, order) {
  if (!order) return;
  liveEvents.publish(event, {
    id: order.id,
    order_id: order.order_id,
    customer_user_id: order.customer_user_id ?? null,
    phone: order.phone || '',
    customer_name: order.customer_name || '',
    total_amount: order.total_amount ?? null,
    payment_mode: order.payment_mode || '',
    fulfillment_method: order.fulfillment_method || '',
    source: order.source || 'online',
    payment_status: order.payment_status,
    shipping_status: order.shipping_status,
    delivery_status: order.delivery_status ?? null,
  });
}

export function publishRepairEvent(event, booking) {
  if (!booking) return;
  liveEvents.publish(event, {
    id: booking.id,
    booking_ref: booking.booking_ref,
    customer_user_id: booking.customer_user_id ?? null,
    phone: booking.phone || '',
    status: booking.status,
  });
}

export function publishRepairMessageEvent(message, booking) {
  if (!message || !booking) return;
  liveEvents.publish('repair_message', {
    id: message.id,
    repair_booking_id: message.repair_booking_id,
    booking_ref: booking.booking_ref,
    customer_user_id: booking.customer_user_id ?? null,
    phone: booking.phone || '',
    sender: message.sender,
  });
}

export function publishProductEvent(product) {
  if (!product) return;
  liveEvents.publish('product_updated', {
    id: product.id,
    stock: product.stock,
    status: product.status,
  });
}
