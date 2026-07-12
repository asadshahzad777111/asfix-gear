/**
 * Editable legal copy for AsFix & Gear (Lahore).
 * Keep EN + Roman Urdu in sync. Update LEGAL_UPDATED when policies change.
 */
import { SHOP } from '../config/shop';

const PHONE = SHOP.phone;
const EMAIL = SHOP.email;
const CITY = SHOP.city;
const NAME = SHOP.name;
const OWNER = SHOP.owner;

export const LEGAL_UPDATED = '12 July 2026';

export const legalPages = {
  privacy: {
    en: {
      title: 'Privacy Policy',
      intro: `${NAME} (“we”, “us”) respects your privacy. This policy explains what we collect when you use asfixgear.com, place orders, book repairs, or contact us on WhatsApp.`,
      sections: [
        {
          heading: 'Information we collect',
          body: [
            'Account details you provide: name, phone number, email (if given), and delivery address with map pin.',
            'Order and repair details: products ordered, device info for repairs, notes you write, and payment method chosen (JazzCash, EasyPaisa, bank, or Cash on Delivery).',
            'Technical basics: browser type and approximate usage needed to keep the site working (we do not sell personal data).',
          ],
        },
        {
          heading: 'How we use your information',
          body: [
            'To process orders, repairs, delivery, and customer support.',
            'To send order confirmations and status updates by email or WhatsApp when available.',
            'To improve our shop experience and prevent fraud or abuse.',
          ],
        },
        {
          heading: 'Sharing',
          body: [
            'We do not sell your personal information.',
            'We may share delivery details with our trusted riders or courier partners only as needed to deliver your order in Lahore / Pakistan.',
            'Payment wallet numbers stay with you — we never ask for your JazzCash/EasyPaisa PIN or OTP.',
          ],
        },
        {
          heading: 'Data retention & security',
          body: [
            'Order and repair records are kept as needed for service history, warranties, and legal accounting.',
            'We take reasonable steps to protect account access (hashed passwords, staff-only admin tools). No method of transmission is 100% secure.',
          ],
        },
        {
          heading: 'Your choices',
          body: [
            'You can update account details from your account settings when signed in.',
            'To request correction or deletion of personal data (where allowed), WhatsApp or email us — we will respond within a reasonable time.',
          ],
        },
        {
          heading: 'Contact',
          body: [
            `WhatsApp / Phone: ${PHONE}`,
            `Email: ${EMAIL}`,
            `Shop: ${NAME}, ${CITY}, Pakistan`,
          ],
        },
      ],
    },
    roman: {
      title: 'Privacy Policy',
      intro: `${NAME} (“hum”) aap ki privacy ka ehtram karte hain. Yeh policy batati hai ke asfixgear.com use karte, order, repair, ya WhatsApp par rabta karte waqt hum kya information lete hain.`,
      sections: [
        {
          heading: 'Hum kya collect karte hain',
          body: [
            'Account details jo aap dete hain: naam, phone, email (agar diya), aur delivery address map pin ke sath.',
            'Order aur repair details: products, device info, notes, aur payment method (JazzCash, EasyPaisa, bank, ya Cash on Delivery).',
            'Technical basics: site chalane ke liye zaruri browser / usage info — hum personal data bechte nahi.',
          ],
        },
        {
          heading: 'Hum isay kaise use karte hain',
          body: [
            'Orders, repairs, delivery, aur customer support ke liye.',
            'Order confirmation aur status updates email ya WhatsApp se (jab available ho).',
            'Shop experience behtar karne aur fraud / abuse rokne ke liye.',
          ],
        },
        {
          heading: 'Sharing',
          body: [
            'Hum aap ki personal information nahi bechte.',
            'Delivery ke liye sirf zaruri details trusted rider / courier ko share ho sakti hain (Lahore / Pakistan).',
            'Wallet PIN ya OTP kabhi nahi mangte — payment aap khud transfer karte hain.',
          ],
        },
        {
          heading: 'Retention aur security',
          body: [
            'Order / repair records service history, warranty, aur hisaab ke liye rakhe jate hain.',
            'Account security ke liye hashed passwords aur staff-only admin tools use hote hain. 100% security guarantee nahi hoti.',
          ],
        },
        {
          heading: 'Aap ke choices',
          body: [
            'Signed-in account settings se details update kar sakte hain.',
            'Data correct / delete request (jahan allowed ho) WhatsApp ya email se bhejein — hum makool time mein jawab denge.',
          ],
        },
        {
          heading: 'Rabta',
          body: [
            `WhatsApp / Phone: ${PHONE}`,
            `Email: ${EMAIL}`,
            `Shop: ${NAME}, ${CITY}, Pakistan`,
          ],
        },
      ],
    },
  },

  refund: {
    en: {
      title: 'Refund & Return Policy',
      intro: 'We want you to be happy with accessories and repairs from AsFix & Gear. This policy is written honestly for Lahore customers.',
      sections: [
        {
          heading: 'Accessories (shop orders)',
          body: [
            'Unused products in original packing may be returned within 3 days of delivery if there is a manufacturing defect or wrong item shipped.',
            'Opened, used, damaged by customer, or “change of mind” after opening may not qualify for return — contact us and we will advise case by case.',
            `To start a return, WhatsApp us at ${PHONE} with Order ID, photos, and reason.`,
          ],
        },
        {
          heading: 'Refunds',
          body: [
            'Approved refunds are processed via the same method when possible (JazzCash / EasyPaisa / bank) or shop credit, usually within 3–7 working days after we receive and inspect the item.',
            'Cash on Delivery orders: if eligible, refund may be cash at shop or wallet transfer after return is accepted.',
            'Delivery / rider fees are generally non-refundable unless the error was ours (wrong item or failed delivery on our side).',
          ],
        },
        {
          heading: 'Repairs',
          body: [
            'Repair work follows the warranty discussed at booking (parts and labour as agreed).',
            'If a repair fails due to our workmanship within the stated warranty window, we will re-check and fix free of charge for the covered issue.',
            'Damage from drops, water, or third-party repair after pickup is not covered.',
          ],
        },
        {
          heading: 'Non-returnable',
          body: [
            'Personalised items, clearance / final-sale stock marked as such, and hygienic/consumable items (where applicable) are non-returnable unless defective on arrival.',
          ],
        },
        {
          heading: 'Contact',
          body: [
            `WhatsApp: ${PHONE} · Email: ${EMAIL}`,
            'Please keep your Order ID / repair booking reference ready.',
          ],
        },
      ],
    },
    roman: {
      title: 'Refund & Return Policy',
      intro: 'Hum chahte hain ke AsFix & Gear ke accessories aur repairs se aap khush rahein. Yeh policy Lahore customers ke liye seedhi aur honest hai.',
      sections: [
        {
          heading: 'Accessories (shop orders)',
          body: [
            'Unused product original packing mein delivery ke 3 din ke andar return ho sakta hai agar manufacturing defect ho ya galat item gaya ho.',
            'Opened / used / customer damage ya sirf “mind change” par return na mil sake — WhatsApp karein, case-by-case batayenge.',
            `Return shuru karne ke liye Order ID, photos, aur wajah ke sath WhatsApp karein: ${PHONE}`,
          ],
        },
        {
          heading: 'Refunds',
          body: [
            'Approved refunds usually 3–7 working days mein same method (JazzCash / EasyPaisa / bank) ya shop credit se — item receive + inspect ke baad.',
            'COD orders: eligible hone par cash at shop ya wallet transfer after return accept.',
            'Delivery / rider fee generally non-refundable — jab tak galti humari na ho (galat item / hamari taraf se fail delivery).',
          ],
        },
        {
          heading: 'Repairs',
          body: [
            'Repair warranty booking par discuss ke mutabiq (parts / labour).',
            'Hamari workmanship ki wajah se warranty window mein issue ho to covered problem free re-check / fix.',
            'Drop, water, ya kisi doosre se repair ke baad damage cover nahi.',
          ],
        },
        {
          heading: 'Non-returnable',
          body: [
            'Personalised, clearance / final-sale, aur hygienic/consumable items (jahan apply ho) generally non-returnable — unless defective on arrival.',
          ],
        },
        {
          heading: 'Rabta',
          body: [
            `WhatsApp: ${PHONE} · Email: ${EMAIL}`,
            'Order ID / repair booking reference ready rakhein.',
          ],
        },
      ],
    },
  },

  terms: {
    en: {
      title: 'Terms of Service',
      intro: `By using ${NAME} website, WhatsApp ordering, or in-shop services, you agree to these terms.`,
      sections: [
        {
          heading: 'Who we are',
          body: [
            `${NAME} is a mobile repair and accessories shop based in ${CITY}, Pakistan (owner: ${OWNER}).`,
            `Contact: ${PHONE} · ${EMAIL}`,
          ],
        },
        {
          heading: 'Orders & pricing',
          body: [
            'Prices on the website are in PKR and may change without notice until an order is confirmed.',
            'Placing an order requests a purchase; we may cancel if stock is unavailable, payment is not completed (for advance methods), or details look fraudulent — we will try to notify you.',
            'Cash on Delivery is offered mainly for Lahore delivery; we may ask for confirmation before dispatch.',
          ],
        },
        {
          heading: 'Payments',
          body: [
            'Advance methods: JazzCash, EasyPaisa, or bank transfer as shown at checkout. Include your Order ID in the transfer note.',
            'COD: pay the rider / shop the agreed amount on delivery. Keep exact change when possible.',
            'Never share OTPs or PINs with anyone claiming to be AsFix staff.',
          ],
        },
        {
          heading: 'Repairs',
          body: [
            'Repair estimates are approximate until diagnosis is complete. We will inform you of major changes before proceeding when practical.',
            'You confirm you are authorised to request repair on the device you submit.',
          ],
        },
        {
          heading: 'Accounts & acceptable use',
          body: [
            'Keep your login details private. Do not abuse the site, spam forms, or attempt unauthorised access.',
            'We may suspend accounts that violate these terms or local law.',
          ],
        },
        {
          heading: 'Liability',
          body: [
            'We provide services with reasonable care. To the extent allowed by law, we are not liable for indirect losses (lost data, business interruption, etc.).',
            'Backup important phone data before repair when possible.',
          ],
        },
        {
          heading: 'Changes',
          body: [
            'We may update these terms; the “Last updated” date on this page will change. Continued use means you accept the updated terms.',
          ],
        },
      ],
    },
    roman: {
      title: 'Terms of Service',
      intro: `${NAME} website, WhatsApp ordering, ya shop services use karke aap in terms se agree karte hain.`,
      sections: [
        {
          heading: 'Hum kaun hain',
          body: [
            `${NAME} — ${CITY}, Pakistan mein mobile repair aur accessories shop (owner: ${OWNER}).`,
            `Rabta: ${PHONE} · ${EMAIL}`,
          ],
        },
        {
          heading: 'Orders aur pricing',
          body: [
            'Website prices PKR mein hain; order confirm hone tak change ho sakti hain.',
            'Order place karna purchase request hai — stock na ho, advance payment incomplete ho, ya fraud lagay to cancel ho sakta hai; notify karne ki koshish karenge.',
            'Cash on Delivery mainly Lahore delivery ke liye; dispatch se pehle confirmation maang sakte hain.',
          ],
        },
        {
          heading: 'Payments',
          body: [
            'Advance: JazzCash, EasyPaisa, ya bank — checkout par details. Transfer note mein Order ID likhein.',
            'COD: delivery par agreed amount rider / shop ko dein. Possible ho to exact change rakhein.',
            'OTP / PIN kisi ko na dein — AsFix staff yeh nahi mangte.',
          ],
        },
        {
          heading: 'Repairs',
          body: [
            'Repair estimate approximate hota hai jab tak diagnosis complete na ho. Bari change par practical had tak bataenge.',
            'Aap confirm karte hain ke device repair ke liye aap authorised hain.',
          ],
        },
        {
          heading: 'Accounts aur use',
          body: [
            'Login details private rakhein. Site abuse, spam, ya unauthorised access na karein.',
            'Terms / qanoon torne par account suspend ho sakta hai.',
          ],
        },
        {
          heading: 'Liability',
          body: [
            'Hum makool care se service dete hain. Qanoon ki had tak indirect loss (data loss, business interruption) ki zimmedari nahi.',
            'Repair se pehle important data backup karein jab mumkin ho.',
          ],
        },
        {
          heading: 'Changes',
          body: [
            'Terms update ho sakte hain; page par “Last updated” date badlegi. Use continue = updated terms accept.',
          ],
        },
      ],
    },
  },

  shipping: {
    en: {
      title: 'Shipping & Warranty',
      intro: 'How delivery and product/repair warranties work at AsFix & Gear, Lahore.',
      sections: [
        {
          heading: 'Delivery area',
          body: [
            'We prioritise delivery within Lahore. Orders outside Lahore may take longer and may require advance payment — final delivery fee is confirmed by staff.',
            'Estimated Lahore delivery fee shown at checkout is a guide only; the final rider charge may be confirmed when your order is prepared.',
          ],
        },
        {
          heading: 'Timing',
          body: [
            'After payment verification (or COD confirmation), most Lahore orders aim for same-day or next-day delivery during shop hours (9 AM – 9 PM), subject to rider availability and weather.',
            'You can track status on the Track page with Order ID + phone.',
          ],
        },
        {
          heading: 'Failed delivery',
          body: [
            'Please keep your phone reachable. If delivery fails twice due to unreachable customer / wrong pin, we may ask you to collect from the shop or reschedule with an extra fee.',
          ],
        },
        {
          heading: 'Product warranty',
          body: [
            'Accessory warranty (if any) is shown on the product page and order communication. Keep proof of purchase (Order ID).',
            'Warranty usually covers manufacturing defects, not physical damage, water damage, or misuse.',
            'Claim via WhatsApp with Order ID and clear photos/video of the issue.',
          ],
        },
        {
          heading: 'Repair warranty',
          body: [
            'Repair warranty period and coverage are explained at booking / intake (parts vs labour).',
            'Bring the device and booking reference for warranty checks. Third-party repairs or new damage may void coverage.',
          ],
        },
        {
          heading: 'Questions',
          body: [
            `WhatsApp ${PHONE} · ${EMAIL}`,
            'We are happy to clarify shipping or warranty before you order.',
          ],
        },
      ],
    },
    roman: {
      title: 'Shipping & Warranty',
      intro: 'AsFix & Gear Lahore par delivery aur product/repair warranty kaise kaam karti hai.',
      sections: [
        {
          heading: 'Delivery area',
          body: [
            'Pehli priority Lahore delivery. Bahir ke orders mein zyada time lag sakta hai aur advance payment chahiye ho sakti hai — final delivery fee staff confirm karega.',
            'Checkout par dikhaya Lahore estimated fee guide hai; final rider charge order prepare hote waqt confirm ho sakta hai.',
          ],
        },
        {
          heading: 'Timing',
          body: [
            'Payment verify (ya COD confirm) ke baad aksar Lahore orders same-day / next-day (9 AM – 9 PM), rider aur weather ke hisaab se.',
            'Track page par Order ID + phone se status dekhein.',
          ],
        },
        {
          heading: 'Failed delivery',
          body: [
            'Phone reachable rakhein. Do dafa unreachable / galat pin ki wajah se fail ho to shop pickup ya reschedule + extra fee ho sakti hai.',
          ],
        },
        {
          heading: 'Product warranty',
          body: [
            'Accessory warranty (agar ho) product page aur order messages par. Order ID proof rakhein.',
            'Usually manufacturing defect cover — physical / water damage ya misuse nahi.',
            'Claim: WhatsApp par Order ID + clear photos/video.',
          ],
        },
        {
          heading: 'Repair warranty',
          body: [
            'Repair warranty period / coverage booking ya intake par batayi jati hai (parts vs labour).',
            'Warranty check ke liye device + booking reference layein. Third-party repair / naya damage coverage khatam kar sakta hai.',
          ],
        },
        {
          heading: 'Sawalat',
          body: [
            `WhatsApp ${PHONE} · ${EMAIL}`,
            'Order se pehle shipping / warranty clear karne mein khushi hogi.',
          ],
        },
      ],
    },
  },
};

export function getLegalPage(key, lang = 'en') {
  const page = legalPages[key];
  if (!page) return null;
  return page[lang] || page.en;
}
