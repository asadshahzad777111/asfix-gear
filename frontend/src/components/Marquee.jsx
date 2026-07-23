import { useTranslation } from '../context/LanguageContext';
import TextParticle from './motion/TextParticle';

/** Category / service words shown in the scrolling strip */
const MARQUEE_KEYS = ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7', 'm8', 'm9', 'm10'];

export default function Marquee() {
  const { t } = useTranslation();
  const items = MARQUEE_KEYS.map((key) => t(`marquee.${key}`));
  const track = [...items, ...items];

  return (
    <div className="marquee-wrap" aria-hidden="true">
      <div className="marquee-track">
        {track.map((item, i) => (
          <span key={`${item}-${i}`} className="marquee-item">
            {/* Duplicate half stays plain text for perf; first half gets particles */}
            {i < items.length ? (
              <TextParticle text={item} gap={4} mouseRadius={40} maxParticles={220} aria-hidden />
            ) : (
              item
            )}
            <span className="marquee-dot">✦</span>
          </span>
        ))}
      </div>
    </div>
  );
}

export function MarqueeStatic() {
  return null;
}
