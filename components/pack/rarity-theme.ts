import type { Rarity } from "@/lib/cards";
import type { Finish } from "@/lib/finishes";

/** Colours and effect intensity per rarity, shared by every reveal effect. */
export const RARITY_FX: Record<
  Rarity,
  { colors: string[]; glow: string; particles: number; rays: string | null; label: string }
> = {
  Common: {
    colors: ["#a1a1aa", "#e4e4e7"],
    glow: "rgba(161,161,170,0.25)",
    particles: 0,
    rays: null,
    label: "Common",
  },
  Rare: {
    colors: ["#a78bfa", "#c4b5fd", "#818cf8", "#ffffff"],
    glow: "rgba(139,92,246,0.65)",
    particles: 16,
    rays: null,
    label: "Rare!",
  },
  Legendary: {
    colors: ["#fde68a", "#fbbf24", "#f59e0b", "#fff7ed"],
    glow: "rgba(251,191,36,0.8)",
    particles: 30,
    rays: "conic-gradient(from 0deg, transparent 0deg, rgba(251,191,36,0.55) 10deg, transparent 20deg, transparent 40deg, rgba(253,230,138,0.45) 50deg, transparent 60deg, transparent 80deg, rgba(251,191,36,0.55) 90deg, transparent 100deg, transparent 120deg, rgba(253,230,138,0.45) 130deg, transparent 140deg, transparent 160deg, rgba(251,191,36,0.55) 170deg, transparent 180deg, transparent 200deg, rgba(253,230,138,0.45) 210deg, transparent 220deg, transparent 240deg, rgba(251,191,36,0.55) 250deg, transparent 260deg, transparent 280deg, rgba(253,230,138,0.45) 290deg, transparent 300deg, transparent 320deg, rgba(251,191,36,0.55) 330deg, transparent 340deg)",
    label: "Legendary!",
  },
  Mythic: {
    colors: ["#ffffff", "#fecdd3", "#fb7185", "#ef4444", "#be123c"],
    glow: "rgba(239,68,68,0.85)",
    particles: 52,
    rays: "conic-gradient(from 0deg, #ef444455, transparent 15deg, #fecdd355 30deg, transparent 45deg, #fb718555 60deg, transparent 75deg, #ef444455 90deg, transparent 105deg, #fecdd355 120deg, transparent 135deg, #be123c55 150deg, transparent 165deg, #ef444455 180deg, transparent 195deg, #fecdd355 210deg, transparent 225deg, #fb718555 240deg, transparent 255deg, #ef444455 270deg, transparent 285deg, #fecdd355 300deg, transparent 315deg, #be123c55 330deg, transparent 345deg)",
    label: "MYTHIC PULL!",
  },
};

/** Reveal look for special prints; overrides the rarity's overlay title and colours. */
export const FINISH_FX: Record<Exclude<Finish, "normal">, { label: string; text: string; flash: string }> = {
  foil: {
    label: "FOIL!",
    text: "from-white via-slate-300 to-slate-500",
    flash: "radial-gradient(circle, rgba(255,255,255,0.9) 0%, rgba(203,213,225,0.45) 40%, transparent 75%)",
  },
  polychrome: {
    label: "POLYCHROME!!",
    text: "from-pink-300 via-lime-200 to-cyan-300",
    flash: "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(232,121,249,0.5) 30%, rgba(163,230,53,0.3) 50%, rgba(34,211,238,0.2) 65%, transparent 80%)",
  },
  negative: {
    label: "NEGATIVE!!!",
    text: "from-zinc-100 via-indigo-200 to-violet-400",
    flash: "radial-gradient(circle, rgba(10,10,25,0.92) 0%, rgba(99,102,241,0.5) 35%, rgba(255,255,255,0.22) 60%, transparent 85%)",
  },
};

const TIER: Rarity[] = ["Common", "Rare", "Legendary", "Mythic"];
/** Least effect intensity a print deserves, whatever the card's rarity. */
const FINISH_TIER: Record<Finish, Rarity> = { normal: "Common", foil: "Rare", polychrome: "Legendary", negative: "Mythic" };

/** Rarity whose particles / rays / shake a card's reveal uses: its rarity, bumped up by a special print. */
export function revealTier(card: { rarity: Rarity; finish?: Finish }): Rarity {
  const bump = FINISH_TIER[card.finish ?? "normal"];
  return TIER[Math.max(TIER.indexOf(card.rarity), TIER.indexOf(bump))];
}

export function isSpecial(finish: Finish | undefined): finish is Exclude<Finish, "normal"> {
  return !!finish && finish !== "normal";
}
