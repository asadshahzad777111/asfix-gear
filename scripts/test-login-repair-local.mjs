/** Direct module tests — no running server required. */
import {
  initStorage,
  addStaffNoteToBooking,
  createRepairBooking,
  trackRepairBooking,
  updateBookingEstimatedCost,
  updateBookingPhotos,
  getRepairBookingsForCustomer,
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

// Staff notes
const booking = createRepairBooking({
  customer_name: 'Note Test',
  phone: '03009998877',
  device_brand: 'Samsung',
  device_model: 'A52',
  issue: 'Battery',
  issue_types: ['Battery'],
  terms_accepted: true,
});

const updated = addStaffNoteToBooking(booking.id, 'Parts check karein — customer ko kal call karein.', {
  id: 1,
  username: 'asad',
  name: 'Asad',
});

if (updated?.staff_notes?.length === 1 && updated.staff_notes[0].text.includes('Parts check')) {
  pass('addStaffNoteToBooking persists note');
} else {
  fail('addStaffNoteToBooking persists note', JSON.stringify(updated?.staff_notes));
}

const withCost = updateBookingEstimatedCost(booking.id, 4500, { id: 1, username: 'asad' });
if (withCost?.estimated_cost === 4500) {
  pass('updateBookingEstimatedCost persists PKR amount');
} else {
  fail('updateBookingEstimatedCost persists PKR amount', String(withCost?.estimated_cost));
}

const withPhotos = updateBookingPhotos(
  booking.id,
  { photos_before: ['https://example.com/before.jpg'], photos_after: ['https://example.com/after.jpg'] },
  { id: 1, username: 'asad' }
);
if (withPhotos?.photos_before?.length === 1 && withPhotos?.photos_after?.length === 1) {
  pass('updateBookingPhotos stores before/after URLs');
} else {
  fail('updateBookingPhotos stores before/after URLs');
}

const tracked = trackRepairBooking(withPhotos.booking_ref, '03009998877');
if (tracked?.booking_ref && tracked.estimated_cost === 4500) {
  pass('trackRepairBooking returns public booking by ref + phone');
} else {
  fail('trackRepairBooking returns public booking by ref + phone', JSON.stringify(tracked));
}

const mine = getRepairBookingsForCustomer({ userId: null, phone: '03009998877' });
if (mine.some((b) => b.booking_ref === withPhotos.booking_ref)) {
  pass('getRepairBookingsForCustomer matches by phone');
} else {
  fail('getRepairBookingsForCustomer matches by phone');
}

// Login.jsx is full page not redirect
import fs from 'node:fs';
const loginSrc = fs.readFileSync(new URL('../frontend/src/pages/Login.jsx', import.meta.url), 'utf8');
if (!loginSrc.includes('Navigate to="/account/login"') && loginSrc.includes('AuthShell')) {
  pass('Login.jsx is dedicated staff page');
} else {
  fail('Login.jsx is dedicated staff page', 'still redirects or missing form');
}

// ProtectedRoute uses /login
const protectedSrc = fs.readFileSync(new URL('../frontend/src/components/ProtectedRoute.jsx', import.meta.url), 'utf8');
if (protectedSrc.includes('to="/login"')) {
  pass('ProtectedRoute redirects to /login');
} else {
  fail('ProtectedRoute redirects to /login');
}

// Footer staff link
const footerSrc = fs.readFileSync(new URL('../frontend/src/components/Footer.jsx', import.meta.url), 'utf8');
if (footerSrc.includes('to="/login"')) {
  pass('Footer staff login → /login');
} else {
  fail('Footer staff login → /login');
}

// Repair route returns customer_note + track endpoint
const repairsSrc = fs.readFileSync(new URL('../backend/routes/repairs.js', import.meta.url), 'utf8');
if (repairsSrc.includes('customer_note') && repairsSrc.includes('physical inspection') && repairsSrc.includes("router.get('/track'")) {
  pass('Repair routes include diagnosis note and public track');
} else {
  fail('Repair routes include diagnosis note and public track');
}

// Translations valid-ish
const transSrc = fs.readFileSync(new URL('../frontend/src/locales/translations.js', import.meta.url), 'utf8');
if (transSrc.includes('diagnosisNote') && transSrc.includes('staffUseStaffLogin') && transSrc.includes('repairsTab')) {
  pass('Translations include diagnosis + staff login + repair track keys');
} else {
  fail('Translations include diagnosis + staff login + repair track keys');
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
