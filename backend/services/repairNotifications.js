import { formatBookingRef } from '../store/data-migration.js';

function formatPkr(amount) {
  return `PKR ${Number(amount || 0).toLocaleString('en-PK')}`;
}

/** Customer-facing WhatsApp text when staff changes repair status. */
export function buildRepairStatusCustomerMessage(booking, status) {
  const ref = booking.booking_ref || formatBookingRef(booking.id);
  const device = `${booking.device_brand || ''} ${booking.device_model || ''}`.trim() || 'device';
  const name = booking.customer_name || 'Customer';
  const costLine =
    booking.estimated_cost != null && Number(booking.estimated_cost) > 0
      ? ` Estimated cost: ${formatPkr(booking.estimated_cost)}.`
      : '';

  const messages = {
    in_progress: `Assalam o Alaikum ${name}! Aap ka ${device} repair (Ref: ${ref}) ab shop mein progress mein hai.${costLine} Status /track par booking ID se check kar sakte hain.`,
    completed: `Assalam o Alaikum ${name}! Aap ka ${device} repair (Ref: ${ref}) complete ho gayi hai.${costLine} Pickup ke liye shop se rabta karein ya /track par details dekhein.`,
    cancelled: `Assalam o Alaikum ${name}. Aap ki repair booking (Ref: ${ref}) cancel kar di gayi hai. Koi sawal ho to WhatsApp par message karein.`,
  };

  return messages[status] || null;
}
