"use client";

import { useState, type MouseEvent } from "react";
import { motion, useMotionTemplate, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Aperture, Clapperboard, Contrast, Crown, Flame, Gem, Rainbow, Sparkles, Star, Tv, Wand2 } from "lucide-react";
import type { CardData, MediaType, Rarity } from "@/lib/cards";
import { FINISHES, type Finish } from "@/lib/finishes";
import { getFranchise } from "@/lib/franchises";
import { useCardInfo } from "./card-info";

const RARITY_STYLES: Record<
  Rarity,
  { frame: string; glow: string; badge: string; icon: typeof Crown }
> = {
  // Ruby foil frame with a thin red halo
  Mythic: {
    frame: "from-rose-300 via-red-600 to-rose-900",
    glow: "shadow-[0_0_14px_1px_rgba(239,68,68,0.6)]",
    badge: "bg-gradient-to-r from-rose-400 to-red-600 text-white",
    icon: Crown,
  },
  // Gold foil frame with a thin gold halo
  Legendary: {
    frame: "from-yellow-200 via-amber-400 to-yellow-600",
    glow: "shadow-[0_0_14px_1px_rgba(251,191,36,0.55)]",
    badge: "bg-amber-400 text-black",
    icon: Flame,
  },
  Rare: {
    frame: "from-violet-400 via-indigo-500 to-violet-700",
    glow: "shadow-[0_0_25px_-10px_rgba(139,92,246,0.7)]",
    badge: "bg-violet-500 text-white",
    icon: Gem,
  },
  Common: {
    frame: "from-zinc-500 via-zinc-400 to-zinc-600",
    glow: "shadow-lg shadow-black/50",
    badge: "bg-zinc-700 text-zinc-100",
    icon: Sparkles,
  },
};

/** Overrides on top of the rarity look for special prints. */
const FINISH_STYLES: Record<Exclude<Finish, "normal">, { frame: string; glow: string; badge: string; icon: typeof Crown }> = {
  foil: {
    frame: "bg-gradient-to-br from-white via-slate-400 to-zinc-200",
    glow: "shadow-[0_0_35px_-6px_rgba(226,232,240,0.7)]",
    badge: "bg-gradient-to-r from-slate-100 to-slate-400 text-black",
    icon: Aperture,
  },
  polychrome: {
    frame: "finish-rainbow",
    glow: "shadow-[0_0_50px_-4px_rgba(232,121,249,0.8)]",
    badge: "finish-rainbow text-black",
    icon: Rainbow,
  },
  negative: {
    frame: "bg-gradient-to-br from-zinc-100 via-zinc-950 to-indigo-300",
    glow: "shadow-[0_0_55px_-4px_rgba(129,140,248,0.75)]",
    badge: "bg-zinc-100 text-black",
    icon: Contrast,
  },
};

const TYPE_ICONS: Record<MediaType, typeof Star> = {
  Movie: Clapperboard,
  "TV Series": Tv,
  Anime: Wand2,
};

const MAX_TILT = 15;

/** `clickable` opens the details modal (synopsis, rating, box office) on click. */
export function MovieCard({ card, clickable = false }: { card: CardData; clickable?: boolean }) {
  const showInfo = useCardInfo();
  const style = RARITY_STYLES[card.rarity];
  const finish = card.finish && card.finish !== "normal" ? card.finish : null;
  const finishStyle = finish ? FINISH_STYLES[finish] : null;
  const FinishIcon = finishStyle?.icon;
  const RarityIcon = style.icon;
  const TypeIcon = TYPE_ICONS[card.type];
  const franchise = card.franchise ? getFranchise(card.franchise) : undefined;
  const [imgFailed, setImgFailed] = useState(false);

  // Pointer position normalised to 0..1 within the card
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const spring = { stiffness: 200, damping: 18, mass: 0.6 };
  const rotateX = useSpring(useTransform(py, [0, 1], [MAX_TILT, -MAX_TILT]), spring);
  const rotateY = useSpring(useTransform(px, [0, 1], [-MAX_TILT, MAX_TILT]), spring);
  const shineX = useTransform(px, (v) => `${v * 100}%`);
  const shineY = useTransform(py, (v) => `${v * 100}%`);
  const shine = useMotionTemplate`radial-gradient(circle at ${shineX} ${shineY}, rgba(255,255,255,0.32), transparent 55%)`;

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    px.set((e.clientX - rect.left) / rect.width);
    py.set((e.clientY - rect.top) / rect.height);
  }

  function handleLeave() {
    px.set(0.5);
    py.set(0.5);
  }

  return (
    <div className="[perspective:1000px]">
      <motion.div
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
        onClick={clickable ? () => showInfo(card) : undefined}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        whileHover={{ scale: 1.04 }}
        className={`relative aspect-[2/3] w-full rounded-2xl p-[3px] ${
          finishStyle ? `${finishStyle.frame} ${finishStyle.glow}` : `bg-gradient-to-br ${style.frame} ${style.glow}`
        } ${clickable ? "cursor-pointer" : ""}`}
      >
        <div className="relative h-full overflow-hidden rounded-[14px] bg-zinc-950">
          {/* Poster art, full bleed */}
          {card.poster && !imgFailed ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.poster}
              alt={card.title}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="absolute inset-0 h-full w-full object-cover"
              // Negative: colours inverted, like Balatro's negative edition
              style={finish === "negative" ? { filter: "invert(1) contrast(1.15) saturate(1.2)" } : undefined}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-violet-950 via-zinc-900 to-black p-4">
              <span className="text-center font-serif text-xl font-bold italic leading-tight text-amber-200/80">
                {card.title}
              </span>
            </div>
          )}

          {finish === "negative" && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 mix-blend-color"
              style={{ background: "linear-gradient(160deg, rgba(76,29,149,0.55), rgba(30,27,75,0.35) 50%, rgba(56,189,248,0.3))" }}
            />
          )}

          {/* Legibility gradients */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/80 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black via-black/80 to-transparent" />

          {/* Top bar: type + rarity */}
          <div
            className="absolute inset-x-0 top-0 flex items-center justify-between p-2.5 text-[10px] font-semibold uppercase tracking-wider"
            style={{ transform: "translateZ(25px)" }}
          >
            <span className="flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-zinc-200 ring-1 ring-white/15 backdrop-blur-md">
              <TypeIcon className="h-3 w-3" />
              {card.type}
            </span>
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 ${style.badge}`}>
              <RarityIcon className="h-3 w-3" />
              {card.rarity}
            </span>
          </div>
          {finish && finishStyle && FinishIcon && (
            <span
              className={`absolute right-2.5 top-8 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider shadow-lg ${finishStyle.badge}`}
              style={{ transform: "translateZ(30px)" }}
            >
              <FinishIcon className="h-3 w-3" />
              {FINISHES[finish].name}
            </span>
          )}

          {/* Bottom panel: title + stats */}
          <div className="absolute inset-x-0 bottom-0 p-3" style={{ transform: "translateZ(35px)" }}>
            {franchise && (
              <span className="mb-1 inline-block truncate rounded bg-amber-400/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-amber-300 ring-1 ring-amber-400/30">
                {franchise.name}
              </span>
            )}
            <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white drop-shadow">{card.title}</h3>
            <div className="mt-2 flex items-center justify-between rounded-lg bg-white/5 px-2 py-1.5 ring-1 ring-white/10 backdrop-blur-md">
              <span className="flex items-center gap-1 font-mono text-sm font-bold text-amber-300">
                <Star className="h-3.5 w-3.5 fill-amber-300" />
                {card.rating.toFixed(1)}
                <span className="text-[10px] font-normal text-zinc-500">/10</span>
              </span>
              <span className="font-mono text-xs text-zinc-400">{card.releaseDate ?? "TBA"}</span>
            </div>
          </div>

          {/* Pointer-following shine */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 mix-blend-overlay"
            style={{ background: shine }}
          />
          {/* Special prints */}
          {finish === "foil" && (
            <>
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 mix-blend-color-dodge"
                style={{
                  opacity: 0.4,
                  backgroundImage:
                    "repeating-linear-gradient(115deg, transparent 0 6px, rgba(255,255,255,0.35) 7px 9px, transparent 10px 16px), linear-gradient(115deg, transparent 25%, #e2e8f0 45%, #94a3b8 55%, transparent 75%)",
                  backgroundSize: "200% 200%",
                  backgroundPositionX: shineX,
                  backgroundPositionY: shineY,
                }}
              />
              <div aria-hidden className="finish-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
            </>
          )}
          {finish === "polychrome" && (
            <>
              <div aria-hidden className="finish-rainbow finish-hue pointer-events-none absolute inset-0 opacity-45 mix-blend-color" />
              <motion.div
                aria-hidden
                className="pointer-events-none absolute inset-0 mix-blend-color-dodge"
                style={{
                  opacity: 0.5,
                  backgroundImage:
                    "linear-gradient(115deg, transparent 15%, #f0abfc 30%, #fde68a 40%, #86efac 50%, #67e8f9 60%, #a78bfa 70%, transparent 85%)",
                  backgroundSize: "250% 250%",
                  backgroundPositionX: shineX,
                  backgroundPositionY: shineY,
                }}
              />
            </>
          )}
          {finish === "negative" && (
            <div aria-hidden className="finish-sweep pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-indigo-100/25 to-transparent" />
          )}
        </div>
      </motion.div>
    </div>
  );
}
