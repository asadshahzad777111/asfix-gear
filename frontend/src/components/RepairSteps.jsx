import { useTranslation } from '../context/LanguageContext';

const STEP_KEYS = [
  { num: '01', icon: '📲', title: 'repair.step1Title', desc: 'repair.step1Desc' },
  { num: '02', icon: '🔍', title: 'repair.step2Title', desc: 'repair.step2Desc' },
  { num: '03', icon: '🔧', title: 'repair.step3Title', desc: 'repair.step3Desc' },
  { num: '04', icon: '✅', title: 'repair.step4Title', desc: 'repair.step4Desc' },
];

export default function RepairSteps() {
  const { t } = useTranslation();

  return (
    <div className="repair-steps">
      {STEP_KEYS.map((step, i) => (
        <div key={step.num} className="repair-step">
          <div className="repair-step-num">{step.num}</div>
          <div className="repair-step-body">
            <span className="repair-step-icon">{step.icon}</span>
            <h3>{t(step.title)}</h3>
            <p>{t(step.desc)}</p>
          </div>
          {i < STEP_KEYS.length - 1 && <div className="repair-step-line" />}
        </div>
      ))}
    </div>
  );
}
