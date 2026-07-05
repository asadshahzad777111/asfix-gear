/**
 * Seed dummy orders into local JSON store for Customers tab testing.
 * Safe test data only — no production credentials.
 */
import { initStorage, getCustomerSummaries } from '../backend/store.js';
import { withData } from '../backend/store/storage.js';
import { formatOrderId } from '../backend/store/data-migration.js';

await initStorage();

const now = () => new Date().toISOString();

const samples = [
  { customer_name: 'Ali Khan', phone: '03001234567', gmail: 'ali.test@example.com', city: 'Lahore', payment_mode: 'jazzcash', items: [{ id: 1, name: 'USB-C Cable', price: 299, qty: 2 }], total_amount: 598 },
  { customer_name: 'Ali Khan', phone: '03001234567', gmail: 'ali.test@example.com', city: 'Karachi', payment_mode: 'easypaisa', items: [{ id: 2, name: 'Tempered Glass', price: 499, qty: 1 }], total_amount: 499 },
  { customer_name: 'Sara Ahmed', phone: '03115556666', gmail: 'sara.test@example.com', city: 'Islamabad', payment_mode: 'bank', items: [{ id: 3, name: 'Phone Case', price: 799, qty: 1 }], total_amount: 799 },
  { customer_name: 'Bilal Phone', phone: '03219876543', gmail: '', city: 'Lahore', payment_mode: 'jazzcash', items: [{ id: 4, name: 'Earbuds', price: 1299, qty: 3 }], total_amount: 3897 },
  { customer_name: 'Hamza Raza', phone: '03334445555', gmail: 'hamza.test@example.com', city: 'Multan', payment_mode: 'jazzcash', items: [{ id: 5, name: 'Charger', price: 899, qty: 1 }], total_amount: 899 },
];

withData((data) => {
  for (const sample of samples) {
    const id = data.meta.nextOrderId++;
    const createdAt = now();
    data.orders.push({
      id,
      order_id: formatOrderId(id),
      customer_name: sample.customer_name,
      phone: sample.phone,
      city: sample.city,
      payment_mode: sample.payment_mode,
      items: sample.items,
      total_amount: sample.total_amount,
      shipping_status: 'pending',
      gmail: sample.gmail,
      notes: sample.notes || '',
      customer_user_id: null,
      stock_deducted: false,
      status_history: [{ status: 'pending', at: createdAt, by: null }],
      activity_log: [],
      updated_at: createdAt,
      created_at: createdAt,
    });
    console.log(`+ ${formatOrderId(id)} — ${sample.customer_name} — Rs ${sample.total_amount}`);
  }
});

console.log(`\nSeeded ${samples.length} test orders.`);
const summaries = getCustomerSummaries();
console.log(`Customers aggregated: ${summaries.length}`);
for (const c of summaries) {
  console.log(`  ${c.name || '(no name)'} | orders: ${c.order_count} | spent: Rs ${c.total_spent} | ${c.email || c.phone}`);
}
