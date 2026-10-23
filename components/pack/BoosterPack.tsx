"use client";

import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
  type TargetAndTransition,
} from "framer-motion";
import { Hand } from "lucide-react";
import type { Rarity } from "@/lib/cards";
import { packChanceAtLeast, type PackDef } from "@/lib/packs";
import { sfx, type TearingSound } from "@/lib/sfx";
import { LogoMark } from "../Logo";
import { ParticleBurst } from "./RarityEffects";
import { CRINKLE, IRIDESCENT, PACK_THEMES } from "./pack-theme";
import { RARITY_FX } from "./rarity-theme";


type Mode = "idle" | "shaking" | "ready";

/** Pack coordinates: x 0..100 across, y 0..H down (the pack is 3:5). */
type Point = { x: number; y: number };
const H = 166;
/** Share of the width a swipe must cross to cut the pack */
const CUT_AT = 0.85;
/** Shorter swipes still cut when released past this */
const CUT_ON_RELEASE = 0.55;
/** A cut above this height only takes the top off; lower, the pack splits in two */
const TOP_CUT = H * 0.3;

interface Line {
  y0: number;
  y1: number;
}

/** Straight line through where the swipe entered and left, extended across the pack. */
function fitLine(points: Point[]): Line {
  const left = points.reduce((a, p) => (p.x < a.x ? p : a));
  const right = points.reduce((a, p) => (p.x > a.x ? p : a));
  const slope = right.x - left.x > 1 ? Math.max(-0.6, Math.min(0.6, (right.y - left.y) / (right.x - left.x))) : 0;
  const clamp = (y: number) => Math.min(H * 0.88, Math.max(H * 0.1, y));
  return { y0: clamp(left.y - slope * left.x), y1: clamp(left.y + slope * (100 - left.x)) };
}

/** The line as polygon points, jagged like torn foil when `jag` is set. */
function edgeOf(line: Line, jag: boolean): Point[] {
  const steps = 18;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const x = (i / steps) * 100;
    const j = !jag || i === 0 || i === steps ? 0 : (i % 2 ? 1 : -1) * (1.2 + Math.random() * 2.2);
    return { x, y: line.y0 + ((line.y1 - line.y0) * x) / 100 + j };
  });
}

const pct = (p: Point) => `${p.x}% ${(p.y / H) * 100}%`;

function clips(edge: Point[]) {
  const e = edge.map(pct);
  return {
    top: `polygon(0% 0%, 100% 0%, ${[...e].reverse().join(", ")})`,
    bottom: `polygon(${e.join(", ")}, 100% 100%, 0% 100%)`,
  };
}

/** Crimped, ridged metal seal across the top or bottom of the wrapper. */
function Seal({ side, color }: { side: "top" | "bottom"; color: string }) {
  return (
    <div
      className={`absolute inset-x-0 h-[8%] ${side === "top" ? "top-0" : "bottom-0"}`}
      style={{
        background: `repeating-linear-gradient(90deg, rgba(255,255,255,0.35) 0 1px, rgba(0,0,0,0.25) 1px 3px), linear-gradient(${side === "top" ? 180 : 0}deg, ${color}, color-mix(in srgb, ${color} 55%, black))`,
        boxShadow: side === "top" ? "inset 0 -2px 3px rgba(0,0,0,0.45)" : "inset 0 2px 3px rgba(0,0,0,0.45)",
      }}
    />
  );
}

/** Serrated top and bottom edges of the sealed wrapper. */
const SERRATED = (() => {
  const teeth = 16;
  const depth = 1.4;
  const top = Array.from({ length: teeth * 2 + 1 }, (_, i) => `${(i / (teeth * 2)) * 100}% ${i % 2 ? depth : 0}%`);
  const bottom = Array.from({ length: teeth * 2 + 1 }, (_, i) => `${100 - (i / (teeth * 2)) * 100}% ${i % 2 ? 100 - depth : 100}%`);
  return `polygon(${[...top, ...bottom].join(", ")})`;
})();

/** Printed foil wrapper: cover poster washed in the pack's colour, logo, name and odds. */
function PackFace({ pack, cover, holo }: { pack: PackDef; cover?: string | null; holo: MotionValue<string> }) {
  const t = PACK_THEMES[pack.type];
  const mythic = packChanceAtLeast(pack, "Mythic");
  return (
    <div className="absolute inset-0 overflow-hidden" style={{ clipPath: SERRATED, background: t.tint }}>
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover object-top" style={{ filter: "saturate(0.85) contrast(1.08)" }} />
      )}
      {/* Colour wash: strong at the ends where the text sits, clear over the face */}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(180deg, ${t.tint} 4%, ${t.tint}55 28%, transparent 46%, transparent 58%, ${t.tint}cc 80%, ${t.tint} 96%)` }}
      />
      {/* Iridescent foil and crinkle */}
      <div
        className="absolute inset-0 opacity-30 mix-blend-color-dodge"
        style={{ background: IRIDESCENT }}
      />
      <div
        className="absolute inset-0 opacity-[0.18] mix-blend-overlay"
        style={{ backgroundImage: CRINKLE }}
      />
      {/* Pillow shading: the wrapper bulges, edges fall into shadow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 75% 60% at 45% 42%, rgba(255,255,255,0.12), transparent 60%), linear-gradient(90deg, rgba(255,255,255,0.22), transparent 9%, transparent 88%, rgba(0,0,0,0.45))",
        }}
      />
      {/* Specular glare following the pointer */}
      <motion.div aria-hidden className="pointer-events-none absolute inset-0 mix-blend-overlay" style={{ background: holo }} />

      <Seal side="top" color={t.seal} />
      <Seal side="bottom" color={t.seal} />

      <div className="relative flex h-full flex-col justify-between px-4 pb-[13%] pt-[12%]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <LogoMark className="h-5 w-5" />
            <span className="font-display text-sm font-extrabold tracking-[-0.04em] text-white drop-shadow">cinedeck</span>
          </span>
          <span className="rounded-full bg-black/45 px-1.5 py-0.5 text-[8px] font-bold tracking-wider text-white/80 ring-1 ring-white/20">18+</span>
        </div>
        <div>
          <span className="text-[9px] font-semibold uppercase tracking-[0.25em]" style={{ color: t.seal }}>
            {t.label}
          </span>
          <p className="font-display text-[1.65rem] font-extrabold uppercase leading-[0.9] tracking-[-0.03em] text-white drop-shadow-[0_2px_6px_rgba(0,0,0,0.7)]">
            {pack.name}
          </p>
          <p className="mt-1.5 flex items-center gap-2 text-[9px] font-semibold uppercase tracking-wider text-white/75">
            <span>{pack.slots.length} cards</span>
            <span className="h-1 w-1 rounded-full bg-white/50" />
            <span>{mythic.toFixed(1)}% Mythic</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * A sealed booster with real depth. In "ready" mode the player slices it open by swiping
 * across it, Fruit Ninja style: the whole screen is the swipe zone, so a cut can start far
 * from the pack. The foil opens along the swipe as it
 * goes, then gives way where it was cut. A cut near the top flips the top off; lower down,
 * the pack splits in two. A click or Enter cuts it in one go.
 */
export function BoosterPack({
  pack,
  mode,
  hint,
  cover,
  onTorn,
}: {
  pack: PackDef;
  mode: Mode;
  hint?: Rarity;
  /** Poster printed on the wrapper */
  cover?: string | null;
  onTorn?: () => void;
}) {
  const reduced = useReducedMotion();
  const box = useRef<HTMLDivElement>(null);
  const [trail, setTrail] = useState<Point[]>([]);
  const [cut, setCut] = useState<{ line: Line; edge: Point[]; dir: 1 | -1 } | null>(null);
  const drag = useRef<{ points: Point[]; t: number; x: number; sound: TearingSound } | null>(null);
  const glow = hint ? RARITY_FX[hint].glow : "rgba(247,45,100,0.35)";
  const sparkRarity: Rarity = hint && hint !== "Common" ? hint : "Rare";

  // Tilts toward the pointer; the glare follows it
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 170, damping: 16 };
  const tiltY = useSpring(useTransform(px, [0, 1], [-22, 22]), spring);
  const tiltX = useSpring(useTransform(py, [0, 1], [16, -16]), spring);
  const holoX = useTransform(px, (v) => `${v * 100}%`);
  const holoY = useTransform(py, (v) => `${v * 100}%`);
  const holo = useMotionTemplate`radial-gradient(circle at ${holoX} ${holoY}, rgba(255,255,255,0.55), rgba(255,255,255,0.12) 22%, transparent 50%)`;

  function toPack(e: React.PointerEvent): Point | null {
    const r = box.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: ((e.clientX - r.left) / r.width) * 100, y: ((e.clientY - r.top) / r.height) * H };
  }

  /** Part of the pack's width the swipe has crossed (outside the pack doesn't count). */
  function span(points: Point[]) {
    const xs = points.map((q) => Math.min(100, Math.max(0, q.x)));
    return (Math.max(...xs) - Math.min(...xs)) / 100;
  }

  function finish(points: Point[]) {
    if (cut) return;
    const first = points[0];
    const last = points[points.length - 1];
    drag.current?.sound.stop();
    drag.current = null;
    setTrail([]);
    const line = fitLine(points);
    setCut({ line, edge: edgeOf(line, true), dir: last.x >= first.x ? 1 : -1 });
    px.set(0.5);
    py.set(0.5);
    sfx.rip();
    // Cards deal while the pieces are still flying, so nothing lingers on screen
    setTimeout(() => onTorn?.(), 420);
  }

  /** Click, tap or keyboard: one quick slice a little below the top seal. */
  function autoCut() {
    if (mode !== "ready" || cut) return;
    const y = H * (0.2 + Math.random() * 0.06);
    finish([
      { x: -5, y },
      { x: 105, y: y + (Math.random() - 0.5) * 6 },
    ]);
  }

  function onDown(e: React.PointerEvent<HTMLDivElement>) {
    if (mode !== "ready" || cut) return;
    const p = toPack(e);
    if (!p) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { points: [p], t: performance.now(), x: e.clientX, sound: sfx.tearing() };
    setTrail([p]);
  }

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (d) {
      const p = toPack(e);
      if (!p) return;
      const now = performance.now();
      const speed = Math.abs(e.clientX - d.x) / Math.max(1, now - d.t);
      d.t = now;
      d.x = e.clientX;
      // Only tears while the blade is over the pack
      const inside = p.x >= 0 && p.x <= 100 && p.y >= 0 && p.y <= H;
      d.sound.update(inside ? speed / 1.2 : 0);
      d.points.push(p);
      if (d.points.length > 90) d.points.splice(1, 1);
      setTrail([...d.points]);
      if (span(d.points) >= CUT_AT) finish(d.points);
      return;
    }
    if (reduced || cut || e.pointerType !== "mouse" || !box.current) return;
    const r = box.current.getBoundingClientRect();
    px.set(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)));
    py.set(Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
  }

  function onUp() {
    const d = drag.current;
    if (!d) return;
    const s = span(d.points);
    if (s >= CUT_ON_RELEASE) return finish(d.points);
    d.sound.stop();
    drag.current = null;
    setTrail([]);
    // Barely moved: treat it as a click
    if (s < 0.04 && Math.abs(d.points[d.points.length - 1].y - d.points[0].y) < 6) autoCut();
  }

  function onLeave() {
    if (drag.current) return;
    px.set(0.5);
    py.set(0.5);
  }

  // Live opening while swiping: the foil parts along the line, the top peels from the start side
  const progress = trail.length > 1 ? span(trail) : 0;
  const live = useMemo(() => {
    if (cut || progress < 0.08) return null;
    const line = fitLine(trail);
    const dir = trail[trail.length - 1].x >= trail[0].x ? 1 : -1;
    return { line, clip: clips(edgeOf(line, false)), dir };
  }, [cut, progress, trail]);

  const done = useMemo(() => (cut ? { ...clips(cut.edge), mid: (cut.line.y0 + cut.line.y1) / 2 } : null), [cut]);
  const topOnly = done != null && done.mid < TOP_CUT;

  let bodyAnim: TargetAndTransition = {};
  if (cut) {
    bodyAnim = { x: [0, -5, 4, -2, 0], y: 0, rotate: 0, transition: { duration: 0.3 } };
  } else if (mode === "idle" && !reduced) {
    bodyAnim = { y: [0, -6, 0], transition: { duration: 3.4, repeat: Infinity, ease: [0.45, 0, 0.55, 1] } };
  } else if (mode === "shaking" && !reduced) {
    bodyAnim = { rotate: [0, -4, 4, -3, 3, 0], y: [0, -4, 0], transition: { duration: 0.45, repeat: Infinity } };
  } else if (mode === "ready" && !reduced && trail.length === 0) {
    const intense = hint === "Mythic" || hint === "Legendary";
    bodyAnim = intense
      ? { y: [0, -10, 0], rotate: [0, -2, 2, -1, 0], transition: { duration: 1.2, repeat: Infinity, ease: [0.45, 0, 0.55, 1] } }
      : { y: [0, -10, 0], transition: { duration: 2.6, repeat: Infinity, ease: [0.45, 0, 0.55, 1] } };
  }

  const ready = mode === "ready" && !cut;
  const lineAngle = (l: Line) => (Math.atan2(((l.y1 - l.y0) / H) * 1.66, 1) * 180) / Math.PI;

  return (
    <div className="flex flex-col items-center">
      {/* Ready to cut: the whole screen catches the swipe (in a portal, so no transformed parent can trap it) */}
      {ready &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            aria-hidden
            className="fixed inset-0 z-30 cursor-crosshair touch-none"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onPointerLeave={onLeave}
          />,
          document.body,
        )}
      <div className="relative py-6 [perspective:1000px]" onPointerMove={ready ? undefined : onMove} onPointerLeave={onLeave}>
        <motion.div
          ref={box}
          role={ready ? "button" : undefined}
          tabIndex={ready ? 0 : undefined}
          aria-label={ready ? "Cut the pack open" : undefined}
          onKeyDown={(e) => {
            if (e.key !== "Enter" && e.key !== " ") return;
            e.preventDefault();
            autoCut();
          }}
          className="relative aspect-[3/5] w-40 select-none sm:w-48"
          animate={bodyAnim}
          style={{ rotateX: tiltX, rotateY: tiltY, transformStyle: "preserve-3d" }}
          whileHover={mode === "idle" ? { scale: 1.04 } : undefined}
        >
          {/* Thickness, floor shadow and glow: gone the moment it's cut, only the pieces remain */}
          {!cut && (
            <>
              <div
                aria-hidden
                className="absolute inset-[1.5%] rounded-[6px]"
                style={{ transform: "translateZ(-9px)", background: `linear-gradient(135deg, ${PACK_THEMES[pack.type].seal}, #0a0a0a 70%)` }}
              />
              <div
                aria-hidden
                className="absolute -bottom-6 left-1/2 h-6 w-[80%] -translate-x-1/2 rounded-[50%] bg-black/70 blur-md"
                style={{ transform: "translateZ(-20px)" }}
              />
              <div
                aria-hidden
                className="absolute -inset-4 rounded-3xl blur-2xl transition-opacity duration-700"
                style={{ background: glow, opacity: mode === "ready" ? 0.55 : 0.18, transform: "translateZ(-30px)" }}
              />
            </>
          )}

          {!done && !live && <PackFace pack={pack} cover={cover} holo={holo} />}

          {/* Being cut: the top peels open from where the blade started */}
          {live && (
            <>
              <div className="absolute inset-0" style={{ clipPath: live.clip.bottom }}>
                <PackFace pack={pack} cover={cover} holo={holo} />
              </div>
              <div
                aria-hidden
                className="pointer-events-none absolute left-1/2 h-[3px] w-[110%] bg-white"
                style={{
                  top: `${((live.line.y0 + live.line.y1) / 2 / H) * 100}%`,
                  transform: `translate(-50%, -50%) rotate(${lineAngle(live.line)}deg) scaleX(${progress})`,
                  transformOrigin: live.dir === 1 ? "0% 50%" : "100% 50%",
                  boxShadow: `0 0 18px 6px ${glow}`,
                }}
              />
              <div
                className="absolute inset-0"
                style={{
                  clipPath: live.clip.top,
                  transformOrigin: `${live.dir === 1 ? 100 : 0}% ${((live.line.y0 + live.line.y1) / 2 / H) * 100}%`,
                  transform: `rotate(${-live.dir * progress * 7}deg) translateY(${-progress * 6}px)`,
                  transition: "transform 120ms cubic-bezier(0.32, 0.72, 0, 1)",
                }}
              >
                <PackFace pack={pack} cover={cover} holo={holo} />
              </div>
            </>
          )}

          {/* Cut through: light pours out of the gap, the pieces fly */}
          {cut && done && (
            <>
              <motion.div
                aria-hidden
                className="pointer-events-none absolute left-1/2 h-1 w-[170%] rounded-full bg-white"
                style={{
                  top: `${(done.mid / H) * 100}%`,
                  x: "-50%",
                  y: "-50%",
                  rotate: lineAngle(cut.line),
                  boxShadow: `0 0 50px 24px ${glow}`,
                }}
                initial={{ scaleY: 1, opacity: 1 }}
                animate={{ scaleY: [1, 45, 100], opacity: [1, 1, 0] }}
                transition={{ duration: 0.85, ease: [0.32, 0.72, 0, 1] }}
              />
              <motion.div
                className="absolute inset-0"
                style={{ clipPath: done.top, transformOrigin: `${cut.dir === 1 ? 100 : 0}% ${(done.mid / H) * 100}%` }}
                animate={
                  topOnly
                    ? // Only the top came off: it flips away from where the cut started
                      { rotate: [-cut.dir * 7, -cut.dir * 28, -cut.dir * 110], y: [-6, -40, -230], x: [0, cut.dir * 20, cut.dir * 120], opacity: [1, 1, 0] }
                    : { rotate: [-cut.dir * 7, -cut.dir * 12, -cut.dir * 30], y: [-6, -26, -280], x: [0, -cut.dir * 8, -cut.dir * 70], opacity: [1, 1, 0] }
                }
                transition={{ duration: topOnly ? 0.8 : 0.95, times: [0, 0.2, 1], ease: [0.32, 0.72, 0, 1] }}
              >
                <PackFace pack={pack} cover={cover} holo={holo} />
              </motion.div>
              <motion.div
                className="absolute inset-0"
                style={{ clipPath: done.bottom }}
                animate={
                  topOnly
                    ? // The body stays a beat, then drops away so the cards rise out of it
                      { y: [0, 6, 6, 260], opacity: [1, 1, 1, 0] }
                    : { y: [0, 10, 330], x: [0, cut.dir * 4, cut.dir * 50], rotate: [0, cut.dir * 3, cut.dir * 18], opacity: [1, 1, 0] }
                }
                transition={{ duration: topOnly ? 1.1 : 1, times: topOnly ? [0, 0.15, 0.45, 1] : [0, 0.2, 1], ease: [0.32, 0.72, 0, 1] }}
              >
                <PackFace pack={pack} cover={cover} holo={holo} />
              </motion.div>
              {/* Sparks along the cut */}
              {[12, 50, 88].map((x) => (
                <div
                  key={x}
                  className="pointer-events-none absolute h-0 w-0"
                  style={{ left: `${x}%`, top: `${((cut.line.y0 + ((cut.line.y1 - cut.line.y0) * x) / 100) / H) * 100}%` }}
                >
                  <ParticleBurst rarity={sparkRarity} />
                </div>
              ))}
            </>
          )}

          {/* Blade trail */}
          <svg viewBox={`0 0 100 ${H}`} preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible">
            {trail.length > 1 && (
              <polyline
                points={trail.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke="white"
                strokeWidth={1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                style={{ filter: `drop-shadow(0 0 4px white) drop-shadow(0 0 12px ${glow})` }}
              />
            )}
          </svg>
        </motion.div>
      </div>

      {ready && (
        <motion.p
          className="mt-4 flex items-center gap-2 text-sm font-medium text-zinc-300"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          <Hand className="h-4 w-4" /> Swipe across the screen through the pack to cut it
        </motion.p>
      )}
    </div>
  );
}
