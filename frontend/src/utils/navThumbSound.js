/** Tiny UI sounds for mobile nav thumb — Web Audio, no files. Respects reduced motion. */

export function createNavThumbAudio() {
  let ctx = null;
  const muted = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const unlock = () => {
    if (muted) return;
    if (!ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      ctx = new Ctx();
    }
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  };

  const tone = (frequency, duration, volume, type = 'sine') => {
    if (muted || !ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.01);
  };

  return {
    unlock,
    /** Soft tick when thumb passes onto a menu row */
    hoverTick() {
      tone(620, 0.035, 0.028, 'triangle');
    },
    /** Short confirm blip before link/button activates */
    selectClick() {
      tone(420, 0.045, 0.038, 'sine');
      window.setTimeout(() => tone(780, 0.04, 0.022, 'triangle'), 28);
    },
  };
}
