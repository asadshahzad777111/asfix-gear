import { useTranslation } from '../context/LanguageContext';

const STEPS = ['received', 'in_progress', 'completed'];

export default function RepairTimeline({ status, statusHistory = [] }) {
  const { t } = useTranslation();
  const activeIdx = getRepairTimelineIndex(status);
  const cancelled = status === 'cancelled';

  const stepTime = (stepIdx) => {
    const keys = ['pending', 'in_progress', 'completed'];
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

  if (cancelled) {
    const cancelledAt = [...statusHistory].reverse().find((h) => h.status === 'cancelled')?.at;
    return (
      <div className="order-timeline repair-timeline repair-timeline--cancelled">
        <div className="order-timeline-step done current">
          <div className="order-timeline-rail">
            <span className="order-timeline-dot" aria-hidden="true" />
          </div>
          <div className="order-timeline-body">
            <strong>{t('track.repair_status_cancelled')}</strong>
            {cancelledAt && (
              <small>{new Date(cancelledAt).toLocaleString('en-PK', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              })}</small>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="order-timeline repair-timeline">
      {STEPS.map((step, idx) => {
        const done = idx <= activeIdx;
        const current = idx === activeIdx && status !== 'completed';
        const time = done ? stepTime(idx) : null;

        return (
          <div key={step} className={`order-timeline-step ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
            <div className="order-timeline-rail">
              <span className="order-timeline-dot" aria-hidden="true" />
              {idx < STEPS.length - 1 && <span className="order-timeline-line" aria-hidden="true" />}
            </div>
            <div className="order-timeline-body">
              <strong>{t(`track.repair_step_${step}`)}</strong>
              {time && <small>{time}</small>}
              {current && status === 'pending' && (
                <em className="order-timeline-sub">{t('track.repairPendingNote')}</em>
              )}
              {current && status === 'in_progress' && (
                <em className="order-timeline-sub">{t('track.repairInProgressNote')}</em>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getRepairTimelineIndex(status) {
  if (status === 'completed') return 2;
  if (status === 'in_progress') return 1;
  return 0;
}
