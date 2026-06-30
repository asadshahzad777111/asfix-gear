let audioCtx = null;
let masterGain = null;

const reducedMotion = () =>
  typeof window !== 'undefined'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function getCtx() {
  if (reducedMotion()) return null;
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.82;
    masterGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function now() {
  const ctx = getCtx();
  return ctx ? ctx.currentTime : 0;
}

/** ADSR tone with optional pitch glide */
function tone({
  freq,
  freqEnd = null,
  at = 0,
  dur = 0.08,
  type = 'sine',
  vol = 0.1,
  attack = 0.006,
  release = null,
}) {
  const ctx = getCtx();
  if (!ctx) return;

  const t = now() + at;
  const rel = release ?? Math.max(0.02, dur * 0.55);
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, freq), t);
  if (freqEnd) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
  }

  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(vol, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + rel);

  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + dur + 0.04);
}

function noiseBurst({ at = 0, dur = 0.04, vol = 0.06, freq = 1800, q = 1.4, type = 'highpass' }) {
  const ctx = getCtx();
  if (!ctx) return;

  const t = now() + at;
  const samples = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buffer = ctx.createBuffer(1, samples, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < samples; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / samples);
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);
  src.start(t);
}

function sweep({ start, end, at = 0, dur = 0.2, vol = 0.07, type = 'sawtooth' }) {
  const ctx = getCtx();
  if (!ctx) return;

  const t = now() + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, start), t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain);
  gain.connect(masterGain);
  osc.start(t);
  osc.stop(t + dur + 0.04);
}

function arp(notes, { at = 0, step = 0.055, dur = 0.07, type = 'square', vol = 0.055 }) {
  notes.forEach((freq, i) => {
    tone({ freq, at: at + i * step, dur, type, vol });
  });
}

function chord(notes, { at = 0, dur = 0.22, vol = 0.045, type = 'sine' }) {
  notes.forEach((freq) => tone({ freq, at, dur, type, vol }));
}

/** Gaming mode ON — aggressive welcome boot (~0.85s) */
export function playGamingActivate() {
  try {
    tone({ freq: 41.2, at: 0, dur: 0.2, type: 'sine', vol: 0.22, attack: 0.002, release: 0.16 });
    tone({ freq: 82.41, at: 0.01, dur: 0.12, type: 'square', vol: 0.12, attack: 0.001 });
    tone({ freq: 123.47, at: 0.02, dur: 0.1, type: 'sawtooth', vol: 0.06 });

    noiseBurst({ at: 0.03, dur: 0.05, vol: 0.09, freq: 900, type: 'bandpass', q: 0.9 });
    noiseBurst({ at: 0.04, dur: 0.04, vol: 0.07, freq: 2800, type: 'highpass' });

    tone({ freq: 196, at: 0.06, dur: 0.04, type: 'square', vol: 0.1, attack: 0.001 });

    arp([82.41, 110, 164.81, 220, 329.63, 440, 554.37], {
      at: 0.09,
      step: 0.042,
      dur: 0.055,
      type: 'sawtooth',
      vol: 0.065,
    });

    arp([164.81, 220, 329.63, 440], {
      at: 0.1,
      step: 0.042,
      dur: 0.05,
      type: 'square',
      vol: 0.05,
    });

    sweep({ start: 100, end: 3200, at: 0.34, dur: 0.22, vol: 0.085, type: 'sawtooth' });
    noiseBurst({ at: 0.36, dur: 0.04, vol: 0.06, freq: 4000, type: 'highpass' });

    tone({ freq: 523.25, at: 0.42, dur: 0.08, type: 'square', vol: 0.11, attack: 0.001 });
    tone({ freq: 659.25, at: 0.43, dur: 0.09, type: 'square', vol: 0.1, attack: 0.001 });
    tone({ freq: 783.99, at: 0.44, dur: 0.1, type: 'sawtooth', vol: 0.08 });

    chord([392, 493.88, 587.33, 783.99], { at: 0.5, dur: 0.32, vol: 0.06, type: 'sawtooth' });
    tone({ freq: 1174.66, at: 0.52, dur: 0.25, type: 'square', vol: 0.075 });
    tone({ freq: 1567.98, at: 0.54, dur: 0.22, type: 'sine', vol: 0.055 });

    tone({ freq: 55, at: 0.62, dur: 0.14, type: 'sine', vol: 0.14, attack: 0.001, release: 0.1 });
    tone({ freq: 880, at: 0.64, dur: 0.1, type: 'square', vol: 0.07, attack: 0.001 });
    noiseBurst({ at: 0.63, dur: 0.03, vol: 0.05, freq: 2200, type: 'bandpass' });
  } catch {
    /* silent */
  }
}

/** Gaming mode OFF — power-down (~0.55s) */
export function playGamingExit() {
  try {
    tone({ freq: 880, at: 0, dur: 0.08, type: 'square', vol: 0.07 });
    tone({ freq: 659.25, at: 0.06, dur: 0.1, type: 'square', vol: 0.06 });

    arp([659.25, 523.25, 392, 293.66, 220], {
      at: 0.12,
      step: 0.06,
      dur: 0.08,
      type: 'square',
      vol: 0.04,
    });

    sweep({ start: 1600, end: 90, at: 0.32, dur: 0.22, vol: 0.05, type: 'sawtooth' });
    tone({ freq: 82.41, at: 0.38, dur: 0.2, type: 'sine', vol: 0.1, release: 0.18 });
    noiseBurst({ at: 0.4, dur: 0.04, vol: 0.03, freq: 400, type: 'lowpass' });
  } catch {
    /* silent */
  }
}

/** Shop mode ON — soft welcome chime (~0.55s) */
export function playShopActivate() {
  try {
    tone({ freq: 392, at: 0, dur: 0.22, type: 'sine', vol: 0.028, attack: 0.012, release: 0.2 });

    tone({ freq: 523.25, at: 0.1, dur: 0.24, type: 'sine', vol: 0.032, attack: 0.01, release: 0.2 });
    tone({ freq: 659.25, at: 0.2, dur: 0.26, type: 'sine', vol: 0.03, attack: 0.01, release: 0.22 });

    tone({ freq: 783.99, at: 0.3, dur: 0.28, type: 'sine', vol: 0.026, attack: 0.012, release: 0.24 });
    tone({ freq: 987.77, at: 0.32, dur: 0.3, type: 'triangle', vol: 0.018, attack: 0.014, release: 0.26 });

    chord([523.25, 659.25, 783.99], { at: 0.38, dur: 0.38, vol: 0.018, type: 'sine' });
    tone({ freq: 1046.5, at: 0.4, dur: 0.32, type: 'sine', vol: 0.015, attack: 0.015, release: 0.28 });
  } catch {
    /* silent */
  }
}

/** Gaming hover — sharp HUD ping */
export function playGamingHover() {
  try {
    tone({ freq: 880, at: 0, dur: 0.024, type: 'square', vol: 0.038, attack: 0.001 });
    tone({ freq: 1320, at: 0.01, dur: 0.03, type: 'sawtooth', vol: 0.028, freqEnd: 1760 });
    noiseBurst({ at: 0, dur: 0.008, vol: 0.018, freq: 4000, type: 'highpass' });
  } catch {
    /* silent */
  }
}

/** Shop hover — whisper tick */
export function playShopHover() {
  try {
    tone({ freq: 740, at: 0, dur: 0.045, type: 'sine', vol: 0.014, attack: 0.008, release: 0.035 });
    tone({ freq: 988, at: 0.018, dur: 0.05, type: 'sine', vol: 0.01, attack: 0.01, release: 0.04 });
  } catch {
    /* silent */
  }
}

/** Gaming button tap — punchy arcade hit */
export function playGamingTap() {
  try {
    tone({ freq: 680, at: 0, dur: 0.02, type: 'square', vol: 0.05, attack: 0.001 });
    noiseBurst({ at: 0, dur: 0.014, vol: 0.03, freq: 3200, type: 'highpass' });
    tone({ freq: 110, at: 0.006, dur: 0.05, type: 'sine', vol: 0.045, attack: 0.001 });
  } catch {
    /* silent */
  }
}

/** Shop button tap — feather-light pop */
export function playShopTap() {
  try {
    tone({ freq: 622, at: 0, dur: 0.04, type: 'sine', vol: 0.016, attack: 0.008, release: 0.032 });
    tone({ freq: 830, at: 0.012, dur: 0.045, type: 'sine', vol: 0.012, attack: 0.01, release: 0.035 });
  } catch {
    /* silent */
  }
}

export function playProductJump(index = 0) {
  try {
    const base = 440 + index * 35;
    tone({ freq: base, at: 0, dur: 0.05, type: 'square', vol: 0.055 });
    tone({ freq: base * 2, at: 0.025, dur: 0.06, type: 'sine', vol: 0.038 });
  } catch {
    /* silent */
  }
}

/** Generic UI tap — kept for other buttons */
export function playButtonTap() {
  try {
    tone({ freq: 620, at: 0, dur: 0.025, type: 'sine', vol: 0.034 });
    noiseBurst({ at: 0, dur: 0.012, vol: 0.02, freq: 3800, type: 'highpass' });
  } catch {
    /* silent */
  }
}

export function playActionTap() {
  try {
    tone({ freq: 520, at: 0, dur: 0.035, type: 'sine', vol: 0.04 });
    tone({ freq: 780, at: 0.025, dur: 0.045, type: 'sine', vol: 0.032 });
  } catch {
    /* silent */
  }
}
