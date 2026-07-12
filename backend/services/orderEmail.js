import { deliverTransactionalEmail } from './otpDelivery.js';
import { getUserById } from '../store.js';

const BRAND = 'AsFix & Gear';
const SITE = 'https://asfixgear.com';

function formatAmount(amount) {
  return `Rs. ${Number(amount).toLocaleString('en-PK')}`;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function resolveOrderCustomerEmail(order) {
  const gmail = String(order?.gmail || '').trim().toLowerCase();
  if (gmail && gmail.includes('@')) return gmail;
  const uid = order?.customer_user_id;
  if (uid) {
    const user = getUserById(uid);
    const email = String(user?.email || '').trim().toLowerCase();
    if (email && email.includes('@')) return email;
  }
  return null;
}

function itemLines(items) {
  return (items || [])
    .map((item) => {
      const qty = Number(item.qty) || 1;
      const line = Number(item.price || 0) * qty;
      return `${item.name} × ${qty} — ${formatAmount(line)}`;
    })
    .join('\n');
}

function paymentLabel(mode) {
  const m = String(mode || '').toLowerCase();
  if (m === 'cod') return 'Cash on Delivery';
  if (m === 'easypaisa') return 'EasyPaisa';
  if (m === 'bank') return 'Bank Transfer';
  if (m === 'jazzcash') return 'JazzCash';
  return mode || '—';
}

function wrapEmail({ title, greeting, bodyHtml, bodyText, orderId }) {
  const subject = `${BRAND} — ${title} (#${orderId})`;
  const text = [
    greeting,
    '',
    bodyText,
    '',
    `Track: ${SITE}/track`,
    `Account: ${SITE}/account`,
    '',
    `— Team ${BRAND}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Segoe UI,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        <tr><td style="padding:28px 32px;background:linear-gradient(135deg,#0ea5e9,#0369a1);">
          <h1 style="margin:0;font-size:22px;color:#fff;">${escapeHtml(title)}</h1>
          <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">AsFix &amp; Gear — Lahore</p>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#e2e8f0;">
          <p style="margin:0 0 16px;font-size:16px;">${escapeHtml(greeting)}</p>
          ${bodyHtml}
          <a href="${SITE}/track" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-top:8px;">Track Order</a>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#0f172a;text-align:center;border-top:1px solid #334155;">
          <p style="margin:0;font-size:11px;color:#64748b;">&copy; ${new Date().getFullYear()} ${BRAND} · asfixgear.com · WhatsApp 03039227000</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

export function buildOrderPlacedEmail(order) {
  const name = String(order.customer_name || 'Customer').trim();
  const orderId = order.order_id || order.id;
  const isCod = String(order.payment_mode || '').toLowerCase() === 'cod';
  const isPickup = String(order.fulfillment_method || '').toLowerCase() === 'pickup';
  const payHint = isCod
    ? (isPickup
      ? 'Payment: Cash on pickup — shop par cash dein.'
      : 'Payment: Cash on Delivery — rider ko delivery par cash dein.')
    : `Payment: ${paymentLabel(order.payment_mode)} — Order ID transfer note mein likhein.`;
  const fulfillHint = isPickup
    ? 'Fulfillment: Shop pickup (Lahore) — hum ready hone par WhatsApp karenge.'
    : 'Fulfillment: Home delivery.';

  const bodyText = [
    `Shukriya! Aapka order #${orderId} receive ho gaya hai.`,
    '',
    'Order summary:',
    itemLines(order.items),
    '',
    `Total: ${formatAmount(order.total_amount)}`,
    payHint,
    fulfillHint,
    '',
    'Hum jald verify / dispatch karenge. Status Track page se check kar sakte hain.',
  ].join('\n');

  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cbd5e1;">
      Shukriya! Aapka order <strong style="color:#38bdf8;">#${escapeHtml(orderId)}</strong> receive ho gaya hai.
    </p>
    <div style="background:#0f172a;border-radius:10px;padding:16px;margin:0 0 20px;border:1px solid #334155;">
      <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Order summary</p>
      <pre style="margin:0;font-size:13px;color:#e2e8f0;white-space:pre-wrap;font-family:inherit;line-height:1.5;">${escapeHtml(itemLines(order.items))}</pre>
      <p style="margin:12px 0 0;font-size:16px;font-weight:700;color:#4ade80;">Total: ${formatAmount(order.total_amount)}</p>
      <p style="margin:8px 0 0;font-size:13px;color:#94a3b8;">${escapeHtml(payHint)}</p>
      <p style="margin:4px 0 0;font-size:13px;color:#94a3b8;">${escapeHtml(fulfillHint)}</p>
    </div>
    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.5;">
      Hum jald verify / dispatch karenge. Sawal ho to WhatsApp 03039227000.
    </p>`;

  return wrapEmail({
    title: 'Order Received',
    greeting: `Assalam o Alaikum ${name},`,
    bodyHtml,
    bodyText,
    orderId,
  });
}

export function buildOrderStatusEmail(order, status) {
  const name = String(order.customer_name || 'Customer').trim();
  const orderId = order.order_id || order.id;
  const labels = {
    payment_verified: 'Payment verified — order ready for dispatch',
    shipped: 'Order shipped',
    out_for_delivery: 'Out for delivery',
    cancelled: 'Order cancelled',
  };
  const title = labels[status] || `Order update: ${status}`;
  const bodyText = `Aapka order #${orderId} ka naya status: ${title}. Track page se details dekhein.`;
  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cbd5e1;">
      Aapka order <strong style="color:#38bdf8;">#${escapeHtml(orderId)}</strong> update:
      <strong>${escapeHtml(title)}</strong>
    </p>
    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;">Track page ya account se live status dekhein.</p>`;

  return wrapEmail({
    title,
    greeting: `Assalam o Alaikum ${name},`,
    bodyHtml,
    bodyText,
    orderId,
  });
}

export function buildOrderCompleteEmail(order) {
  const name = String(order.customer_name || 'Customer').trim();
  const orderId = order.order_id || order.id;
  const subject = `${BRAND} — Aapka order #${orderId} complete ho gaya!`;

  const text = [
    `Assalam o Alaikum ${name},`,
    '',
    `Shukriya ke aap ne ${BRAND} se order kiya! Aapka order #${orderId} ab complete / deliver ho chuka hai.`,
    '',
    'Order summary:',
    itemLines(order.items),
    '',
    `Total: ${formatAmount(order.total_amount)}`,
    '',
    'Agar koi sawal ho to humein WhatsApp ya Contact page se rabta karein.',
    '',
    `Track / account: ${SITE}/account`,
    '',
    `— Team ${BRAND}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Segoe UI,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        <tr><td style="padding:28px 32px;background:linear-gradient(135deg,#0ea5e9,#0369a1);">
          <h1 style="margin:0;font-size:22px;color:#fff;">Order Complete!</h1>
          <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">AsFix &amp; Gear — Lahore</p>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#e2e8f0;">
          <p style="margin:0 0 16px;font-size:16px;">Assalam o Alaikum <strong>${escapeHtml(name)}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cbd5e1;">
            Shukriya ke aap ne hum par trust kiya! Aapka order
            <strong style="color:#38bdf8;">#${escapeHtml(orderId)}</strong> ab complete ho chuka hai.
          </p>
          <div style="background:#0f172a;border-radius:10px;padding:16px;margin:0 0 20px;border:1px solid #334155;">
            <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Order summary</p>
            <pre style="margin:0;font-size:13px;color:#e2e8f0;white-space:pre-wrap;font-family:inherit;line-height:1.5;">${escapeHtml(itemLines(order.items))}</pre>
            <p style="margin:12px 0 0;font-size:16px;font-weight:700;color:#4ade80;">Total: ${formatAmount(order.total_amount)}</p>
          </div>
          <a href="${SITE}/account" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">My Orders</a>
        </td></tr>
        <tr><td style="padding:16px 32px;background:#0f172a;text-align:center;border-top:1px solid #334155;">
          <p style="margin:0;font-size:11px;color:#64748b;">&copy; ${new Date().getFullYear()} ${BRAND} · asfixgear.com</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

async function sendToCustomer(order, built) {
  const to = resolveOrderCustomerEmail(order);
  if (!to) {
    console.log(`[OrderEmail] No customer email for order #${order?.order_id || order?.id} — skipped`);
    return { sent: false, skipped: true, reason: 'no_email' };
  }
  try {
    const result = await deliverTransactionalEmail(to, built);
    if (result.sent) {
      console.log(`[OrderEmail] Sent to ${to} for order #${order.order_id}`);
    }
    return result;
  } catch (err) {
    console.error('[OrderEmail] Send failed:', err.message);
    return { sent: false, error: err.message };
  }
}

/** Warm confirmation when order is placed. */
export async function sendOrderPlacedEmail(order) {
  return sendToCustomer(order, buildOrderPlacedEmail(order));
}

/** Status change emails (not delivered — that uses completion email). */
export async function sendOrderStatusEmail(order, previousStatus) {
  const status = order?.shipping_status;
  if (!status || status === previousStatus || status === 'delivered' || status === 'pending') {
    return { sent: false, skipped: true };
  }
  return sendToCustomer(order, buildOrderStatusEmail(order, status));
}

/**
 * Best-effort completion email — never throws; logs when no email on file.
 */
export async function sendOrderCompleteEmail(order) {
  return sendToCustomer(order, buildOrderCompleteEmail(order));
}
