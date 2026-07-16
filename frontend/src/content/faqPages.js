import { SHOP } from '../config/shop';

/** FAQ content — English + Roman Urdu (same shape as legal pages). */
export const FAQ_UPDATED = 'July 2026';

const FAQ = {
  en: {
    title: 'Frequently Asked Questions',
    intro: 'Quick answers about payments, Cash on Delivery, delivery, shop pickup, warranty, and repairs at AsFix & Gear (Lahore).',
    items: [
      {
        q: 'Which payment methods do you accept?',
        a: 'JazzCash, EasyPaisa, Meezan Bank transfer, and Cash on Delivery (Lahore delivery or shop pickup). For wallet/bank orders, pay the full amount in advance and put your Order ID in the transfer note.',
      },
      {
        q: 'Is Cash on Delivery available?',
        a: 'Yes — COD is available for Lahore home delivery and for shop pickup. Other cities need JazzCash, EasyPaisa, or bank transfer before dispatch.',
      },
      {
        q: 'How much is delivery in Lahore?',
        a: 'Checkout shows an estimated Lahore delivery fee (admin-configurable; default Rs. 150). Staff confirms the final delivery charge before dispatch. Outside Lahore, fee is confirmed on WhatsApp.',
      },
      {
        q: 'Can I pick up my order from the shop?',
        a: 'Yes. Choose Shop pickup at checkout. We will WhatsApp you when the order is ready. Address is on the Contact / FAQ pages and Google Maps.',
      },
      {
        q: 'How do I prove I paid via JazzCash / EasyPaisa / bank?',
        a: `After placing the order, upload a payment screenshot on the success screen (if uploads are enabled), or WhatsApp the screenshot with your Order ID to ${SHOP.phone}.`,
      },
      {
        q: 'What warranty do products have?',
        a: 'Warranty depends on the product — check the product page. Repair warranty (if any) is explained at booking and on our Shipping & Warranty page. Suddenly-dead / board-level repairs usually have no warranty.',
      },
      {
        q: 'How do I book a phone repair?',
        a: 'Use the Repair page intake form or WhatsApp us with your model and issue. Final price is confirmed after diagnosis in shop or on WhatsApp.',
      },
      {
        q: 'How can I track my order?',
        a: 'Use the Track page with your Order ID and phone, or sign in to My Account. Status emails/WhatsApp updates go out when payment is verified, shipped, out for delivery, or cancelled (when an email is on file).',
      },
    ],
  },
  roman: {
    title: 'Frequently Asked Questions',
    intro: 'Payment, COD, delivery, shop pickup, warranty aur repair ke bare mein short jawab — AsFix & Gear, Lahore.',
    items: [
      {
        q: 'Kaun se payment methods chalte hain?',
        a: 'JazzCash, EasyPaisa, Meezan Bank transfer, aur Cash on Delivery (Lahore delivery ya shop pickup). Wallet/bank orders mein pehle full payment karein aur transfer note mein Order ID likhein.',
      },
      {
        q: 'Cash on Delivery available hai?',
        a: 'Haan — COD Lahore home delivery aur shop pickup ke liye. Doosre shehron ke liye JazzCash, EasyPaisa ya bank transfer pehle zaroori hai.',
      },
      {
        q: 'Lahore delivery fee kitni hai?',
        a: 'Checkout par estimated Lahore delivery fee dikhti hai (admin set karta hai; default Rs. 150). Final charge staff dispatch se pehle confirm karta hai. Lahore ke bahar fee WhatsApp par confirm hoti hai.',
      },
      {
        q: 'Shop se pickup kar sakta hoon?',
        a: 'Haan. Checkout mein Shop pickup choose karein. Order ready hone par WhatsApp aayega. Address Contact / FAQ aur Google Maps par hai.',
      },
      {
        q: 'JazzCash / EasyPaisa / bank payment ka proof kaise doon?',
        a: `Order place ke baad success screen par screenshot upload karein (agar upload on ho), ya Order ID ke sath screenshot WhatsApp ${SHOP.phone} par bhej dein.`,
      },
      {
        q: 'Products ki warranty kya hai?',
        a: 'Warranty product ke mutabiq — product page dekhein. Repair warranty (agar ho) booking aur Shipping & Warranty page par clear hoti hai. Suddenly-dead / board-level repair par usually warranty nahi.',
      },
      {
        q: 'Phone repair kaise book karein?',
        a: 'Repair page ka intake form use karein ya model + issue WhatsApp karein. Final price diagnose ke baad shop / WhatsApp par confirm hoti hai.',
      },
      {
        q: 'Order track kaise karein?',
        a: 'Track page par Order ID + phone dein, ya My Account mein sign in karein. Payment verify, shipped, out for delivery, ya cancel par email/WhatsApp update (agar email save ho).',
      },
    ],
  },
};

export function getFaqPage(lang = 'en') {
  return FAQ[lang === 'roman' ? 'roman' : 'en'];
}
