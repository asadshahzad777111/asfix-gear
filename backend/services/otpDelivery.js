import nodemailer from 'nodemailer';

const SHOP_NAME = 'AsFix & Gear';
const SHOP_WHATSAPP_INTL = process.env.SHOP_WHATSAPP_INTL || '923039227000';

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
    const errText = await res.text();
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

export async function deliverEmailOtp(email, code, purpose = 'verification') {
  const subject =
    purpose === 'login'
      ? `${SHOP_NAME} — Your login code`
      : `${SHOP_NAME} — Verify your email`;
  const text = `Your ${SHOP_NAME} verification code is: ${code}\n\nThis code expires in 10 minutes. Do not share it with anyone.`;

  const result = { channel: 'email', sent: false, devCode: null, devMode: false };

  if (smtpConfigured()) {
    const transporter = createMailer();
    const from = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER;
    await transporter.sendMail({ from, to: email, subject, text });
    result.sent = true;
    return result;
  }

  console.log(`[OTP dev] Email to ${email}: ${code}`);
  if (!isProduction()) {
    result.devMode = true;
    result.devCode = code;
  }
  return result;
}

export async function deliverPhoneOtp(phone, code, purpose = 'verification') {
  const e164 = normalizePhoneE164(phone);
  const body = `Your ${SHOP_NAME} code is ${code}. Valid for 10 minutes.`;

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
  result.whatsappLink = whatsappManualLink(code);
  console.log(`[OTP dev] Phone ${phone}: ${code} (WhatsApp manual: ${result.whatsappLink})`);

  if (!isProduction()) {
    result.devMode = true;
    result.devCode = code;
  }

  return result;
}
