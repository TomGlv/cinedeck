"use client";

import { useState } from "react";
import { motion, useReducedMotion, type TargetAndTransition } from "framer-motion";
import { Clapperboard, Crown, Flame, Ghost, Hand, Snowflake } from "lucide-react";
import type { Rarity } from "@/lib/cards";
import type { PackDef, PackType } from "@/lib/packs";
import { sfx } from "@/lib/sfx";
import { RARITY_FX } from "./rarity-theme";

const THEMES: Record<PackType, { foil: string; strip: string; icon: typeof Crown; accent: string }> = {
  free: {
    foil: "from-violet-700 via-indigo-500 to-fuchsia-600",
    strip: "from-violet-800 via-indigo-600 to-fuchsia-700",
    icon: Clapperboard,
    accent: "text-violet-100",
  },
  premium: {
    foil: "from-zinc-900 via-amber-700 to-zinc-900",
    strip: "from-amber-600 via-yellow-300 to-amber-600",
    icon: Crown,
    accent: "text-amber-200",
  },
  blockbuster: {
    foil: "from-rose-900 via-fuchsia-600 to-amber-500",
    strip: "from-fuchsia-500 via-amber-300 to-rose-500",
    icon: Flame,
    accent: "text-rose-100",
  },
  halloween: {
    foil: "from-orange-600 via-zinc-950 to-purple-800",
    strip: "from-orange-500 via-amber-300 to-orange-600",
    icon: Ghost,
    accent: "text-orange-200",
  },
  holidays: {
    foil: "from-emerald-800 via-rose-700 to-emerald-900",
    strip: "from-rose-500 via-white to-rose-500",
    icon: Snowflake,
    accent: "text-emerald-50",
  },
};

/** Zig-zag crimp along the sealed edges. */
function Crimp({ position }: { position: "top" | "bottom" }) {
  return (
    <div
      className={`absolute inset-x-0 h-2 ${position === "top" ? "top-0" : "bottom-0"}`}
      style={{
        background:
          "repeating-linear-gradient(90deg, rgba(0,0,0,0.35) 0 4px, rgba(255,255,255,0.15) 4px 8px)",
      }}
    />
  );
}

type Mode = "idle" | "shaking" | "ready";

/**
 * A sealed booster. In "ready" mode the top strip can be clicked or swiped to tear it off.
 * `hint` (best rarity inside) tints the glow and makes Mythic packs tremble.
 */
export function BoosterPack({
  pack,
  mode,
  hint,
  onTorn,
}: {
  pack: PackDef;
  mode: Mode;
  hint?: Rarity;
  onTorn?: () => void;
}) {
  const reduced = useReducedMotion();
  const [torn, setTorn] = useState(false);
  const theme = THEMES[pack.type];
  const Icon = theme.icon;
  const glow = hint ? RARITY_FX[hint].glow : "rgba(167,139,250,0.35)";

  function tear() {
    if (mode !== "ready" || torn) return;
    setTorn(true);
    sfx.tear();
    setTimeout(() => onTorn?.(), 800);
  }

  let bodyAnim: TargetAndTransition = {};
  if (torn) {
    bodyAnim = { y: 120, opacity: 0, scale: 0.9, rotate: 0, transition: { delay: 0.35, duration: 0.45, ease: "easeIn" } };
  } else if (mode === "shaking" && !reduced) {
    bodyAnim = { rotate: [0, -4, 4, -3, 3, 0], y: [0, -4, 0], transition: { duration: 0.45, repeat: Infinity } };
  } else if (mode === "ready" && !reduced) {
    const intense = hint === "Mythic" || hint === "Legendary";
    bodyAnim = intense
      ? { y: [0, -10, 0], rotate: [0, -2, 2, -1, 0], transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" } }
      : { y: [0, -10, 0], transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" } };
  }

  return (
    <div className="flex flex-col items-center">
      <motion.div
        className="relative aspect-[5/8] w-52 select-none sm:w-60"
        animate={bodyAnim}
        style={{ filter: `drop-shadow(0 0 ${mode === "ready" ? 40 : 18}px ${glow})` }}
        whileHover={mode === "idle" ? { y: -8, rotate: -2, scale: 1.03 } : undefined}
      >
        {/* Light escaping from the tear */}
        {torn && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-[14%] z-30 h-32 w-32 rounded-full"
            style={{ marginLeft: -64, marginTop: -64, background: `radial-gradient(circle, white, ${glow} 40%, transparent 70%)` }}
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 5, opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
          />
        )}

        {/* Tear-off strip */}
        <motion.div
          drag={mode === "ready" && !torn ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.5}
          onDragEnd={(_, info) => Math.abs(info.offset.x) > 50 && tear()}
          onClick={tear}
          animate={torn ? { x: 140, y: -160, rotate: 35, opacity: 0 } : { x: 0, y: 0, rotate: 0, opacity: 1 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute inset-x-0 top-0 z-20 h-[14%] overflow-hidden rounded-t-xl bg-gradient-to-r ${theme.strip} ${
            mode === "ready" && !torn ? "cursor-grab active:cursor-grabbing" : ""
          }`}
        >
          <Crimp position="top" />
          <div className="absolute inset-x-2 bottom-0 border-b-2 border-dashed border-white/50" />
        </motion.div>

        {/* Body */}
        <div className={`absolute inset-x-0 bottom-0 top-[14%] overflow-hidden rounded-b-xl bg-gradient-to-br ${theme.foil}`}>
          <Crimp position="bottom" />
          {/* Foil texture */}
          <div
            className="absolute inset-0 opacity-30 mix-blend-overlay"
            style={{ background: "repeating-linear-gradient(135deg, rgba(255,255,255,0.4) 0 2px, transparent 2px 9px)" }}
          />
          {/* Sweeping sheen */}
          <motion.div
            aria-hidden
            className="absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
            initial={{ left: "-60%" }}
            animate={{ left: "160%" }}
            transition={{ duration: 1.8, repeat: Infinity, repeatDelay: 1.2, ease: "easeInOut" }}
          />

          <div className="relative flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <div className="rounded-full bg-black/30 p-4 ring-2 ring-white/20 backdrop-blur">
              <Icon className={`h-10 w-10 ${theme.accent}`} />
            </div>
            <span className="text-[10px] font-black tracking-[0.4em] text-white/70">CINEDECK</span>
            <span className={`text-2xl font-black leading-tight ${theme.accent}`}>{pack.name}</span>
            <span className="rounded-full bg-black/40 px-3 py-1 text-[10px] font-bold tracking-widest text-white/80">
              {pack.slots.length} CARDS
            </span>
          </div>
        </div>
      </motion.div>

      {mode === "ready" && !torn && (
        <motion.p
          className="mt-6 flex items-center gap-2 text-sm font-medium text-zinc-300"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity }}
        >
          <Hand className="h-4 w-4" /> Click or swipe the top to tear it open
        </motion.p>
      )}
    </div>
  );
}
