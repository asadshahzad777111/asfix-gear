export const DEFAULT_DATA = {
  meta: {
    nextProductId: 1,
    nextServiceId: 1,
    nextBookingId: 1,
    nextMessageId: 1,
    nextUserId: 1,
    nextOrderId: 1,
    nextVerificationCodeId: 1,
  },
  users: [],
  sessions: [],
  products: [],
  repair_services: [],
  repair_bookings: [],
  contact_messages: [],
  orders: [],
  verification_codes: [],
  settings: {
    shop: {
      manual_override: null,
      updated_at: null,
      updated_by: null,
    },
  },
};

export function formatOrderId(id) {
  return `ASF-${1000 + Number(id)}`;
}

export function formatBookingRef(id) {
  return `ASF-R-${1000 + Number(id)}`;
}

export function migrateData(data) {
  data.meta = data.meta || {};
  data.users = data.users || [];
  data.sessions = data.sessions || [];
  data.products = data.products || [];
  data.repair_services = data.repair_services || [];
  data.repair_bookings = data.repair_bookings || [];
  data.contact_messages = data.contact_messages || [];
  data.orders = data.orders || [];
  data.verification_codes = data.verification_codes || [];
  data.settings = data.settings || {};
  data.settings.shop = data.settings.shop || {
    manual_override: null,
    updated_at: null,
    updated_by: null,
  };
  if (!data.meta.nextUserId) data.meta.nextUserId = 1;
  if (!data.meta.nextOrderId) data.meta.nextOrderId = 1;
  if (!data.meta.nextVerificationCodeId) data.meta.nextVerificationCodeId = 1;

  for (const msg of data.contact_messages) {
    if (msg.staff_reply == null) msg.staff_reply = '';
    if (msg.replied_at == null) msg.replied_at = null;
  }

  for (const product of data.products) {
    if (product.warranty == null) product.warranty = '';
    if (product.cost_price == null) product.cost_price = 0;
  }

  const nowIso = new Date().toISOString();

  for (const order of data.orders) {
    if (!order.order_id) order.order_id = formatOrderId(order.id);
    if (order.gmail == null) order.gmail = '';
    if (!order.status_history) {
      order.status_history = [
        { status: order.shipping_status || 'pending', at: order.created_at || nowIso, by: null },
      ];
    }
    if (!order.activity_log) order.activity_log = [];
    if (!order.updated_at) order.updated_at = order.created_at || nowIso;
    if (order.shipping_status === 'confirmed') order.shipping_status = 'payment_verified';
  }

  for (const booking of data.repair_bookings) {
    if (!booking.booking_ref) booking.booking_ref = formatBookingRef(booking.id);
    if (!booking.status_history) {
      booking.status_history = [
        { status: booking.status || 'pending', at: booking.created_at || nowIso, by: null },
      ];
    }
    if (!booking.activity_log) booking.activity_log = [];
    if (!booking.updated_at) booking.updated_at = booking.created_at || nowIso;
  }

  for (const user of data.users) {
    if (user.name == null) user.name = user.username || String(user.email || '').split('@')[0] || '';
    if (user.phone == null) user.phone = '';
    if (user.blocked == null) user.blocked = user.active === false;
    user.active = !user.blocked;
    if (user.last_login == null) user.last_login = null;
    if (user.created_by == null) user.created_by = null;
  }

  for (const order of data.orders) {
    if (order.customer_user_id == null) order.customer_user_id = null;
    if (order.stock_deducted == null) order.stock_deducted = false;
    if (order.customer_feedback == null) order.customer_feedback = null;
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.cost_price == null) item.cost_price = 0;
      }
    }
  }

  for (const msg of data.contact_messages) {
    if (msg.customer_user_id == null) msg.customer_user_id = null;
  }

  data.sessions = data.sessions.filter((s) => s.expires_at > nowIso);
  data.verification_codes = (data.verification_codes || []).filter((c) => c.expires_at > nowIso);
  return data;
}
