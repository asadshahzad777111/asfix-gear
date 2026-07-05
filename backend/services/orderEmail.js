import { deliverTransactionalEmail } from './otpDelivery.js';
import { getUserById } from '../store.js';

const BRAND = 'AsFix & Gear';
const SITE = 'https://asfixgear.com';

function formatAmount(amount) {
  return `Rs. ${Number(amount).toLocaleString('en-PK')}`;
}

function resolveOrderCustomerEmail(order) {
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

export function buildOrderCompleteEmail(order) {
  const name = String(order.customer_name || 'Customer').trim();
  const orderId = order.order_id || order.id;
  const subject = `${BRAND} — Aapka order #${orderId} complete ho gaya! 🎉`;

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
        <tr><td style="padding:28px 32px;background:linear-gradient(135deg,#0ea5e9,#8b5cf6);">
          <h1 style="margin:0;font-size:22px;color:#fff;">Order Complete!</h1>
          <p style="margin:8px 0 0;font-size:14px;color:rgba(255,255,255,0.9);">AsFix &amp; Gear — Lahore</p>
        </td></tr>
        <tr><td style="padding:28px 32px;color:#e2e8f0;">
          <p style="margin:0 0 16px;font-size:16px;">Assalam o Alaikum <strong>${name}</strong>,</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#cbd5e1;">
            Shukriya ke aap ne hum par trust kiya! Aapka order
            <strong style="color:#38bdf8;">#${orderId}</strong> ab complete ho chuka hai.
            Umeed hai aapko products pasand aayein — agar kuch chahiye ho to hum yahan hain.
          </p>
          <div style="background:#0f172a;border-radius:10px;padding:16px;margin:0 0 20px;border:1px solid #334155;">
            <p style="margin:0 0 8px;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">Order summary</p>
            <pre style="margin:0;font-size:13px;color:#e2e8f0;white-space:pre-wrap;font-family:inherit;line-height:1.5;">${itemLines(order.items).replace(/</g, '&lt;')}</pre>
            <p style="margin:12px 0 0;font-size:16px;font-weight:700;color:#4ade80;">Total: ${formatAmount(order.total_amount)}</p>
          </div>
          <p style="margin:0 0 20px;font-size:14px;color:#94a3b8;line-height:1.5;">
            Apne orders account page par dekhein ya WhatsApp se rabta karein.
          </p>
          <a href="${SITE}/account" style="display:inline-block;background:linear-gradient(135deg,#0ea5e9,#8b5cf6);color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">My Orders</a>
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

/**
 * Best-effort completion email — never throws; logs when no email on file.
 */
export async function sendOrderCompleteEmail(order) {
  const to = resolveOrderCustomerEmail(order);
  if (!to) {
    console.log(`[OrderEmail] No customer email for order #${order?.order_id || order?.id} — skipped`);
    return { sent: false, skipped: true, reason: 'no_email' };
  }

  const { subject, text, html } = buildOrderCompleteEmail(order);
  try {
    const result = await deliverTransactionalEmail(to, { subject, html, text });
    if (result.sent) {
      console.log(`[OrderEmail] Completion email sent to ${to} for order #${order.order_id}`);
    }
    return result;
  } catch (err) {
    console.error('[OrderEmail] Send failed:', err.message);
    return { sent: false, error: err.message };
  }
}
