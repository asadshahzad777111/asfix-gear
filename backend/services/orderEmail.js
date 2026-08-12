import { deliverTransactionalEmail } from './otpDelivery.js';
import { getUserById, getEmailNotifySettings } from '../store.js';

const BRAND = 'AsFix & Gear';
const SITE = 'https://asfixgear.com';
/** Square logo for email clients (Gmail body). Gmail list avatar = Google account photo / BIMI. */
const LOGO_URL = `${SITE}/logo-192.png`;

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

function emailBrandHeader(titleHtml, subtitleHtml, gradient = 'linear-gradient(135deg,#0ea5e9,#0369a1)') {
  return `<tr><td style="padding:24px 28px;background:${gradient};">
          <table width="100%" cellpadding="0" cellspacing="0"><tr>
            <td width="56" valign="middle" style="padding-right:14px;">
              <img src="${LOGO_URL}" width="48" height="48" alt="${escapeHtml(BRAND)}" style="display:block;border-radius:12px;border:2px solid rgba(255,255,255,0.35);background:#fff;" />
            </td>
            <td valign="middle">
              <p style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:rgba(255,255,255,0.85);">${escapeHtml(BRAND)}</p>
              <h1 style="margin:0;font-size:20px;line-height:1.25;color:#fff;">${titleHtml}</h1>
              ${subtitleHtml ? `<p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.95);">${subtitleHtml}</p>` : ''}
            </td>
          </tr></table>
        </td></tr>`;
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
  if (m === 'safepay') return 'Safepay';
  if (m === 'payfast') return 'PayFast';
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
        ${emailBrandHeader(escapeHtml(title), 'AsFix &amp; Gear — Lahore')}
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
  const tracking = order.postex_tracking || order.tracking_number || '';
  const trackUrl = `${SITE}/track?orderId=${encodeURIComponent(String(orderId))}`;
  const trackingLine = tracking ? `Courier tracking: ${tracking}` : '';
  const bodyText = [
    `Aapka order #${orderId} ka naya status: ${title}.`,
    trackingLine,
    `Track: ${trackUrl}`,
  ]
    .filter(Boolean)
    .join('\n');
  const bodyHtml = `
    <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cbd5e1;">
      Aapka order <strong style="color:#38bdf8;">#${escapeHtml(orderId)}</strong> update:
      <strong>${escapeHtml(title)}</strong>
    </p>
    ${tracking ? `<p style="margin:0 0 12px;font-size:14px;color:#94a3b8;">Courier tracking: <strong style="color:#e2e8f0;">${escapeHtml(tracking)}</strong></p>` : ''}
    <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;">Track page ya account se live status dekhein.</p>
    <a href="${trackUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;margin-top:4px;">Track Order</a>`;

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

/** Shop inbox alert for new online orders (best-effort; does not block checkout). */
export function resolveShopNotifyEmail() {
  // Admin → Settings (DB) — survives APK reinstall
  try {
    const saved = getEmailNotifySettings();
    if (saved?.notify_email && saved.notify_email.includes('@')) {
      return saved.notify_email;
    }
  } catch {
    /* ignore */
  }
  const fromEnv = String(
    process.env.ORDER_NOTIFY_EMAIL || process.env.SHOP_NOTIFY_EMAIL || process.env.SHOP_EMAIL || ''
  )
    .trim()
    .toLowerCase();
  if (fromEnv && fromEnv.includes('@')) return fromEnv;
  // Matches frontend/src/config/shop.js — override via Admin Settings or ORDER_NOTIFY_EMAIL
  return 'asadshahzad777111@gmail.com';
}

export function buildNewOrderShopEmail(order) {
  const orderId = order.order_id || order.id;
  const name = String(order.customer_name || 'Customer').trim();
  const phone = String(order.phone || '—').trim();
  const isPickup = String(order.fulfillment_method || '').toLowerCase() === 'pickup';
  const fulfill = isPickup ? 'Shop pickup' : 'Home delivery';
  const pay = paymentLabel(order.payment_mode);
  const adminUrl = `${SITE}/admin?tab=orders&q=${encodeURIComponent(String(orderId))}`;
  const subject = `${BRAND} — NEW ORDER #${orderId} · ${formatAmount(order.total_amount)}`;

  const text = [
    `NEW ONLINE ORDER #${orderId}`,
    '',
    `Customer: ${name}`,
    `Phone: ${phone}`,
    `Payment: ${pay}`,
    `Fulfillment: ${fulfill}`,
    `City: ${order.city || '—'}`,
    '',
    'Items:',
    itemLines(order.items),
    '',
    `Total: ${formatAmount(order.total_amount)}`,
    '',
    `Open Admin: ${adminUrl}`,
    '',
    'Note: Email does not book courier. In Admin → Orders: Book on PostEx OR Assign rider (local delivery).',
    `— ${BRAND}`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Segoe UI,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        ${emailBrandHeader(
          'New online order',
          `#${escapeHtml(orderId)} · ${escapeHtml(formatAmount(order.total_amount))}`,
          'linear-gradient(135deg,#f59e0b,#b45309)'
        )}
        <tr><td style="padding:28px 32px;color:#e2e8f0;">
          <p style="margin:0 0 12px;font-size:15px;"><strong>${escapeHtml(name)}</strong> · ${escapeHtml(phone)}</p>
          <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">Payment: ${escapeHtml(pay)} · ${escapeHtml(fulfill)}</p>
          <div style="background:#0f172a;border-radius:10px;padding:16px;margin:16px 0;border:1px solid #334155;">
            <pre style="margin:0;font-size:13px;color:#e2e8f0;white-space:pre-wrap;font-family:inherit;line-height:1.5;">${escapeHtml(itemLines(order.items))}</pre>
            <p style="margin:12px 0 0;font-size:16px;font-weight:700;color:#4ade80;">Total: ${formatAmount(order.total_amount)}</p>
          </div>
          <a href="${adminUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Open in Admin</a>
          <p style="margin:16px 0 0;font-size:12px;color:#64748b;line-height:1.45;">Gmail se Admin auto-login nahi hota. Link kholo → pack check → <strong>Book on PostEx</strong> ya <strong>Assign rider</strong> (local delivery). Email khud book nahi karti.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

export async function sendNewOrderShopEmail(order) {
  if (!order) return { sent: false, skipped: true };
  const src = String(order.source || 'online');
  if (src === 'counter_sale' || src === 'counter_return' || src === 'counter_draft') {
    return { sent: false, skipped: true, reason: 'counter' };
  }
  const to = resolveShopNotifyEmail();
  try {
    const result = await deliverTransactionalEmail(to, buildNewOrderShopEmail(order));
    if (result.sent) {
      console.log(`[OrderEmail] Shop notify sent to ${to} for #${order.order_id}`);
    }
    return result;
  } catch (err) {
    console.error('[OrderEmail] Shop notify failed:', err.message);
    return { sent: false, error: err.message };
  }
}

export function buildCancelRequestShopEmail(order) {
  const orderId = order.order_id || order.id;
  const name = String(order.customer_name || 'Customer').trim();
  const phone = String(order.phone || '—').trim();
  const postexBooked = Boolean(
    order.cancel_postex_booked_at_request || order.postex_tracking || order.tracking_number
  );
  const tracking = order.postex_tracking || order.tracking_number || '';
  const reason = String(order.cancel_request_reason || '').trim();
  const adminUrl = `${SITE}/admin?tab=orders&q=${encodeURIComponent(String(orderId))}`;
  const subject = postexBooked
    ? `${BRAND} — CANCEL REQUEST #${orderId} · PostEx already booked`
    : `${BRAND} — CANCEL / REFUND REQUEST #${orderId}`;

  const text = [
    `Customer wants to cancel #${orderId} — refund request`,
    '',
    `Customer: ${name}`,
    `Phone: ${phone}`,
    `Total: ${formatAmount(order.total_amount)}`,
    postexBooked
      ? `PostEx: ALREADY BOOKED${tracking ? ` (${tracking})` : ''} — do NOT auto-cancel; stop courier / refund manually if needed.`
      : 'PostEx: not booked yet — easy Approve cancel in Admin.',
    reason ? `Reason: ${reason}` : '',
    '',
    `Open Admin: ${adminUrl}`,
    `— ${BRAND}`,
  ]
    .filter(Boolean)
    .join('\n');

  const banner = postexBooked ? '#b91c1c' : '#c2410c';
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Segoe UI,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
        ${emailBrandHeader(
          'Customer wants to cancel',
          `#${escapeHtml(String(orderId))} — refund request`,
          banner
        )}
        <tr><td style="padding:28px 32px;color:#e2e8f0;">
          <p style="margin:0 0 12px;font-size:15px;"><strong>${escapeHtml(name)}</strong> · ${escapeHtml(phone)}</p>
          <p style="margin:0 0 8px;font-size:14px;">Total: ${escapeHtml(formatAmount(order.total_amount))}</p>
          <p style="margin:0 0 12px;font-size:13px;color:${postexBooked ? '#fca5a5' : '#fdba74'};">
            ${
              postexBooked
                ? `PostEx already booked${tracking ? ` (${escapeHtml(String(tracking))})` : ''} — staff must handle courier + refund manually. No auto PostEx cancel.`
                : 'PostEx not booked — Approve cancel in Admin is safe.'
            }
          </p>
          ${reason ? `<p style="margin:0 0 16px;font-size:13px;color:#94a3b8;">Reason: ${escapeHtml(reason)}</p>` : ''}
          <a href="${adminUrl}" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#0369a1);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">Open in Admin</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

export async function sendCancelRequestShopEmail(order) {
  if (!order) return { sent: false, skipped: true };
  const to = resolveShopNotifyEmail();
  try {
    const result = await deliverTransactionalEmail(to, buildCancelRequestShopEmail(order));
    if (result.sent) {
      console.log(`[OrderEmail] Cancel-request shop notify sent to ${to} for #${order.order_id}`);
    }
    return result;
  } catch (err) {
    console.error('[OrderEmail] Cancel-request shop notify failed:', err.message);
    return { sent: false, error: err.message };
  }
}

/** Soft customer email when staff marks refund sent — never includes PostEx fee/cut. */
export function buildCancelRefundCustomerEmail(order) {
  const orderId = order.order_id || order.id;
  const prepaid = !(String(order.payment_mode || '').toLowerCase() === 'cod' && order.cancel_refund_status === 'not_needed');
  const isCodNoRefund = order.cancel_refund_status === 'not_needed';
  const subject = isCodNoRefund
    ? `${BRAND} — Order #${orderId} cancelled`
    : `${BRAND} — Refund update for #${orderId}`;

  const apology = isCodNoRefund
    ? `Order #${orderId} has been cancelled. No online payment was taken (COD), so no money return is needed. We're sorry for the inconvenience.`
    : `We're sorry for the inconvenience with order #${orderId}. Your cancel request was approved. If payment was received, refund is being processed and may take 1–2 working days.`;

  const text = [apology, '', `Track: ${SITE}/track`, '', `— Team ${BRAND}`].join('\n');
  const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"></head>
<body style="margin:0;padding:24px;background:#0f172a;font-family:Segoe UI,system-ui,sans-serif;color:#e2e8f0;">
  <table width="100%" style="max-width:520px;margin:0 auto;background:#1e293b;border-radius:12px;padding:24px;">
    <tr><td>
      <h1 style="margin:0 0 12px;font-size:18px;color:#fff;">${isCodNoRefund ? 'Order cancelled' : 'Refund update'}</h1>
      <p style="margin:0;line-height:1.5;font-size:14px;">${escapeHtml(apology)}</p>
      <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">— Team ${escapeHtml(BRAND)}</p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html, prepaid };
}

export async function sendCancelRefundCustomerEmail(order) {
  if (!order) return { sent: false, skipped: true };
  return sendToCustomer(order, buildCancelRefundCustomerEmail(order));
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
