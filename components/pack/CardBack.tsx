"use client";

import { motion, useReducedMotion } from "framer-motion";
import { Film } from "lucide-react";
import type { Rarity } from "@/lib/cards";
import { RARITY_FX } from "./rarity-theme";

/**
 * Face-down card. `hint` leaks the rarity before the flip:
 * Rare glows, Legendary pulses gold, Mythic shivers in rainbow.
 */
export function CardBack({ hint }: { hint?: Rarity }) {
  const reduced = useReducedMotion();
  const fx = hint ? RARITY_FX[hint] : null;
  const big = hint === "Legendary" || hint === "Mythic";

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
            background:
              hint === "Mythic"
                ? "conic-gradient(from 0deg, #f0abfc, #67e8f9, #fde68a, #a78bfa, #f0abfc)"
                : fx.glow,
          }}
          animate={{ opacity: big ? [0.5, 1, 0.5] : [0.25, 0.55, 0.25], rotate: hint === "Mythic" ? 360 : 0 }}
          transition={{
            opacity: { duration: hint === "Mythic" ? 0.8 : 1.4, repeat: Infinity },
            rotate: { duration: 3, repeat: Infinity, ease: "linear" },
          }}
        />
      )}

      <div className="relative h-full overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 via-fuchsia-600 to-amber-400 p-[3px] shadow-xl shadow-black/60">
        <div className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[14px] bg-[radial-gradient(circle_at_50%_40%,#2e1065_0%,#09090b_70%)]">
          {/* Film-strip edges */}
          <div className="absolute inset-y-0 left-1.5 flex flex-col justify-around">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className="h-2 w-1.5 rounded-sm bg-white/10" />
            ))}
          </div>
          <div className="absolute inset-y-0 right-1.5 flex flex-col justify-around">
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className="h-2 w-1.5 rounded-sm bg-white/10" />
            ))}
          </div>

          <div className="absolute h-2/3 w-2/3 rounded-full border border-amber-300/20" />
          <div className="absolute h-1/2 w-1/2 rounded-full border border-fuchsia-400/20" />
          <Film className="h-10 w-10 text-amber-300 drop-shadow-[0_0_12px_rgba(252,211,77,0.6)]" />
          <span className="mt-2 text-xs font-black tracking-[0.3em] text-amber-200/90">CINEDECK</span>

          {/* Idle sheen */}
          <motion.div
            aria-hidden
            className="absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent"
            initial={{ left: "-40%" }}
            animate={{ left: "140%" }}
            transition={{ duration: 2.2, repeat: Infinity, repeatDelay: 1.5, ease: "easeInOut" }}
          />
        </div>
      </div>
    </motion.div>
  );
}
