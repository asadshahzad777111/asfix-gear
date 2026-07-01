import nodemailer from 'nodemailer';

const BRAND_NAME = 'AsFix Gear';
const SHOP_WHATSAPP_INTL = process.env.SHOP_WHATSAPP_INTL || '923039227000';

export class OtpDeliveryError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'OtpDeliveryError';
    this.code = code;
  }
}

function isProduction() {
  return process.env.NODE_ENV === 'production';
}

function smtpConfigured() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  return Boolean(user && pass);
}

function twilioConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER
  );
}

function twilioWhatsAppConfigured() {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_WHATSAPP_FROM
  );
}

function whatsAppCloudConfigured() {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

function getEmailFrom() {
  if (process.env.SMTP_FROM) return process.env.SMTP_FROM;
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  if (user) return `"${BRAND_NAME}" <${user}>`;
  return `"${BRAND_NAME}" <noreply@asfixgear.com>`;
}

function buildOtpEmailHtml(code, purpose) {
  const headline = purpose === 'login' ? 'Your login code' : 'Verify your email';
  const intro =
    purpose === 'login'
      ? 'Use this code to sign in to your AsFix Gear account.'
      : 'Use this code to complete your AsFix Gear registration.';
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${BRAND_NAME} — Verification code</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#0f172a 0%,#1e3a5f 100%);padding:28px 32px;text-align:center;">
              <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">${BRAND_NAME}</div>
              <div style="font-size:13px;color:#94a3b8;margin-top:4px;">Mobile Repair &amp; Accessories</div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 12px;font-size:20px;color:#0f172a;">${headline}</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.5;color:#475569;">${intro}</p>
              <div style="text-align:center;margin:28px 0;">
                <span style="display:inline-block;font-size:36px;font-weight:700;letter-spacing:8px;color:#0f172a;background:#f1f5f9;border:2px dashed #cbd5e1;border-radius:8px;padding:16px 24px;font-family:Consolas,Monaco,monospace;">${code}</span>
              </div>
              <p style="margin:0;font-size:13px;color:#64748b;text-align:center;">This code expires in <strong>10 minutes</strong>.</p>
              <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;text-align:center;">Never share this code. ${BRAND_NAME} will never ask for it by phone or WhatsApp.</p>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0;font-size:11px;color:#94a3b8;">&copy; ${year} ${BRAND_NAME} &middot; asfixgear.com</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function createMailer() {
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const host = process.env.SMTP_HOST;

  if (host) {
    return nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user, pass },
    });
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  });
}

function normalizePhoneE164(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('92')) return `+${digits}`;
  if (digits.startsWith('0')) return `+92${digits.slice(1)}`;
  return `+${digits}`;
}

function whatsappManualLink(code) {
  const text = encodeURIComponent(`My verification code is ${code}`);
  return `https://wa.me/${SHOP_WHATSAPP_INTL}?text=${text}`;
}

async function sendTwilioSms(to, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: from, Body: body });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    await res.text();
    throw new Error(`Twilio SMS failed: ${res.status}`);
  }
}

async function sendTwilioWhatsApp(to, body) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const params = new URLSearchParams({
    To: `whatsapp:${to}`,
    From: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
    Body: body,
  });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!res.ok) {
    throw new Error(`Twilio WhatsApp failed: ${res.status}`);
  }
}

async function sendWhatsAppCloud(to, body) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: to.replace('+', ''),
      type: 'text',
      text: { body },
    }),
  });

  if (!res.ok) {
    throw new Error(`WhatsApp Cloud API failed: ${res.status}`);
  }
}

/**
 * Best-effort WhatsApp ping TO THE SHOP'S OWN NUMBER when a customer submits
 * the contact form, so staff get a real-time nudge in addition to the
 * message already landing in Admin Messages / Ops desk. Reuses the same
 * Meta WhatsApp Cloud API helper used for phone OTP delivery above — no new
 * API integration code. Silently skipped (never throws) if `WHATSAPP_TOKEN`
 * + `WHATSAPP_PHONE_NUMBER_ID` are not configured, matching the existing
 * dev-safe pattern in this file.
 */
export async function notifyShopWhatsApp(text) {
  if (!whatsAppCloudConfigured()) {
    return { sent: false, skipped: true };
  }
  try {
    await sendWhatsAppCloud(SHOP_WHATSAPP_INTL, text);
    return { sent: true };
  } catch (err) {
    console.error('[Contact] Shop WhatsApp notify failed:', err.message);
    return { sent: false, error: err.message };
  }
}

/**
 * Best-effort automatic WhatsApp confirmation sent TO THE CUSTOMER right
 * after they submit a contact message or repair booking, so every inquiry
 * gets an instant acknowledgement even before staff reply personally.
 * Silently skipped (never throws) if the customer gave no usable phone
 * number or WhatsApp Cloud API env vars aren't configured.
 */
export async function notifyCustomerWhatsApp(phone, text) {
  if (!whatsAppCloudConfigured()) return { sent: false, skipped: true };
  const e164 = normalizePhoneE164(phone);
  if (!e164) return { sent: false, skipped: true };
  try {
    await sendWhatsAppCloud(e164, text);
    return { sent: true };
  } catch (err) {
    console.error('[Notify] Customer WhatsApp confirmation failed:', err.message);
    return { sent: false, error: err.message };
  }
}

export async function deliverEmailOtp(email, code, purpose = 'verification') {
  const subject =
    purpose === 'login'
      ? `${BRAND_NAME} — Your login code`
      : `${BRAND_NAME} — Verify your email`;
  const text = `Your ${BRAND_NAME} verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`;

  const result = { channel: 'email', sent: false, devCode: null, devMode: false };

  if (!smtpConfigured()) {
    console.log(`[OTP dev] Email to ${email}: ${code}`);
    if (isProduction()) {
      throw new OtpDeliveryError(
        'Email verification is not configured. Set GMAIL_USER and GMAIL_APP_PASSWORD on the server, then try again.',
        'EMAIL_NOT_CONFIGURED'
      );
    }
    result.devMode = true;
    result.devCode = code;
    return result;
  }

  try {
    const transporter = createMailer();
    const from = getEmailFrom();
    const html = buildOtpEmailHtml(code, purpose);
    await transporter.sendMail({ from, to: email, subject, text, html });
    result.sent = true;
    return result;
  } catch (err) {
    console.error('[OTP] Email send failed:', err.message);
    if (isProduction()) {
      throw new OtpDeliveryError(
        'Could not send verification email. Check GMAIL_USER and GMAIL_APP_PASSWORD, then try again.',
        'EMAIL_SEND_FAILED'
      );
    }
    console.log(`[OTP dev fallback] Email to ${email}: ${code}`);
    result.devMode = true;
    result.devCode = code;
    return result;
  }
}

export async function deliverPhoneOtp(phone, code, purpose = 'verification') {
  const e164 = normalizePhoneE164(phone);
  const body = `Your ${BRAND_NAME} code is ${code}. Valid for 10 minutes.`;

  const result = {
    channel: 'phone',
    sent: false,
    method: null,
    devCode: null,
    devMode: false,
    whatsappLink: null,
  };

  if (twilioConfigured()) {
    try {
      await sendTwilioSms(e164, body);
      result.sent = true;
      result.method = 'sms';
      return result;
    } catch (err) {
      console.warn('[OTP] Twilio SMS failed, trying WhatsApp fallback:', err.message);
    }
  }

  if (twilioWhatsAppConfigured()) {
    try {
      await sendTwilioWhatsApp(e164, body);
      result.sent = true;
      result.method = 'whatsapp';
      return result;
    } catch (err) {
      console.warn('[OTP] Twilio WhatsApp failed:', err.message);
    }
  }

  if (whatsAppCloudConfigured()) {
    try {
      await sendWhatsAppCloud(e164, body);
      result.sent = true;
      result.method = 'whatsapp';
      return result;
    } catch (err) {
      console.warn('[OTP] WhatsApp Cloud failed:', err.message);
    }
  }

  result.method = 'whatsapp_manual';
  console.log(`[OTP dev] Phone ${phone}: ${code}`);

  if (!isProduction()) {
    result.devMode = true;
    result.devCode = code;
    result.whatsappLink = whatsappManualLink(code);
  } else {
    throw new OtpDeliveryError(
      'SMS verification is not configured. Please register with Gmail or contact us.',
      'PHONE_NOT_CONFIGURED'
    );
  }

  return result;
}
