"use client";

import type { Rarity } from "./cards";

/* ------------------------------------------------------------------ */
/*  Synthesised sound effects (Web Audio, no asset files)              */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "cinedeck:muted";

let ctx: AudioContext | null = null;
/** Dry mix, through a compressor so stacked layers stay punchy without clipping */
let master: GainNode | null = null;
/** Send to a generated reverb: bells and pads ring out instead of stopping dead */
let reverb: GainNode | null = null;
let muted = false;

if (typeof window !== "undefined") {
  try {
    muted = localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // Storage blocked: default to sound on
  }
}

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  try {
    localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    // ignore
  }
}

/** Decaying stereo noise: a cheap but convincing room impulse. */
function impulse(c: AudioContext, seconds: number, decay: number): AudioBuffer {
  const len = Math.ceil(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
  }
  return buf;
}

function audio(): AudioContext | null {
  if (muted || typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;
    comp.connect(ctx.destination);

    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(comp);

    const conv = ctx.createConvolver();
    conv.buffer = impulse(ctx, 2.4, 3);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    conv.connect(wet).connect(comp);
    reverb = ctx.createGain();
    reverb.connect(conv);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Routes a voice to the dry mix and, by `wet` (0..1), to the reverb. */
function out(c: AudioContext, node: AudioNode, wet: number) {
  node.connect(master!);
  if (wet > 0 && reverb) {
    const send = c.createGain();
    send.gain.value = wet;
    node.connect(send).connect(reverb);
  }
}

interface ToneOpts {
  at?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
  attack?: number;
  /** Detuned copies (cents apart) for a fuller sound */
  voices?: number;
  wet?: number;
  /** Lowpass cutoff, tames saw/square harshness */
  cutoff?: number;
}

function tone(freq: number, { at = 0, dur = 0.3, type = "sine", gain = 0.2, slideTo, attack = 0.008, voices = 1, wet = 0.2, cutoff }: ToneOpts = {}) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain / Math.sqrt(voices), t + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

  let head: AudioNode = env;
  if (cutoff) {
    const lp = c.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = cutoff;
    env.connect(lp);
    head = lp;
  }
  out(c, head, wet);

  for (let v = 0; v < voices; v++) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.detune.value = voices > 1 ? (v - (voices - 1) / 2) * 12 : 0;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    osc.connect(env);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }
}

/** Glassy bell: a sine plus inharmonic partials that die faster than the fundamental. */
function bell(freq: number, { at = 0, dur = 1.2, gain = 0.12, wet = 0.5 }: { at?: number; dur?: number; gain?: number; wet?: number } = {}) {
  tone(freq, { at, dur, gain, wet, attack: 0.003 });
  tone(freq * 2.76, { at, dur: dur * 0.45, gain: gain * 0.35, wet, attack: 0.002 });
  tone(freq * 5.4, { at, dur: dur * 0.2, gain: gain * 0.18, wet, attack: 0.001 });
}

interface NoiseOpts {
  at?: number;
  dur?: number;
  gain?: number;
  from?: number;
  to?: number;
  q?: number;
  type?: BiquadFilterType;
  wet?: number;
  /** Seconds to swell in; > 0 makes a riser instead of a hit */
  attack?: number;
}

/** Filtered white noise sweep: tearing foil, whooshes, shimmer. */
function noise({ at = 0, dur = 0.3, gain = 0.2, from = 800, to = 4000, q = 1, type = "bandpass", wet = 0.1, attack = 0.01 }: NoiseOpts = {}) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + Math.min(attack, dur * 0.9));
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(env);
  out(c, env, wet);
  src.start(t);
}

let paperBuf: AudioBuffer | null = null;

/**
 * Two seconds of "paper": noise chopped into tiny grains of random loudness. Played through
 * a highpass it crackles like fibres snapping instead of hissing like plain noise.
 */
function paperBuffer(c: AudioContext): AudioBuffer {
  if (paperBuf) return paperBuf;
  const len = c.sampleRate * 2;
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  let i = 0;
  while (i < len) {
    const grain = Math.floor(c.sampleRate * (0.002 + Math.random() * 0.014));
    const amp = Math.random() < 0.25 ? 0.7 + Math.random() * 0.3 : 0.08 + Math.random() * 0.25;
    for (let j = 0; j < grain && i < len; j++, i++) d[i] = (Math.random() * 2 - 1) * amp * (1 - (j / grain) * 0.7);
  }
  paperBuf = buf;
  return buf;
}

interface PaperOpts {
  at?: number;
  dur?: number;
  gain?: number;
  /** Highpass cutoff: higher = thinner, crispier paper */
  hp?: number;
  /** Bandpass sweep */
  from?: number;
  to?: number;
  rate?: number;
  wet?: number;
}

/** One-shot paper sound: rips, card slides, flips. */
function paper({ at = 0, dur = 0.2, gain = 0.3, hp = 700, from = 3000, to = 2000, rate = 1, wet = 0.08 }: PaperOpts = {}) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = paperBuffer(c);
  src.playbackRate.value = rate;
  const high = c.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = hp;
  const band = c.createBiquadFilter();
  band.type = "peaking";
  band.gain.value = 8;
  band.Q.value = 0.8;
  band.frequency.setValueAtTime(from, t);
  band.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.006);
  env.gain.setValueAtTime(gain, t + dur * 0.6);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(high).connect(band).connect(env);
  out(c, env, wet);
  src.start(t, Math.random() * 1.5, dur + 0.05);
}

export interface TearingSound {
  /** `speed` 0 (still) .. 1+ (fast swipe) drives loudness and brightness */
  update: (speed: number) => void;
  stop: () => void;
}

/** Continuous paper tearing that follows the player's swipe. */
function tearing(): TearingSound {
  const c = audio();
  if (!c || !master) return { update: () => {}, stop: () => {} };
  const src = c.createBufferSource();
  src.buffer = paperBuffer(c);
  src.loop = true;
  const high = c.createBiquadFilter();
  high.type = "highpass";
  high.frequency.value = 900;
  const band = c.createBiquadFilter();
  band.type = "peaking";
  band.gain.value = 10;
  band.Q.value = 1;
  band.frequency.value = 2000;
  const env = c.createGain();
  env.gain.value = 0.0001;
  src.connect(high).connect(band).connect(env);
  out(c, env, 0.06);
  src.start(c.currentTime, Math.random() * 1.5);
  let stopped = false;
  return {
    update(speed) {
      if (stopped) return;
      const v = Math.min(1.4, Math.max(0, speed));
      const now = c.currentTime;
      env.gain.setTargetAtTime(0.02 + v * 0.38, now, 0.025);
      band.frequency.setTargetAtTime(1500 + v * 3500, now, 0.04);
      src.playbackRate.setTargetAtTime(0.75 + v * 0.5, now, 0.04);
    },
    stop() {
      if (stopped) return;
      stopped = true;
      env.gain.setTargetAtTime(0.0001, c.currentTime, 0.03);
      src.stop(c.currentTime + 0.2);
    },
  };
}

/** Deep body hit felt more than heard. */
function thump(at = 0, gain = 0.5, from = 150) {
  tone(from, { at, dur: 0.35, gain, slideTo: 42, attack: 0.002, wet: 0.05 });
  noise({ at, dur: 0.06, gain: gain * 0.3, from: 2500, to: 600, q: 0.7, wet: 0 });
}

// C major pentatonic, bright and never dissonant whatever notes get stacked
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093];

const REVEAL: Record<Rarity, () => void> = {
  Common: () => {
    tone(392, { dur: 0.18, type: "triangle", gain: 0.12, wet: 0.15 });
    tone(784, { dur: 0.08, gain: 0.05, wet: 0.1 });
  },
  Rare: () => {
    bell(659.25, { gain: 0.13, dur: 1 });
    bell(987.77, { at: 0.09, gain: 0.12, dur: 1.2 });
    noise({ at: 0.05, dur: 0.6, gain: 0.04, from: 7000, to: 10000, q: 3, wet: 0.5 });
  },
  Legendary: () => {
    thump(0, 0.45);
    // Warm pad under a rising bell arpeggio
    [261.63, 329.63, 392].forEach((f) => tone(f, { dur: 1.8, type: "sawtooth", gain: 0.03, voices: 3, attack: 0.15, cutoff: 1400, wet: 0.6 }));
    [0, 2, 4, 5, 7].forEach((n, i) => bell(PENTA[n], { at: 0.08 + i * 0.075, gain: 0.11, dur: 1.4 }));
    noise({ at: 0.35, dur: 1.2, gain: 0.05, from: 6000, to: 11000, q: 4, wet: 0.7 });
  },
  Mythic: () => {
    thump(0, 0.7, 120);
    tone(55, { dur: 2.2, gain: 0.3, attack: 0.05, wet: 0.2 });
    noise({ dur: 0.8, gain: 0.14, from: 300, to: 60, q: 0.7, wet: 0.4 });
    // Big wide chord
    [261.63, 329.63, 392, 523.25, 659.25].forEach((f) =>
      tone(f, { at: 0.05, dur: 2.6, type: "sawtooth", gain: 0.03, voices: 3, attack: 0.25, cutoff: 1800, wet: 0.7 }),
    );
    // Sparkle cascade up the scale, then a twinkling tail
    PENTA.forEach((f, i) => bell(f, { at: 0.12 + i * 0.055, gain: 0.08, dur: 1.2 }));
    for (let i = 0; i < 10; i++) bell(PENTA[5 + Math.floor(Math.random() * 6)] * 2, { at: 0.8 + i * 0.09, gain: 0.03, dur: 0.6 });
  },
};

export const sfx = {
  /** Pack jiggling while the server answers */
  shake: () => {
    for (let i = 0; i < 3; i++) noise({ at: i * 0.15, dur: 0.1, gain: 0.05, from: 500, to: 1400, q: 1.2 });
  },
  /** Live tearing while the player swipes across the pack */
  tearing,
  /** The pack gives way: last rip, halves flying apart, light bursting out */
  rip: () => {
    paper({ dur: 0.28, gain: 0.55, hp: 1200, from: 5000, to: 1800, rate: 1.3 });
    paper({ at: 0.05, dur: 0.18, gain: 0.3, hp: 600, from: 1500, to: 900, rate: 0.8 });
    thump(0.04, 0.4, 130);
    noise({ at: 0.06, dur: 0.6, gain: 0.07, from: 300, to: 4000, q: 0.5, type: "lowpass", wet: 0.4 });
    [1567.98, 2093, 2637].forEach((f, i) => bell(f, { at: 0.12 + i * 0.05, gain: 0.035, dur: 0.8, wet: 0.6 }));
  },
  /** Kept for the old strip tear; same as a quick rip */
  tear: () => sfx.rip(),
  /** Card sliding out onto the table */
  deal: () => paper({ dur: 0.08, gain: 0.12, hp: 1800, from: 5000, to: 2500, rate: 1.4 }),
  /** Card flip; `step` (cards already flipped) raises the pitch so a pack builds up */
  flip: (step = 0) => {
    paper({ dur: 0.1, gain: 0.22, hp: 1000, from: 4000, to: 1500, rate: 1.2 });
    tone(PENTA[Math.min(step, PENTA.length - 1)] / 2, { at: 0.03, dur: 0.14, type: "triangle", gain: 0.07, wet: 0.2 });
  },
  /** Roulette tile passing under the marker */
  tick: () => tone(2400, { dur: 0.035, type: "square", gain: 0.05, cutoff: 4000, wet: 0.05 }),
  /** Light tick when hovering a face-down card */
  hover: () => tone(1800, { dur: 0.04, gain: 0.025, wet: 0 }),
  /** Suspense before a big reveal: swelling noise and a rising tone */
  riser: (seconds: number) => {
    noise({ dur: seconds, gain: 0.12, from: 300, to: 6000, q: 1.5, attack: seconds * 0.9, wet: 0.3 });
    tone(110, { dur: seconds, type: "sawtooth", gain: 0.035, slideTo: 440, attack: seconds * 0.85, cutoff: 1200, voices: 2, wet: 0.2 });
  },
  coin: () => {
    bell(1567.98, { gain: 0.08, dur: 0.5, wet: 0.3 });
    bell(2093, { at: 0.07, gain: 0.08, dur: 0.7, wet: 0.3 });
  },
  reveal: (rarity: Rarity) => REVEAL[rarity](),
};
