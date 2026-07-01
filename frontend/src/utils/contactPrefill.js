import { getSalePrice, hasDiscount } from './pricing';
import { SHOP } from '../config/shop';
import { SCREEN_QUALITY_TIERS } from '../config/repairIntake';

const SIGNOFF = '\n\nThank you — AsFix & Gear';

function formatRs(amount) {
  return `Rs. ${Number(amount).toLocaleString('en-PK')}`;
}

function productPriceLines(product) {
  if (hasDiscount(product)) {
    return [
      `Original: ${formatRs(product.price)}`,
      `Sale price: ${formatRs(getSalePrice(product))} (${product.discount_percent}% off)`,
    ].join('\n');
  }
  return `Price: ${formatRs(product.price)}`;
}

const TIER_MAP = Object.fromEntries(SCREEN_QUALITY_TIERS.map((t) => [t.id, t]));

/**
 * Build professional subject + message for the contact page.
 * @param {{ type: string, [key: string]: unknown }} input
 * @returns {{ subject: string, message: string }}
 */
export function buildContactPrefill(input = {}) {
  const { type } = input;

  switch (type) {
    case 'product': {
      const { product } = input;
      return {
        subject: `Product order: ${product.name}`,
        message: [
          'Assalam o Alaikum!',
          '',
          `I would like to order the following item from ${SHOP.name}:`,
          '',
          `*${product.name}*`,
          productPriceLines(product),
          `Category: ${product.category}`,
          '',
          'Please confirm availability and delivery options.',
          SIGNOFF,
        ].join('\n'),
      };
    }

    case 'repair-service': {
      const { serviceName, modelHint = '' } = input;
      const modelLine = modelHint ? `Device: *${modelHint}*\n` : '';
      return {
        subject: `Repair quote: ${serviceName}`,
        message: [
          'Assalam o Alaikum!',
          '',
          `I need a repair quote from ${SHOP.name}.`,
          '',
          modelLine + `Service: *${serviceName}*`,
          '',
          'Please share the estimated cost after checking my model.',
          SIGNOFF,
        ].join('\n'),
      };
    }

    case 'repair-model': {
      const { modelHint = '' } = input;
      return {
        subject: modelHint ? `Repair inquiry: ${modelHint}` : 'Repair inquiry',
        message: [
          'Assalam o Alaikum!',
          '',
          modelHint ? `My device: *${modelHint}*` : 'I need help with a phone repair.',
          '',
          'Please share repair pricing and availability.',
          SIGNOFF,
        ].join('\n'),
      };
    }

    case 'screen-quality': {
      const { deviceLabel = '', tierId = 'medium' } = input;
      const deviceLine = deviceLabel ? `Device: *${deviceLabel}*\n` : '';

      if (tierId === 'compare') {
        return {
          subject: 'Screen replacement — compare quality options',
          message: [
            'Assalam o Alaikum!',
            '',
            deviceLine + 'I need a *screen replacement*.',
            '',
            'Could you please share separate rates for *Low, Medium, and High* quality screens?',
            SIGNOFF,
          ].join('\n'),
        };
      }

      const tier = TIER_MAP[tierId] || TIER_MAP.medium;
      return {
        subject: `Screen replacement — ${tier.label}`,
        message: [
          'Assalam o Alaikum!',
          '',
          deviceLine + 'Service: *Screen replacement*',
          `Preferred quality: *${tier.label}*`,
          '',
          'Please confirm the exact rate and availability for this quality.',
          SIGNOFF,
        ].join('\n'),
      };
    }

    case 'cart': {
      const { items = [], total = 0, formatPrice } = input;
      const lines = items.map((i) => `• ${i.name} ×${i.qty}`).join('\n');
      return {
        subject: 'Shop order inquiry',
        message: [
          'Assalam o Alaikum!',
          '',
          `I would like to place an order with ${SHOP.name}:`,
          '',
          lines,
          '',
          `Estimated total: ${typeof formatPrice === 'function' ? formatPrice(total) : formatRs(total)}`,
          '',
          'Please confirm availability and payment/delivery details.',
          SIGNOFF,
        ].join('\n'),
      };
    }

    case 'directions': {
      return {
        subject: 'Visit shop — directions',
        message: [
          'Assalam o Alaikum!',
          '',
          `I plan to visit *${SHOP.name}*.`,
          '',
          `Address: ${SHOP.fullAddress}`,
          `Google Maps: ${SHOP.mapsUrl}`,
          '',
          'Please confirm shop hours and any landmarks to look for.',
          SIGNOFF,
        ].join('\n'),
      };
    }

    case 'gaming': {
      return {
        subject: 'Gaming gear order',
        message: [
          'Assalam o Alaikum!',
          '',
          `I am interested in gaming accessories from ${SHOP.name} (PUBG triggers, grips, cooling fans, etc.).`,
          '',
          'Please help me choose the right gear and confirm availability.',
          SIGNOFF,
        ].join('\n'),
      };
    }

    case 'order-receipt': {
      const { text } = input;
      return {
        subject: 'Order receipt & payment confirmation',
        message: text || [
          'Assalam o Alaikum!',
          '',
          'Please find my order details below for verification.',
          SIGNOFF,
        ].join('\n'),
      };
    }

    case 'repair-receipt': {
      const { text } = input;
      return {
        subject: 'Repair intake confirmation',
        message: text || [
          'Assalam o Alaikum!',
          '',
          'Please find my repair intake details below.',
          SIGNOFF,
        ].join('\n'),
      };
    }

    case 'general':
    default:
      return {
        subject: 'General inquiry',
        message: [
          'Assalam o Alaikum!',
          '',
          `I would like to get in touch with ${SHOP.name}.`,
          '',
          'Please let me know how I can proceed.',
          SIGNOFF,
        ].join('\n'),
      };
  }
}

/** @param {{ subject?: string, message?: string }} prefill */
export function buildContactPath(prefill = {}) {
  const params = new URLSearchParams();
  if (prefill.subject) params.set('subject', prefill.subject);
  if (prefill.message) params.set('message', prefill.message);
  const qs = params.toString();
  return qs ? `/contact?${qs}` : '/contact';
}

/** @param {import('react-router-dom').NavigateFunction} navigate */
export function navigateToContact(navigate, prefill, options = {}) {
  navigate('/contact', {
    state: { contactPrefill: prefill },
    ...options,
  });
}

/** Compose WhatsApp body from contact form fields. */
export function composeContactWhatsAppBody({ subject = '', message = '' } = {}) {
  const body = message.trim();
  const subj = subject.trim();
  if (subj && body) return `*${subj}*\n\n${body}`;
  return subj || body;
}
