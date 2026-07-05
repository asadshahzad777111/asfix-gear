/** Quick-reply templates for repair booking chat — {name} replaced with customer name. */
export const STAFF_REPAIR_TEMPLATES = [
  {
    id: 'greeting',
    labelKey: 'repairChat.tplGreeting',
    en: 'Assalam o Alaikum {name}, thank you for choosing AsFix & Gear. We have received your repair booking and will review the details shortly.',
    roman: 'Assalam o Alaikum {name}, AsFix & Gear choose karne ka shukriya. Aap ki repair booking receive ho gayi hai — hum jald details review karenge.',
  },
  {
    id: 'ask_details',
    labelKey: 'repairChat.tplAskDetails',
    en: 'Assalam o Alaikum {name}, could you please share any extra details about the issue (when it started, drops/water damage, etc.)? This helps us prepare before you visit.',
    roman: 'Assalam o Alaikum {name}, kya aap maslay ki thori aur detail share kar sakte hain (kab se hai, girna/pani, waghera)? Is se shop par tayyari asaan hoti hai.',
  },
  {
    id: 'diagnosis',
    labelKey: 'repairChat.tplDiagnosis',
    en: 'Assalam o Alaikum {name}, our technician has inspected your device. We will share a clear quote with you shortly — no repair starts without your approval.',
    roman: 'Assalam o Alaikum {name}, technician ne aap ka device check kar liya hai. Jald clear quote share karenge — aap ki approval ke baghair repair start nahi hoti.',
  },
  {
    id: 'repair_started',
    labelKey: 'repairChat.tplRepairStarted',
    en: 'Assalam o Alaikum {name}, your repair work has started at our shop. We will update you if anything changes.',
    roman: 'Assalam o Alaikum {name}, aap ki repair shop par start ho chuki hai. Koi change ho to foran batayenge.',
  },
  {
    id: 'ready_pickup',
    labelKey: 'repairChat.tplReadyPickup',
    en: 'Assalam o Alaikum {name}, good news — your device is ready for pickup at AsFix & Gear. Please visit during shop hours at your convenience.',
    roman: 'Assalam o Alaikum {name}, khushkhabri — aap ka device pickup ke liye tayyar hai. Shop hours mein aap ki sahulat ke mutabiq aa jayein.',
  },
  {
    id: 'payment_reminder',
    labelKey: 'repairChat.tplPaymentReminder',
    en: 'Assalam o Alaikum {name}, friendly reminder: please settle the repair balance when you collect your device. Thank you for your cooperation.',
    roman: 'Assalam o Alaikum {name}, yaad dhani: device lene par repair ka balance settle kar dein. Shukriya.',
  },
  {
    id: 'delay_notice',
    labelKey: 'repairChat.tplDelayNotice',
    en: 'Assalam o Alaikum {name}, we need a little extra time for your repair due to parts/quality checks. We appreciate your patience and will update you soon.',
    roman: 'Assalam o Alaikum {name}, parts/quality check ki wajah se thora extra time lagega. Sabr ka shukriya — jald update denge.',
  },
  {
    id: 'thank_you',
    labelKey: 'repairChat.tplThankYou',
    en: 'Thank you {name} for trusting AsFix & Gear. If you need anything else, message us here anytime.',
    roman: 'Shukriya {name} — AsFix & Gear par bharosa karne ka. Aur kuch chahiye ho to yahan message karein.',
  },
];

export const CUSTOMER_REPAIR_TEMPLATES = [
  {
    id: 'ask_cost',
    labelKey: 'repairChat.tplAskCost',
    en: 'Assalam o Alaikum, please share the estimated repair cost for my device when possible. Thank you.',
    roman: 'Assalam o Alaikum, jab mumkin ho repair ki estimated cost bata dein. Shukriya.',
  },
  {
    id: 'ask_timing',
    labelKey: 'repairChat.tplAskTiming',
    en: 'Assalam o Alaikum, roughly when will my repair be ready? Thank you.',
    roman: 'Assalam o Alaikum, repair kab tak ready ho sakti hai? Shukriya.',
  },
  {
    id: 'ask_status',
    labelKey: 'repairChat.tplAskStatus',
    en: 'Assalam o Alaikum, could you please share an update on my repair status?',
    roman: 'Assalam o Alaikum, repair status ka update de dein?',
  },
  {
    id: 'customer_thanks',
    labelKey: 'repairChat.tplCustomerThanks',
    en: 'Thank you for the update — appreciated.',
    roman: 'Update ka shukriya.',
  },
];

export function fillRepairTemplate(template, { name, lang = 'en' }) {
  const text = lang === 'roman' ? template.roman : template.en;
  const customerName = String(name || '').trim() || 'Customer';
  return text.replace(/\{name\}/g, customerName);
}
