"use client";

import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { CardData } from "@/lib/cards";
import type { PackType } from "@/lib/packs";
import { sfx } from "@/lib/sfx";
import { useCardInfo } from "../card-info";
import { MovieCard } from "../MovieCard";
import { CardBack } from "./CardBack";
import { LightRays, ParticleBurst, ShockRing } from "./RarityEffects";
import { RARITY_FX, revealTier } from "./rarity-theme";

export type PulledCard = CardData & { isNew: boolean };

/** A dealt card: face down until clicked, then flips with rarity effects. */
export function FlipCard({
  card,
  index,
  flipped,
  charging = false,
  pack,
  onFlip,
}: {
  card: PulledCard;
  /** Pack it came out of: the back is printed like it */
  pack?: PackType;
  index: number;
  flipped: boolean;
  /** Trembling and glowing just before a big reveal */
  charging?: boolean;
  onFlip: () => void;
}) {
  // A special print hits harder than its rarity alone
  const tier = revealTier(card);
  const big = tier === "Legendary" || tier === "Mythic";
  const showInfo = useCardInfo();
  const reduced = useReducedMotion();

  // Pointer-follow tilt with a glare spot, on both faces
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 220, damping: 18 };
  const tiltY = useSpring(useTransform(px, [0, 1], [-16, 16]), spring);
  const tiltX = useSpring(useTransform(py, [0, 1], [14, -14]), spring);
  const glareX = useTransform(px, (v) => `${v * 100}%`);
  const glareY = useTransform(py, (v) => `${v * 100}%`);
  const glare = useMotionTemplate`radial-gradient(circle at ${glareX} ${glareY}, rgba(255,255,255,0.35), transparent 55%)`;

  function onMove(e: React.PointerEvent<HTMLElement>) {
    if (reduced || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  }
  function onLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  const glow = RARITY_FX[tier].glow;

  return (
    <motion.div
      className="relative w-full"
      // Dealt out of the pack, fanned then settling
      initial={{ opacity: 0, y: -220, scale: 0.3, rotate: (index - 2) * 14 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 16, delay: 0.15 + index * 0.12 }}
    >
      {flipped && <LightRays rarity={tier} />}

      {/* Charge-up aura, swelling until the flip */}
      {charging && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute -inset-6 rounded-[2rem] blur-2xl"
          style={{ background: tier === "Mythic" ? "conic-gradient(from 0deg, #fecdd3, #ef4444, #9f1239, #fb7185, #fecdd3)" : glow }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1.25, rotate: tier === "Mythic" ? 180 : 0 }}
          transition={{ duration: tier === "Mythic" ? 1.4 : 0.85, ease: "easeIn" }}
        />
      )}

      <motion.button
        type="button"
        // Once revealed, a click opens the card's details
        onClick={flipped ? () => showInfo(card) : onFlip}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        onHoverStart={() => !flipped && !charging && sfx.hover()}
        aria-label={flipped ? `${card.title}, show details` : "Reveal card"}
        className="relative block aspect-[2/3] w-full [perspective:1200px]"
        whileHover={flipped || charging ? undefined : { y: -10, scale: 1.04 }}
        whileTap={flipped || charging ? undefined : { scale: 0.97 }}
        animate={
          charging
            ? { x: [0, -3, 3, -4, 4, -2, 2, 0], y: -14, scale: 1.08 }
            : flipped && big
              ? { scale: [1.08, 1.2, 1], x: 0, y: 0 }
              : { x: 0, y: 0, scale: 1 }
        }
        transition={
          charging
            ? { x: { duration: 0.18, repeat: Infinity }, y: { duration: 0.3 }, scale: { duration: 0.3 } }
            : { duration: 0.6, delay: flipped && big ? 0.2 : 0 }
        }
      >
        <motion.div className="relative h-full w-full" style={{ rotateX: tiltX, rotateY: tiltY, transformStyle: "preserve-3d" }}>
          <motion.div
            className="relative h-full w-full"
            style={{ transformStyle: "preserve-3d" }}
            initial={false}
            animate={{ rotateY: flipped ? 180 : 0 }}
            transition={{ type: "spring", stiffness: 110, damping: 13 }}
          >
            <div className="absolute inset-0 [backface-visibility:hidden]">
              <CardBack hint={card.rarity} pack={pack} />
            </div>
            <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
              <MovieCard card={card} />
            </div>
          </motion.div>
          <motion.div aria-hidden className="pointer-events-none absolute inset-0 z-10 rounded-2xl mix-blend-overlay" style={{ background: glare }} />
        </motion.div>

        {/* White flash on the card face right as it turns */}
        {flipped && tier !== "Common" && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 rounded-2xl bg-white"
            initial={{ opacity: 0.9 }}
            animate={{ opacity: 0 }}
            transition={{ duration: big ? 0.7 : 0.4, delay: 0.12 }}
          />
        )}

        {flipped && tier !== "Common" && (
          <>
            <ShockRing rarity={tier} />
            <ParticleBurst rarity={tier} />
          </>
        )}
      </motion.button>

      {flipped && card.isNew && (
        <motion.span
          className="absolute -top-3 left-1/2 z-40 flex items-center gap-1 rounded-full bg-emerald-400 px-2.5 py-0.5 text-[10px] font-black tracking-wider text-black shadow-lg shadow-emerald-500/40"
          style={{ x: "-50%" }}
          initial={{ scale: 0, y: 10 }}
          animate={{ scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 12, delay: 0.45 }}
        >
          <Sparkles className="h-3 w-3" /> NEW
        </motion.span>
      )}
    </motion.div>
  );
}
