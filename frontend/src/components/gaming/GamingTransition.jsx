import { useEffect, useState } from 'react';
import { useGaming } from '../../context/GamingContext';
import GamingLogo from './GamingLogo';
import ShopLogo from './ShopLogo';

const CONFIG = {
  'gaming-in': {
    theme: 'gaming-in',
    steps: ['INITIALIZING...', 'LOADING TRIGGERS...', 'PUBG MODE READY...', 'GAMING MODE ON'],
    line1: 'GAMING MODE',
    line2: 'ACTIVATED',
    stats: ['FPS ∞', 'LATENCY 0ms', 'PUBG READY'],
    Logo: GamingLogo,
    logoSize: 96,
  },
  'gaming-out': {
    theme: 'gaming-out',
    steps: ['SAVING SESSION...', 'CLOSING TRIGGERS...', 'POWERING DOWN...', 'NORMAL MODE'],
    line1: 'GAMING MODE',
    line2: 'DEACTIVATED',
    stats: ['TRIGGERS OFF', 'RGB SLEEP', 'EXITING...'],
    Logo: GamingLogo,
    logoSize: 96,
  },
  'shop-in': {
    theme: 'shop-in',
    steps: ['OPENING SHOP...', 'LOADING GEAR...', 'ACCESSORIES READY...', 'PURCHASE MODE ON'],
    line1: 'SHOP MODE',
    line2: 'ACTIVATED',
    stats: ['CASES ✓', 'CHARGERS ✓', 'ORDER NOW'],
    Logo: ShopLogo,
    logoSize: 96,
  },
};

export default function GamingTransition() {
  const { transitioning, transitionType } = useGaming();
  const [step, setStep] = useState(0);

  const config = CONFIG[transitionType] || CONFIG['gaming-in'];

  useEffect(() => {
    if (!transitioning || !transitionType) {
      setStep(0);
      return;
    }
    const steps = CONFIG[transitionType]?.steps ?? [];
    const timers = steps.map((_, i) =>
      setTimeout(() => setStep(i), 180 + i * 250)
    );
    return () => timers.forEach(clearTimeout);
  }, [transitioning, transitionType]);

  if (!transitioning || !transitionType) return null;

  const Logo = config.Logo;
  const isExit = transitionType === 'gaming-out';
  const isShop = transitionType === 'shop-in';

  return (
    <div className={`mode-transition mode-transition--${config.theme}`} aria-hidden="true">
      <div className="gaming-transition-vignette" />
      <div className="gaming-transition-grid" />
      <div className="gaming-transition-hex" />
      <div className="gaming-transition-scanlines" />

      <div className={`gaming-particles ${isExit ? 'gaming-particles--implode' : ''}`}>
        {Array.from({ length: 24 }, (_, i) => (
          <span key={i} className="gaming-particle" style={{ '--pi': i }} />
        ))}
      </div>

      <div className={`gaming-transition-content ${isExit ? 'gaming-transition-content--exit' : ''}`}>
        <div className="gaming-transition-logo-wrap">
          {!isExit && (
            <>
              <span className="gaming-orbit-ring gaming-orbit-ring--1" />
              <span className="gaming-orbit-ring gaming-orbit-ring--2" />
              <span className="gaming-orbit-ring gaming-orbit-ring--3" />
            </>
          )}
          {isExit && <span className="exit-orbit-ring" />}
          <Logo
            size={config.logoSize}
            className={`gaming-transition-logo ${isExit ? 'gaming-transition-logo--exit' : ''}`}
            animated={!isExit}
          />
        </div>

        <div className="gaming-transition-text">
          <span className={`gt-line1 ${isExit ? 'gt-line1--exit' : ''} ${isShop ? 'gt-line1--shop' : ''}`}>
            {config.line1}
          </span>
          <span className={`gt-line2 ${isExit ? 'gt-line2--exit' : ''} ${isShop ? 'gt-line2--shop' : ''}`}>
            {config.line2}
          </span>
        </div>

        <div className="gaming-boot-step">{config.steps[step]}</div>

        <div className="gaming-transition-bar">
          <div className={`gaming-transition-bar-fill ${isExit ? 'gaming-transition-bar-fill--reverse' : ''}`} />
        </div>

        <div className="gaming-transition-stats">
          {config.stats.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </div>

      <div className={`gaming-transition-flash ${isExit ? 'gaming-transition-flash--red' : ''} ${isShop ? 'gaming-transition-flash--orange' : ''}`} />
      <div className={`gaming-transition-flash gaming-transition-flash--2 ${isExit ? 'gaming-transition-flash--red' : ''}`} />
    </div>
  );
}
