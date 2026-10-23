"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import type { CardData } from "@/lib/cards";
import { useCardInfo } from "../card-info";
import { MovieCard } from "../MovieCard";
import { CardBack } from "./CardBack";
import { LightRays, ParticleBurst, ShockRing } from "./RarityEffects";
import { revealTier } from "./rarity-theme";

export type PulledCard = CardData & { isNew: boolean };

/** A dealt card: face down until clicked, then flips with rarity effects. */
export function FlipCard({
  card,
  index,
  flipped,
  onFlip,
}: {
  card: PulledCard;
  index: number;
  flipped: boolean;
  onFlip: () => void;
}) {
  // A special print hits harder than its rarity alone
  const tier = revealTier(card);
  const big = tier === "Legendary" || tier === "Mythic";
  const showInfo = useCardInfo();

  return (
    <motion.div
      className="relative w-full"
      // Dealt out of the pack, fanned then settling
      initial={{ opacity: 0, y: -220, scale: 0.3, rotate: (index - 2) * 14 }}
      animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 16, delay: 0.15 + index * 0.12 }}
    >
      {flipped && <LightRays rarity={tier} />}

      <motion.button
        type="button"
        // Once revealed, a click opens the card's details
        onClick={flipped ? () => showInfo(card) : onFlip}
        aria-label={flipped ? `${card.title}, show details` : "Reveal card"}
        className="relative block aspect-[2/3] w-full [perspective:1200px]"
        whileHover={flipped ? undefined : { y: -10, scale: 1.04 }}
        whileTap={flipped ? undefined : { scale: 0.97 }}
        animate={flipped && big ? { scale: [1, 1.15, 1] } : undefined}
        transition={{ duration: 0.6, delay: 0.25 }}
      >
        <motion.div
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d" }}
          initial={false}
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 14 }}
        >
          <div className="absolute inset-0 [backface-visibility:hidden]">
            <CardBack hint={card.rarity} />
          </div>
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <MovieCard card={card} />
          </div>
        </motion.div>

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
