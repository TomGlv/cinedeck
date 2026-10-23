"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { Rarity } from "@/lib/cards";
import type { PackType } from "@/lib/packs";
import { LogoMark } from "../Logo";
import { CRINKLE, IRIDESCENT, PACK_THEMES } from "./pack-theme";
import { RARITY_FX } from "./rarity-theme";

/**
 * Face-down card, printed like the pack it came out of: same tinted foil, crinkle,
 * iridescent band and metal-coloured frame. `hint` leaks the rarity before the flip:
 * Rare glows, Legendary pulses gold, Mythic shivers in red.
 */
export function CardBack({ hint, pack = "premium" }: { hint?: Rarity; pack?: PackType }) {
  const reduced = useReducedMotion();
  const fx = hint ? RARITY_FX[hint] : null;
  const big = hint === "Legendary" || hint === "Mythic";
  const t = PACK_THEMES[pack];

  return (
    <motion.div
      className="relative h-full w-full"
      animate={hint === "Mythic" && !reduced ? { rotate: [0, -1.5, 1.5, -1, 0], x: [0, -2, 2, -1, 0] } : undefined}
      transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 1.1 }}
    >
      {/* Aura */}
      {fx && hint !== "Common" && (
        <motion.div
          aria-hidden
          className="absolute -inset-2 rounded-3xl blur-xl"
          style={{
            background: hint === "Mythic" ? "conic-gradient(from 0deg, #fecdd3, #ef4444, #9f1239, #fb7185, #fecdd3)" : fx.glow,
          }}
          animate={{ opacity: big ? [0.5, 1, 0.5] : [0.25, 0.55, 0.25], rotate: hint === "Mythic" ? 360 : 0 }}
          transition={{
            opacity: { duration: hint === "Mythic" ? 0.8 : 1.4, repeat: Infinity },
            rotate: { duration: 3, repeat: Infinity, ease: "linear" },
          }}
        />
      )}

      {/* Metal frame in the pack's seal colour */}
      <div
        className="relative h-full overflow-hidden rounded-2xl p-[3px] shadow-xl shadow-black/60"
        style={{ background: `linear-gradient(140deg, ${t.seal}, color-mix(in srgb, ${t.seal} 35%, black) 55%, ${t.seal})` }}
      >
        <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[14px]" style={{ background: t.tint }}>
          {/* Foil: crinkle, iridescent band, pillow shading */}
          <div aria-hidden className="absolute inset-0 opacity-[0.2] mix-blend-overlay" style={{ backgroundImage: CRINKLE }} />
          <div aria-hidden className="absolute inset-0 opacity-30 mix-blend-color-dodge" style={{ background: IRIDESCENT }} />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 80% 60% at 45% 40%, rgba(255,255,255,0.14), transparent 60%), linear-gradient(90deg, rgba(255,255,255,0.18), transparent 10%, transparent 88%, rgba(0,0,0,0.4))",
            }}
          />
          {/* Ridged inner border, like the pack's seals */}
          <div
            aria-hidden
            className="absolute inset-2 rounded-[10px]"
            style={{
              border: `1px solid color-mix(in srgb, ${t.seal} 60%, transparent)`,
              boxShadow: `inset 0 0 0 3px color-mix(in srgb, ${t.tint} 70%, black), inset 0 0 0 4px color-mix(in srgb, ${t.seal} 35%, transparent)`,
            }}
          />

          <div className="relative flex flex-col items-center gap-2">
            <LogoMark className="h-12 w-12 drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)]" />
            <span className="font-display text-lg font-extrabold tracking-[-0.04em] text-white drop-shadow">cinedeck</span>
            <span className="text-[8px] font-semibold uppercase tracking-[0.3em]" style={{ color: t.seal }}>
              {t.label}
            </span>
          </div>

          {/* Idle sheen */}
          <motion.div
            aria-hidden
            className="absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent"
            initial={{ left: "-40%" }}
            animate={{ left: "140%" }}
            transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.5, ease: [0.45, 0, 0.55, 1] }}
          />
        </div>
      </div>
    </motion.div>
  );
}
