import { useTranslation } from '../context/LanguageContext';
import { getDeliveryTimelineIndex, getOrderCustomerStatus } from '../utils/orderStatus';

const STEPS = ['placed', 'payment', 'rider', 'delivered'];

export default function OrderTimeline({ order, status, statusHistory = [] }) {
  const { t } = useTranslation();
  const customerStatus = order ? getOrderCustomerStatus(order) : status;
  const activeIdx = order ? getDeliveryTimelineIndex(order) : getLegacyTimelineIndex(status);

  const stepTime = (stepIdx) => {
    const keys = ['pending', 'payment_verified', 'out_for_delivery', 'delivered'];
    const target = keys[stepIdx];
    const entry = [...statusHistory].reverse().find((h) => h.status === target);
    if (entry?.at) {
      return new Date(entry.at).toLocaleString('en-PK', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return null;
  };

  return (
    <div className="order-timeline">
      {STEPS.map((step, idx) => {
        const done = idx <= activeIdx;
        const current = idx === activeIdx && customerStatus !== 'delivered';
        const time = done ? stepTime(idx) : null;

        return (
          <div key={step} className={`order-timeline-step ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
            <div className="order-timeline-rail">
              <span className="order-timeline-dot" aria-hidden="true" />
              {idx < STEPS.length - 1 && <span className="order-timeline-line" aria-hidden="true" />}
            </div>
            <div className="order-timeline-body">
              <strong>{t(`track.step_${step}`)}</strong>
              {time && <small>{time}</small>}
              {current && customerStatus === 'waiting_for_rider' && (
                <em className="order-timeline-sub">{t('track.waitingForRider')}</em>
              )}
              {current && customerStatus === 'rider_assigned' && (
                <em className="order-timeline-sub">{t('track.riderAssignedNote')}</em>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getLegacyTimelineIndex(status) {
  if (status === 'delivered') return 3;
  if (status === 'shipped' || status === 'out_for_delivery' || status === 'rider_assigned') return 2;
  if (status === 'payment_verified' || status === 'paid' || status === 'waiting_for_rider') return 1;
  return 0;
}
