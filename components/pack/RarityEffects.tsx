"use client";

import { useEffect, useMemo } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Star } from "lucide-react";
import type { Rarity } from "@/lib/cards";
import type { Finish } from "@/lib/finishes";
import { FINISH_FX, RARITY_FX, isSpecial } from "./rarity-theme";

/** One-shot particle explosion from the centre of its parent. */
export function ParticleBurst({ rarity }: { rarity: Rarity }) {
  const reduced = useReducedMotion();
  const fx = RARITY_FX[rarity];
  const count = reduced ? Math.floor(fx.particles / 3) : fx.particles;

  const particles = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const distance = 110 + Math.random() * (rarity === "Mythic" ? 260 : 170);
        return {
          x: Math.cos(angle) * distance,
          y: Math.sin(angle) * distance,
          size: 4 + Math.random() * (rarity === "Mythic" ? 10 : 7),
          color: fx.colors[i % fx.colors.length],
          delay: Math.random() * 0.15,
          duration: 0.8 + Math.random() * 0.7,
          star: rarity !== "Rare" && i % 4 === 0,
        };
      }),
    [count, fx.colors, rarity],
  );

  return (
    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
      {particles.map((p, i) =>
        p.star ? (
          <motion.span
            key={i}
            className="absolute"
            initial={{ x: 0, y: 0, scale: 0, rotate: 0, opacity: 1 }}
            animate={{ x: p.x, y: p.y, scale: [0, 1.4, 0.6], rotate: 180, opacity: [1, 1, 0] }}
            transition={{ duration: p.duration, delay: p.delay, ease: "easeOut" }}
          >
            <Star style={{ width: p.size * 2, height: p.size * 2, color: p.color, fill: p.color }} />
          </motion.span>
        ) : (
          <motion.span
            key={i}
            className="absolute rounded-full"
            style={{ width: p.size, height: p.size, background: p.color, boxShadow: `0 0 ${p.size * 2}px ${p.color}` }}
            initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
            animate={{ x: p.x, y: p.y, scale: 0, opacity: [1, 1, 0] }}
            transition={{ duration: p.duration, delay: p.delay, ease: [0.16, 1, 0.3, 1] }}
          />
        ),
      )}
    </div>
  );
}

/** Expanding ring(s) on reveal. */
export function ShockRing({ rarity }: { rarity: Rarity }) {
  const fx = RARITY_FX[rarity];
  const rings = rarity === "Mythic" ? 3 : rarity === "Legendary" ? 2 : 1;
  return (
    <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
      {Array.from({ length: rings }, (_, i) => (
        <motion.span
          key={i}
          className="absolute aspect-square w-full rounded-full border-4"
          style={{ borderColor: fx.colors[i % fx.colors.length], boxShadow: `0 0 30px ${fx.glow}` }}
          initial={{ scale: 0.2, opacity: 1 }}
          animate={{ scale: 2.2, opacity: 0 }}
          transition={{ duration: 0.9, delay: i * 0.15, ease: "easeOut" }}
        />
      ))}
    </div>
  );
}

/** Rotating god-rays behind Legendary / Mythic cards; stays while the card is shown. */
export function LightRays({ rarity }: { rarity: Rarity }) {
  const fx = RARITY_FX[rarity];
  const reduced = useReducedMotion();
  if (!fx.rays) return null;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-1/2 -z-10 aspect-square w-[220%] rounded-full blur-[2px]"
      style={{ x: "-50%", y: "-50%", background: fx.rays, maskImage: "radial-gradient(circle, black 20%, transparent 65%)", WebkitMaskImage: "radial-gradient(circle, black 20%, transparent 65%)" }}
      initial={{ opacity: 0, scale: 0.4 }}
      animate={{ opacity: 1, scale: 1, rotate: reduced ? 0 : 360 }}
      transition={{
        opacity: { duration: 0.5 },
        scale: { duration: 0.6, ease: "easeOut" },
        rotate: { duration: rarity === "Mythic" ? 12 : 20, repeat: Infinity, ease: "linear" },
      }}
    />
  );
}

export interface BigPull {
  rarity: Rarity;
  finish?: Finish;
  key: number;
}

/** Overlay title: the print's name wins, prefixed by the rarity when that's big too ("MYTHIC POLYCHROME!!"). */
function pullLabel(pull: BigPull): string {
  if (!isSpecial(pull.finish)) return RARITY_FX[pull.rarity].label;
  const prefix = pull.rarity === "Mythic" || pull.rarity === "Legendary" ? `${pull.rarity.toUpperCase()} ` : "";
  return prefix + FINISH_FX[pull.finish].label;
}

/** Full-screen flash + title for big pulls and special prints. Pointer-events none so play continues. */
export function RevealOverlay({ pull, onDone }: { pull: BigPull | null; onDone: () => void }) {
  const special = isSpecial(pull?.finish) ? FINISH_FX[pull!.finish as Exclude<Finish, "normal">] : null;
  const long = pull?.rarity === "Mythic" || pull?.finish === "polychrome" || pull?.finish === "negative";

  useEffect(() => {
    if (!pull) return;
    const id = setTimeout(onDone, long ? 2200 : 1400);
    return () => clearTimeout(id);
  }, [pull, onDone, long]);

  const mythic = long;

  return (
    <AnimatePresence>
      {pull && (
        <motion.div
          key={pull.key}
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center overflow-hidden"
          exit={{ opacity: 0, transition: { duration: 0.4 } }}
        >
          {mythic && (
            <motion.div
              className="absolute inset-0 bg-black/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: [0, 1, 1, 0] }}
              transition={{ duration: 2, times: [0, 0.1, 0.7, 1] }}
            />
          )}
          <motion.div
            className="absolute inset-0"
            style={{
              background: special
                ? special.flash
                : mythic
                  ? "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(217,70,239,0.55) 35%, rgba(103,232,249,0.2) 60%, transparent 80%)"
                  : "radial-gradient(circle, rgba(255,247,237,0.85) 0%, rgba(251,191,36,0.4) 40%, transparent 75%)",
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 1.5] }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
          <motion.h2
            className={`relative px-4 text-center text-5xl font-black italic sm:text-7xl ${
              special
                ? `bg-gradient-to-r ${special.text}`
                : mythic
                  ? "bg-gradient-to-r from-fuchsia-300 via-cyan-200 to-amber-200"
                  : "bg-gradient-to-r from-amber-100 via-amber-300 to-yellow-500"
            } bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]`}
            initial={{ scale: 2.6, opacity: 0, letterSpacing: "0.5em", filter: "blur(12px)" }}
            animate={{ scale: 1, opacity: 1, letterSpacing: "0.08em", filter: "blur(0px)" }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", stiffness: 180, damping: 14, delay: 0.1 }}
          >
            {pullLabel(pull)}
          </motion.h2>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
