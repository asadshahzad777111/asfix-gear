import { slugify } from '../utils/slug.js';

function slugifyCategoryName(name) {
  return slugify(name) || `cat-${Date.now()}`;
}

export const DEFAULT_DATA = {
  meta: {
    nextProductId: 1,
    nextServiceId: 1,
    nextBookingId: 1,
    nextMessageId: 1,
    nextUserId: 1,
    nextOrderId: 1,
    nextVerificationCodeId: 1,
    nextRepairRateId: 1,
    nextRepairRateQueryId: 1,
    nextCategoryId: 1,
    nextAddressId: 1,
    nextRepairMessageId: 1,
  },
  users: [],
  sessions: [],
  products: [],
  repair_services: [],
  repair_bookings: [],
  repair_rates: [],
  repair_rate_queries: [],
  repair_messages: [],
  contact_messages: [],
  orders: [],
  verification_codes: [],
  settings: {
    shop: {
      manual_override: null,
      updated_at: null,
      updated_by: null,
    },
    product_categories: [],
    storefront_images: {
      category_images: {},
      hero_slides: [],
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
  data.repair_rates = data.repair_rates || [];
  data.repair_rate_queries = data.repair_rate_queries || [];
  data.repair_messages = data.repair_messages || [];
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
  if (!data.meta.nextRepairRateId) data.meta.nextRepairRateId = 1;
  if (!data.meta.nextRepairRateQueryId) data.meta.nextRepairRateQueryId = 1;
  if (!data.meta.nextCategoryId) data.meta.nextCategoryId = 1;
  if (!data.meta.nextAddressId) data.meta.nextAddressId = 1;
  if (!data.meta.nextRepairMessageId) data.meta.nextRepairMessageId = 1;

  if (!Array.isArray(data.settings.product_categories)) {
    data.settings.product_categories = [];
  }
  if (!data.settings.storefront_images || typeof data.settings.storefront_images !== 'object') {
    data.settings.storefront_images = {
      category_images: {},
      hero_slides: [],
      updated_at: null,
      updated_by: null,
    };
  } else {
    if (
      !data.settings.storefront_images.category_images ||
      typeof data.settings.storefront_images.category_images !== 'object'
    ) {
      data.settings.storefront_images.category_images = {};
    }
    if (!Array.isArray(data.settings.storefront_images.hero_slides)) {
      data.settings.storefront_images.hero_slides = [];
    }
  }

  const nowIso = new Date().toISOString();

  const categoryNames = new Set(data.settings.product_categories.map((c) => c.name));
  for (const product of data.products) {
    const name = String(product.category || '').trim();
    if (!name || categoryNames.has(name)) continue;
    const id = data.meta.nextCategoryId++;
    data.settings.product_categories.push({
      id,
      name,
      slug: slugifyCategoryName(name),
      parent_id: null,
      created_at: nowIso,
    });
    categoryNames.add(name);
  }

  for (const msg of data.contact_messages) {
    if (msg.staff_reply == null) msg.staff_reply = '';
    if (msg.replied_at == null) msg.replied_at = null;
  }

  for (const product of data.products) {
    if (product.warranty == null) product.warranty = '';
    if (product.cost_price == null) product.cost_price = 0;
    if (!Array.isArray(product.gallery)) product.gallery = [];
    if (product.hover_image == null) product.hover_image = '';
    if (!product.status || !['published', 'draft'].includes(product.status)) {
      product.status = 'published';
    }
    if (product.slug == null) product.slug = '';
    if (!Array.isArray(product.tags)) product.tags = [];
  }

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
    if (!booking.staff_notes) booking.staff_notes = [];
    if (!booking.updated_at) booking.updated_at = booking.created_at || nowIso;
    if (booking.estimated_cost == null) booking.estimated_cost = null;
    if (!Array.isArray(booking.photos_before)) booking.photos_before = [];
    if (!Array.isArray(booking.photos_after)) booking.photos_after = [];
    if (booking.customer_user_id == null) booking.customer_user_id = null;
  }

  for (const user of data.users) {
    if (user.name == null) user.name = user.username || String(user.email || '').split('@')[0] || '';
    if (user.phone == null) user.phone = '';
    if (user.google_id == null) user.google_id = null;
    if (user.blocked == null) user.blocked = user.active === false;
    user.active = !user.blocked;
    if (user.last_login == null) user.last_login = null;
    if (user.created_by == null) user.created_by = null;
  }

  // Shop clients that were accidentally added as staff — keep them as customers only.
  const SHOP_CLIENT_EMAILS = new Set([
    'bossp0926@gmail.com',
    'bintenaeem398@gmail.com',
  ]);
  for (const user of data.users) {
    const email = String(user.email || '').trim().toLowerCase();
    if (SHOP_CLIENT_EMAILS.has(email) && ['admin', 'editor'].includes(user.role)) {
      user.role = 'customer';
    }
  }

  for (const order of data.orders) {
    if (order.customer_user_id == null) order.customer_user_id = null;
    if (order.stock_deducted == null) order.stock_deducted = false;
    if (order.customer_feedback == null) order.customer_feedback = null;
    else if (order.customer_feedback && order.customer_feedback.status == null) {
      order.customer_feedback.status = 'pending';
    }
    if (order.payment_status == null) {
      order.payment_status = order.shipping_status === 'pending' ? 'pending_payment' : 'paid';
    }
    if (order.delivery_status == null) {
      if (order.shipping_status === 'delivered') order.delivery_status = 'delivered';
      else if (order.shipping_status === 'out_for_delivery') order.delivery_status = 'rider_assigned';
      else if (['payment_verified', 'shipped'].includes(order.shipping_status)) {
        order.delivery_status = 'waiting_for_rider';
      } else {
        order.delivery_status = null;
      }
    }
    if (order.rider_phone == null) order.rider_phone = '';
    if (order.delivery_charge == null) order.delivery_charge = 0;
    if (order.shipping_address == null) order.shipping_address = null;
    if (Array.isArray(order.items)) {
      for (const item of order.items) {
        if (item.cost_price == null) item.cost_price = 0;
      }
    }
  }

  for (const user of data.users) {
    if (!Array.isArray(user.addresses)) user.addresses = [];
  }

  for (const msg of data.contact_messages) {
    if (msg.customer_user_id == null) msg.customer_user_id = null;
  }

  for (const msg of data.repair_messages) {
    if (msg.read_by_customer == null) msg.read_by_customer = msg.sender === 'customer';
    if (msg.read_by_staff == null) msg.read_by_staff = msg.sender === 'staff';
  }

  data.sessions = data.sessions.filter((s) => s.expires_at > nowIso);
  data.verification_codes = (data.verification_codes || []).filter((c) => c.expires_at > nowIso);
  return data;
}
