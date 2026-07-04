/**
 * Local delivery flow test — store + routes (no browser).
 * Run: node scripts/test-delivery-flow-local.mjs
 */
import {
  initStorage,
  addCustomerAddress,
  createOrder,
  markOrderPaid,
  assignOrderRider,
  markOrderDelivered,
  getOrdersByCustomerId,
  trackOrder,
  orderCustomerStatus,
  createCustomer,
  getProducts,
} from '../backend/store.js';

const results = [];

function pass(name) {
  results.push({ name, ok: true });
  console.log(`PASS  ${name}`);
}

function fail(name, detail) {
  results.push({ name, ok: false, detail });
  console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
}

await initStorage();

const products = getProducts({ status: 'published' });
const product = products.find((p) => Number(p.stock) > 0);
if (!product) {
  fail('Setup: need at least one in-stock published product', 'no products');
  process.exit(1);
}

const ts = Date.now();
const customer = createCustomer({
  name: 'Delivery Test User',
  email: `delivery-test-${ts}@gmail.com`,
  phone: `0300${String(ts).slice(-7)}`,
  username: `deltest${ts}`,
  password: 'TestPass123!',
});

const address = addCustomerAddress(customer.id, {
  name: 'Delivery Test User',
  phone: '03001112233',
  text: 'House 12, Test Street, Lahore',
  lat: 31.59375,
  lng: 74.46745,
  is_default: true,
});

if (address?.id && address.text.includes('Test Street')) {
  pass('Customer saves address with map pin');
} else {
  fail('Customer saves address with map pin', JSON.stringify(address));
}

let order;
try {
  order = createOrder({
    customer_name: customer.name,
    phone: customer.phone,
    city: 'Lahore',
    payment_mode: 'jazzcash',
    customer_user_id: customer.id,
    shipping_address: {
      name: address.name,
      phone: address.phone,
      text: address.text,
      lat: address.lat,
      lng: address.lng,
    },
    items: [{ product_id: product.id, name: product.name, qty: 1, price: Number(product.price) || 500 }],
  });
} catch (err) {
  fail('Place order with advance payment', err.message);
  process.exit(1);
}

if (!order) {
  fail('Place order with advance payment', 'order undefined');
  process.exit(1);
}

if (order?.payment_status === 'pending_payment' && order.shipping_status === 'pending') {
  pass('Order starts as Pending Payment');
} else {
  fail('Order starts as Pending Payment', JSON.stringify({
    payment_status: order?.payment_status,
    shipping_status: order?.shipping_status,
  }));
}

const paid = markOrderPaid(order.id, { id: 1, username: 'admin' });
if (paid.payment_status === 'paid' && paid.delivery_status === 'waiting_for_rider') {
  pass('Admin Mark as Paid → Waiting for Rider');
} else {
  fail('Admin Mark as Paid → Waiting for Rider', JSON.stringify(paid));
}

const assigned = assignOrderRider(
  order.id,
  { rider_phone: '03009998877', delivery_charge: 150 },
  { id: 1, username: 'admin' }
);
if (
  assigned.delivery_status === 'rider_assigned'
  && assigned.rider_phone === '03009998877'
  && assigned.delivery_charge === 150
) {
  pass('Admin Assign Rider → rider phone + delivery charge saved');
} else {
  fail('Admin Assign Rider', JSON.stringify(assigned));
}

const delivered = markOrderDelivered(order.id, { id: 1, username: 'admin' });
if (delivered.delivery_status === 'delivered' && delivered.shipping_status === 'delivered') {
  pass('Admin Mark Delivered → final status');
} else {
  fail('Admin Mark Delivered', JSON.stringify(delivered));
}

const myOrders = getOrdersByCustomerId(customer.id);
const latest = myOrders.find((o) => o.id === order.id);
if (latest && orderCustomerStatus(latest) === 'delivered') {
  pass('Customer order list shows delivered status');
} else {
  fail('Customer order list shows delivered status', orderCustomerStatus(latest));
}

const tracked = trackOrder(order.order_id, customer.phone);
if (
  tracked?.rider_phone === '03009998877'
  && tracked?.customer_status === 'delivered'
  && tracked?.shipping_address?.text?.includes('Test Street')
) {
  pass('Track order returns rider info + address');
} else {
  fail('Track order returns rider info + address', JSON.stringify(tracked));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
