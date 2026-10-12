// Radio static and squelch with Web Audio, synthesised: no files. Off by default.

let ctx = null;
let enabled = false;
let volume = 0.4;

export function setSound(on, vol = 0.4) { enabled = !!on; volume = vol; if (enabled && !ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { enabled = false; } } }

function noise(duration, gain, filterFreq = 1800, q = 0.8) {
  if (!enabled || !ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const len = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i / 90));
  const src = ctx.createBufferSource(); src.buffer = buf;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = filterFreq; f.Q.value = q;
  const g = ctx.createGain(); g.gain.value = 0;
  const t = ctx.currentTime;
  g.gain.linearRampToValueAtTime(gain * volume, t + 0.02);
  g.gain.setValueAtTime(gain * volume, t + duration - 0.05);
  g.gain.linearRampToValueAtTime(0, t + duration);
  src.connect(f); f.connect(g); g.connect(ctx.destination);
  src.start(); src.stop(t + duration + 0.05);
}

function tone(freq, duration, gain) {
  if (!enabled || !ctx) return;
  const o = ctx.createOscillator(); const g = ctx.createGain();
  o.type = 'square'; o.frequency.value = freq;
  const t = ctx.currentTime;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain * volume * 0.25, t + 0.01); g.gain.linearRampToValueAtTime(0, t + duration);
  o.connect(g); g.connect(ctx.destination); o.start(); o.stop(t + duration + 0.02);
}

/** A key-up: squelch tail and a burst of static. */
export function squelch() { tone(1200, 0.05, 0.6); noise(0.35, 0.35, 2200, 0.6); }
/** Incoming traffic: static under a voice. */
export function staticBurst(seconds = 0.8) { noise(seconds, 0.22, 1500, 0.5); }
/** Contact: a hard, short crack. */
export function crack() { noise(0.12, 0.9, 900, 0.3); setTimeout(() => noise(0.08, 0.6, 700, 0.3), 140); }
