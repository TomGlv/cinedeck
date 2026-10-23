"use client";

import { Check } from "lucide-react";
import type { CardData, Rarity } from "@/lib/cards";
import { FINISHES } from "@/lib/finishes";
import { CoinAmount } from "./ui";

const RARITY_RING: Record<Rarity, string> = {
  Mythic: "ring-fuchsia-400",
  Legendary: "ring-amber-400",
  Rare: "ring-violet-500",
  Common: "ring-zinc-600",
};

const FINISH_CHIP = {
  foil: "bg-gradient-to-r from-slate-100 to-slate-400 text-black",
  polychrome: "finish-rainbow text-black",
  negative: "bg-orange-400 text-black",
} as const;

/** Small poster tile for pickers (upgrader, trades). */
export function CardThumb({
  card,
  value,
  selected = false,
  onClick,
  badge,
}: {
  card: CardData;
  value: number;
  selected?: boolean;
  onClick?: () => void;
  badge?: string;
}) {
  const finish = card.finish && card.finish !== "normal" ? card.finish : null;
  return (
    <button
      type="button"
      onClick={onClick}
      title={finish ? `${card.title} (${FINISHES[finish].name})` : card.title}
      className={`group relative overflow-hidden rounded-lg text-left ring-2 transition-transform hover:-translate-y-0.5 ${
        selected ? "ring-emerald-400" : `${RARITY_RING[card.rarity]} opacity-80 hover:opacity-100`
      }`}
    >
      <div className="aspect-[2/3] bg-zinc-900">
        {card.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.poster.replace("/w500/", "/w185/")}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            style={finish === "negative" ? { filter: "invert(1) hue-rotate(180deg)" } : undefined}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-1 text-center text-[9px] text-zinc-400">{card.title}</div>
        )}
      </div>
      {finish && <div aria-hidden className="finish-rainbow pointer-events-none absolute inset-0 opacity-20 mix-blend-color" />}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/80 to-transparent px-1.5 pb-1 pt-4">
        {finish && (
          <span className={`mb-0.5 block w-fit rounded px-1 text-[8px] font-black uppercase tracking-wider ${FINISH_CHIP[finish]}`}>
            {FINISHES[finish].name}
          </span>
        )}
        <CoinAmount value={value} className="flex text-[11px]" />
      </div>
      {badge && (
        <span className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 text-[10px] font-black tabular-nums text-emerald-300">{badge}</span>
      )}
      {selected && (
        <span className="absolute left-1 top-1 rounded-full bg-emerald-400 p-0.5 text-black">
          <Check className="h-3 w-3" />
        </span>
      )}
    </button>
  );
}
