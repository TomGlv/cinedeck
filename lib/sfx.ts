"use client";

import type { Rarity } from "./cards";

/* ------------------------------------------------------------------ */
/*  Synthesised sound effects (Web Audio, no asset files)              */
/* ------------------------------------------------------------------ */

const STORAGE_KEY = "cinedeck:muted";

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
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

function audio(): AudioContext | null {
  if (muted || typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

interface ToneOpts {
  at?: number;
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  slideTo?: number;
}

function tone(freq: number, { at = 0, dur = 0.3, type = "sine", gain = 0.2, slideTo }: ToneOpts = {}) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const env = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.01);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(env).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

interface NoiseOpts {
  at?: number;
  dur?: number;
  gain?: number;
  from?: number;
  to?: number;
  q?: number;
}

/** Filtered white noise sweep: tearing foil, whooshes, shimmer. */
function noise({ at = 0, dur = 0.3, gain = 0.2, from = 800, to = 4000, q = 1 }: NoiseOpts = {}) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const buffer = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t);
  filter.frequency.exponentialRampToValueAtTime(to, t + dur);
  const env = c.createGain();
  env.gain.setValueAtTime(0.0001, t);
  env.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(env).connect(master);
  src.start(t);
}

const C_MAJOR = [523.25, 659.25, 783.99, 1046.5, 1318.5];

const REVEAL: Record<Rarity, () => void> = {
  Common: () => tone(660, { dur: 0.15, type: "triangle", gain: 0.1 }),
  Rare: () => {
    [659.25, 987.77].forEach((f, i) => tone(f, { at: i * 0.08, dur: 0.4, type: "triangle", gain: 0.14 }));
  },
  Legendary: () => {
    C_MAJOR.slice(0, 4).forEach((f, i) => tone(f, { at: i * 0.09, dur: 0.7, type: "triangle", gain: 0.14 }));
    noise({ at: 0.3, dur: 0.9, gain: 0.05, from: 6000, to: 9000, q: 4 });
  },
  Mythic: () => {
    tone(110, { dur: 1.3, gain: 0.35, slideTo: 40 });
    noise({ dur: 0.5, gain: 0.12, from: 200, to: 80, q: 0.8 });
    C_MAJOR.forEach((f, i) => {
      tone(f, { at: 0.15 + i * 0.07, dur: 1.5, type: "sawtooth", gain: 0.035 });
      tone(f * 2, { at: 0.15 + i * 0.07, dur: 1.0, gain: 0.05 });
    });
    for (let i = 0; i < 8; i++) {
      tone(2000 + Math.random() * 2500, { at: 0.7 + i * 0.07, dur: 0.25, gain: 0.04 });
    }
  },
};

export const sfx = {
  shake: () => noise({ dur: 0.12, gain: 0.04, from: 300, to: 700 }),
  tear: () => {
    noise({ dur: 0.45, gain: 0.35, from: 1200, to: 6000, q: 0.7 });
    tone(180, { dur: 0.25, type: "triangle", gain: 0.08, slideTo: 90 });
  },
  deal: () => noise({ dur: 0.1, gain: 0.06, from: 3000, to: 1500, q: 2 }),
  flip: () => noise({ dur: 0.14, gain: 0.15, from: 2000, to: 500, q: 1.5 }),
  coin: () => [1318.5, 1760].forEach((f, i) => tone(f, { at: i * 0.07, dur: 0.18, type: "square", gain: 0.04 })),
  reveal: (rarity: Rarity) => REVEAL[rarity](),
};
