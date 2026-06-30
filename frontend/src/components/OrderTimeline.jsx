import { useTranslation } from '../context/LanguageContext';
import { getTimelineStepIndex } from '../utils/receipts';

const STEPS = ['placed', 'payment', 'shipped', 'delivered'];

export default function OrderTimeline({ status, statusHistory = [] }) {
  const { t } = useTranslation();
  const activeIdx = getTimelineStepIndex(status);

  const stepTime = (stepIdx) => {
    const keys = ['pending', 'payment_verified', 'shipped', 'delivered'];
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
        const current = idx === activeIdx && status !== 'delivered';
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
              {current && status === 'out_for_delivery' && (
                <em className="order-timeline-sub">{t('track.outForDelivery')}</em>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
