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

/** Trim env values; strip quotes; remove spaces from Google app passwords. */
function normalizeSmtpCredentials() {
  const rawUser = process.env.SMTP_USER || process.env.GMAIL_USER || '';
  const rawPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD || '';
  const user = String(rawUser).trim().replace(/^['"]|['"]$/g, '');
  const pass = String(rawPass)
    .trim()
    .replace(/^['"]|['"]$/g, '')
    .replace(/\s+/g, '');
  return { user, pass };
}

function smtpConfigured() {
  const { user, pass } = normalizeSmtpCredentials();
  return Boolean(user && pass);
}

function resendConfigured() {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim());
}

function getResendFrom() {
  const raw = String(process.env.RESEND_FROM || '').trim().replace(/^['"]|['"]$/g, '');
  if (raw.includes('@')) return raw;
  return `"${BRAND_NAME}" <onboarding@resend.dev>`;
}

function emailDeliveryConfigured() {
  return resendConfigured() || smtpConfigured();
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
  const { user } = normalizeSmtpCredentials();
  // Gmail requires the From address to match the authenticated account.
  if (user) return `"${BRAND_NAME}" <${user}>`;

  const raw = String(process.env.SMTP_FROM || '').trim().replace(/^['"]|['"]$/g, '');
  if (raw.includes('@')) return raw;
  return `"${BRAND_NAME}" <noreply@asfixgear.com>`;
}

/** Shared transport options — IPv4 + timeouts help on Render/PaaS hosts. */
function smtpTransportOptions(host, port, secure) {
  return {
    host,
    port,
    secure,
    requireTLS: !secure,
    auth: normalizeSmtpCredentials(),
    // Keep total send attempt under ~30s so the client (45s OTP timeout) gets a real error.
    connectionTimeout: 10_000,
    greetingTimeout: 8_000,
    socketTimeout: 12_000,
    family: 4,
    tls: { minVersion: 'TLSv1.2' },
  };
}

function isSmtpAuthError(err) {
  if (!err) return false;
  const code = String(err.code || '').toUpperCase();
  const msg = String(err.message || '').toLowerCase();
  const responseCode = Number(err.responseCode);
  return (
    code === 'EAUTH' ||
    responseCode === 535 ||
    responseCode === 534 ||
    /invalid login|authentication failed|username and password not accepted|bad credentials/.test(msg)
  );
}

/** Map nodemailer/Gmail failures to a safe, actionable message for the client. */
function userFacingSmtpError(err) {
  if (isSmtpAuthError(err)) {
    return 'Gmail login fail — app password galat hai ya expire ho gaya. Render par GMAIL_USER aur naya GMAIL_APP_PASSWORD set karein (2-Step Verification + App Password zaroori hai).';
  }

  const code = String(err?.code || '').toUpperCase();
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') {
    return 'Gmail SMTP connect nahi ho saka (timeout). Render free tier par ports 587/465 block hain — RESEND_API_KEY set karein ya paid instance use karein. Guide: DEPLOY.md';
  }
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND') {
    return 'Gmail SMTP network error. Thori der baad dubara try karein.';
  }

  const raw = String(err?.message || '').trim();
  if (raw && raw.length <= 140 && !/password|secret|token|credential/i.test(raw)) {
    return `Verification email nahi bheji ja saki: ${raw}`;
  }

  return 'Verification email nahi bheji ja saki. Render par GMAIL_USER aur GMAIL_APP_PASSWORD check karein.';
}

function createMailTransports() {
  const customHost = String(process.env.SMTP_HOST || '').trim();
  if (customHost) {
    return [
      nodemailer.createTransport(
        smtpTransportOptions(
          customHost,
          Number(process.env.SMTP_PORT) || 587,
          process.env.SMTP_SECURE === 'true'
        )
      ),
    ];
  }

  // Try STARTTLS (587) first, then implicit TLS (465) — some networks block one port.
  return [
    nodemailer.createTransport(smtpTransportOptions('smtp.gmail.com', 587, false)),
    nodemailer.createTransport(smtpTransportOptions('smtp.gmail.com', 465, true)),
  ];
}

const OTP_COPY = {
  login: {
    headline: 'Your login code',
    intro: 'Use this code to sign in to your AsFix Gear account.',
    subject: `${BRAND_NAME} — Your login code`,
  },
  reset: {
    headline: 'Reset your password',
    intro: 'Use this code to set a new password for your AsFix Gear account.',
    subject: `${BRAND_NAME} — Password reset code`,
  },
  register: {
    headline: 'Verify your email',
    intro: 'Use this code to complete your AsFix Gear registration.',
    subject: `${BRAND_NAME} — Verify your email`,
  },
};

function otpCopyFor(purpose) {
  return OTP_COPY[purpose] || OTP_COPY.register;
}

function buildOtpEmailHtml(code, purpose) {
  const { headline, intro } = otpCopyFor(purpose);
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

async function sendViaResend({ to, subject, html, text }) {
  const apiKey = String(process.env.RESEND_API_KEY || '').trim();
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: getResendFrom(),
      to: [to],
      subject,
      html,
      text,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    const detail = body.slice(0, 200);
    throw new Error(`Resend API failed (${res.status}): ${detail}`);
  }
}

async function sendMailWithFallback(mailOptions) {
  const transports = createMailTransports();
  let lastErr;

  for (let i = 0; i < transports.length; i += 1) {
    try {
      const info = await transports[i].sendMail(mailOptions);
      if (i > 0) {
        console.warn('[OTP] Email sent via fallback SMTP transport (port 465)');
      }
      return info;
    } catch (err) {
      lastErr = err;
      const port = transports[i].options?.port ?? '?';
      console.warn(`[OTP] SMTP send failed (port ${port}):`, err.message, err.responseCode || '', err.code || '');
      if (isSmtpAuthError(err)) {
        console.warn('[OTP] SMTP auth failed — not retrying alternate port.');
        break;
      }
      if (i < transports.length - 1) {
        console.warn('[OTP] Retrying with alternate Gmail SMTP port…');
      }
    }
  }

  throw lastErr;
}

/** Best-effort startup check — logs result to server console, never throws. */
export async function verifySmtpConnection() {
  if (resendConfigured()) {
    console.log(`[OTP] Resend API ready (from ${getResendFrom()})`);
    return { ok: true, provider: 'resend', from: getResendFrom() };
  }

  if (!smtpConfigured()) {
    console.warn(
      '[OTP] Email OTP not configured — set RESEND_API_KEY (Render free tier) or GMAIL_USER + GMAIL_APP_PASSWORD (paid SMTP).'
    );
    return { ok: false, reason: 'not_configured' };
  }

  const { user } = normalizeSmtpCredentials();
  const transports = createMailTransports();

  for (const transport of transports) {
    try {
      await transport.verify();
      console.log(`[OTP] SMTP ready for ${user} (port ${transport.options?.port})`);
      return { ok: true, provider: 'smtp', user, port: transport.options?.port };
    } catch (err) {
      console.warn(`[OTP] SMTP verify failed (port ${transport.options?.port}):`, err.message);
    }
  }

  console.error(
    '[OTP] SMTP verify failed on all transports — on Render free tier use RESEND_API_KEY instead (SMTP ports 587/465 blocked).'
  );
  return { ok: false, reason: 'verify_failed' };
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
  const subject = otpCopyFor(purpose).subject;
  const text = `Your ${BRAND_NAME} verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`;

  const result = { channel: 'email', sent: false, devCode: null, devMode: false };

  if (!emailDeliveryConfigured()) {
    console.log(`[OTP dev] Email to ${email}: ${code}`);
    if (isProduction()) {
      throw new OtpDeliveryError(
        'Email verification is not configured. Set RESEND_API_KEY (recommended on Render free) or GMAIL_USER + GMAIL_APP_PASSWORD, then try again.',
        'EMAIL_NOT_CONFIGURED'
      );
    }
    result.devMode = true;
    result.devCode = code;
    return result;
  }

  const html = buildOtpEmailHtml(code, purpose);

  if (resendConfigured()) {
    try {
      await sendViaResend({ to: email, subject, html, text });
      result.sent = true;
      return result;
    } catch (err) {
      console.error('[OTP] Resend send failed:', err.message);
      if (isProduction()) {
        throw new OtpDeliveryError(
          'Verification email nahi bheji ja saki (Resend API error). RESEND_API_KEY aur RESEND_FROM check karein.',
          'EMAIL_SEND_FAILED'
        );
      }
      console.log(`[OTP dev fallback] Email to ${email}: ${code}`);
      result.devMode = true;
      result.devCode = code;
      return result;
    }
  }

  try {
    const from = getEmailFrom();
    await sendMailWithFallback({ from, to: email, subject, text, html });
    result.sent = true;
    return result;
  } catch (err) {
    console.error('[OTP] Email send failed:', err.message, err.responseCode || '', err.code || '');
    if (isProduction()) {
      throw new OtpDeliveryError(userFacingSmtpError(err), 'EMAIL_SEND_FAILED');
    }
    console.log(`[OTP dev fallback] Email to ${email}: ${code}`);
    result.devMode = true;
    result.devCode = code;
    return result;
  }
}

/** General transactional email (order complete, etc.) — best-effort, never throws. */
export async function deliverTransactionalEmail(email, { subject, html, text }) {
  const to = String(email || '').trim().toLowerCase();
  const result = { sent: false, devMode: false };

  if (!to || !subject) return { ...result, skipped: true, reason: 'missing_to_or_subject' };

  if (!emailDeliveryConfigured()) {
    console.log(`[Email dev] To ${to}: ${subject}`);
    return { ...result, devMode: true, skipped: true, reason: 'not_configured' };
  }

  const bodyText = text || subject;

  if (resendConfigured()) {
    try {
      await sendViaResend({ to, subject, html: html || bodyText, text: bodyText });
      return { sent: true };
    } catch (err) {
      console.error('[Email] Resend send failed:', err.message);
      return { sent: false, error: err.message };
    }
  }

  try {
    const from = getEmailFrom();
    await sendMailWithFallback({ from, to, subject, text: bodyText, html: html || bodyText });
    return { sent: true };
  } catch (err) {
    console.error('[Email] SMTP send failed:', err.message);
    return { sent: false, error: err.message };
  }
}

export async function deliverPhoneOtp(phone, code, purpose = 'verification') {
  const e164 = normalizePhoneE164(phone);
  const label = purpose === 'reset' ? 'password reset code' : purpose === 'login' ? 'login code' : 'verification code';
  const body = `Your ${BRAND_NAME} ${label} is ${code}. Valid for 10 minutes.`;

  const result = {
    channel: 'phone',
    sent: false,
    method: null,
    devCode: null,
    devMode: false,
    whatsappLink: null,
  };

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

  if (twilioConfigured()) {
    try {
      await sendTwilioSms(e164, body);
      result.sent = true;
      result.method = 'sms';
      return result;
    } catch (err) {
      console.warn('[OTP] Twilio SMS failed:', err.message);
    }
  }

  result.method = 'whatsapp_manual';
  result.whatsappLink = whatsappManualLink(code);

  if (!isProduction()) {
    console.log(`[OTP dev] Phone ${phone}: ${code}`);
    result.devMode = true;
    result.devCode = code;
    return result;
  }

  console.warn(
    '[OTP] Auto WhatsApp/SMS not configured — returning manual WhatsApp link for customer verification.'
  );
  return result;
}
