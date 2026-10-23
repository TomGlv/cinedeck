"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Crown, Gem, Gift, Lock, Sparkles, Trophy } from "lucide-react";
import type { Rarity } from "@/lib/cards";
import type { ComboProgressDTO, SetProgressDTO } from "@/lib/economy";
import type { PlayerState } from "@/lib/packs";
import { sfx } from "@/lib/sfx";
import { ParticleBurst, ShockRing } from "../pack/RarityEffects";
import { useCardInfo } from "../card-info";
import { usePlayer } from "../PlayerProvider";
import { CoinAmount, postJson } from "../ui";

const RARITY_BORDER: Record<Rarity, string> = {
  Mythic: "ring-red-500",
  Legendary: "ring-amber-400",
  Rare: "ring-violet-400",
  Common: "ring-zinc-500",
};

function ProgressBar({ value, max, gold }: { value: number; max: number; gold?: boolean }) {
  const pct = max ? (value / max) * 100 : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
      <motion.div
        className={`h-full rounded-full ${gold ? "bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500" : "bg-violet-500"}`}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
    </div>
  );
}

function ClaimButton({ onClick, busy, label }: { onClick: () => void; busy: boolean; label: string }) {
  return (
    <motion.button
      onClick={onClick}
      disabled={busy}
      animate={{ scale: [1, 1.05, 1], boxShadow: ["0 0 0px rgba(251,191,36,0)", "0 0 28px rgba(251,191,36,0.7)", "0 0 0px rgba(251,191,36,0)"] }}
      transition={{ duration: 1.4, repeat: Infinity }}
      className="flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-4 py-2 text-sm font-black text-black disabled:opacity-60"
    >
      <Gift className="h-4 w-4" /> {label}
    </motion.button>
  );
}

export function SetsPanel({
  sets,
  combos,
  onClaimed,
}: {
  sets: SetProgressDTO[];
  combos: ComboProgressDTO[];
  onClaimed: (message: string) => void;
}) {
  const { setState } = usePlayer();
  const showInfo = useCardInfo();
  const [busy, setBusy] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function claim(slug: string) {
    setBusy(slug);
    setError(null);
    const data = await postJson<{ coins?: number; rewardCard?: string | null; state?: PlayerState }>("/api/collection/claim", { slug });
    setBusy(null);
    if (data.state) setState(data.state);
    if (data.error) {
      setError(data.error);
      return;
    }
    sfx.reveal("Legendary");
    setTimeout(sfx.coin, 500);
    setCelebrate(slug);
    setTimeout(() => setCelebrate(null), 1600);
    onClaimed(`+${data.coins?.toLocaleString("en-US")} CineCoins${data.rewardCard ? ` and ${data.rewardCard} unlocked!` : "!"}`);
  }

  return (
    <div className="space-y-12">
      {error && <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">{error}</p>}

      {/* Combos */}
      <section>
        <h2 className="mb-1 flex items-center gap-2 text-xl font-black text-white">
          <Trophy className="h-5 w-5 text-amber-300" /> Combos
        </h2>
        <p className="mb-5 text-sm text-zinc-400">
          {combos.length} challenges, easiest first. Claim one to unlock the next.
        </p>

        {/* Finished ones */}
        {combos.some((c) => c.claimed) && (
          <div className="mb-4 flex flex-wrap gap-2">
            {combos
              .filter((c) => c.claimed)
              .map((c) => (
                <span key={c.slug} className="flex items-center gap-1.5 rounded-lg bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200 ring-1 ring-amber-400/30">
                  <Check className="h-3.5 w-3.5" /> {c.name}
                </span>
              ))}
          </div>
        )}

        {/* The current one */}
        {combos
          .filter((c) => !c.claimed && !c.locked)
          .map((c) => {
            const done = c.progress >= c.target;
            const Icon = c.rarity === "Mythic" ? Crown : Gem;
            const step = combos.indexOf(c) + 1;
            return (
              <div key={c.slug} className="relative overflow-hidden rounded-2xl bg-white/[0.04] p-5 ring-1 ring-white/10">
                {celebrate === c.slug && (
                  <>
                    <ShockRing rarity="Legendary" />
                    <ParticleBurst rarity="Legendary" />
                  </>
                )}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`rounded-xl p-2.5 ring-1 ${RARITY_BORDER[c.rarity]} bg-white/5 text-amber-300`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                        Combo {step} of {combos.length}
                      </p>
                      <p className="text-lg font-bold text-white">{c.name}</p>
                      <p className="text-sm text-zinc-400">{c.description}</p>
                    </div>
                  </div>
                  <CoinAmount value={c.reward} className="shrink-0 text-base" />
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <ProgressBar value={c.progress} max={c.target} gold={done} />
                  <span className="shrink-0 text-xs font-bold tabular-nums text-zinc-300">
                    {c.progress}/{c.target}
                  </span>
                </div>
                {done && (
                  <div className="mt-4 flex justify-end">
                    <ClaimButton onClick={() => claim(c.slug)} busy={busy === c.slug} label="Claim" />
                  </div>
                )}
              </div>
            );
          })}

        {combos.every((c) => c.claimed) ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-300">
            <Crown className="h-4 w-4" /> Every combo claimed.
          </p>
        ) : (
          combos.some((c) => c.locked) && (
            <p className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
              <Lock className="h-3.5 w-3.5" /> {combos.filter((c) => c.locked).length} more to unlock
            </p>
          )
        )}
      </section>

      {/* Franchise binders */}
      <section>
        <h2 className="mb-1 flex items-center gap-2 text-xl font-black text-white">
          <Sparkles className="h-5 w-5 text-fuchsia-300" /> Sets
        </h2>
        <p className="mb-5 text-sm text-zinc-400">Collect every title of a set for a one-off CineCoins payout.</p>
        <div className="space-y-5">
          {sets.map((s) => (
            <div
              key={s.slug}
              className={`relative overflow-hidden rounded-3xl p-5 ring-1 ${
                s.claimed
                  ? "bg-gradient-to-br from-amber-500/15 via-zinc-950 to-fuchsia-500/10 ring-amber-400/50"
                  : "bg-white/[0.03] ring-white/10"
              }`}
            >
              {s.claimed && (
                <motion.div
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-amber-200/10 to-transparent"
                  initial={{ left: "-40%" }}
                  animate={{ left: "140%" }}
                  transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                />
              )}
              {celebrate === s.slug && (
                <>
                  <ShockRing rarity="Mythic" />
                  <ParticleBurst rarity="Mythic" />
                </>
              )}

              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-black text-white">
                    {s.claimed && <Crown className="h-5 w-5 text-amber-300" />}
                    {s.name}
                  </h3>
                  <p className="mt-0.5 text-sm text-zinc-400">{s.description}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-amber-400/10 px-2.5 py-1 ring-1 ring-amber-400/30">
                      <CoinAmount value={s.bonus.coinReward} />
                    </span>
                    {s.bonus.rewardCard && (
                      <span className="flex items-center gap-1 rounded-full bg-fuchsia-500/10 px-2.5 py-1 font-semibold text-fuchsia-300 ring-1 ring-fuchsia-500/30">
                        <Sparkles className="h-3.5 w-3.5" /> {s.bonus.rewardCard.name} card
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold tabular-nums text-zinc-300">
                    {s.owned}/{s.total}
                  </span>
                  {s.claimed ? (
                    <span className="flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-black text-black">
                      <Check className="h-4 w-4" /> Completed
                    </span>
                  ) : s.complete ? (
                    <ClaimButton onClick={() => claim(s.slug)} busy={busy === s.slug} label="Claim set" />
                  ) : null}
                </div>
              </div>

              <div className="relative mt-4">
                <ProgressBar value={s.owned} max={s.total} gold={s.complete} />
              </div>

              <div className="relative mt-4 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-11">
                {s.cards.map(({ card, owned }) => (
                  <button
                    type="button"
                    key={card.id}
                    onClick={() => showInfo(card)}
                    title={`${card.title} (${card.releaseDate ?? "?"})${owned ? "" : " · missing"}`}
                    className={`relative aspect-[2/3] overflow-hidden rounded-lg ring-2 transition-transform hover:scale-105 ${owned ? RARITY_BORDER[card.rarity] : "ring-white/5"}`}
                  >
                    {card.poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={card.poster.replace("/w500/", "/w185/")}
                        alt={card.title}
                        loading="lazy"
                        className={`h-full w-full object-cover ${owned ? "" : "opacity-25 grayscale"}`}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-zinc-900 p-1 text-center text-[9px] text-zinc-400">
                        {card.title}
                      </div>
                    )}
                    {!owned && (
                      <span className="absolute inset-0 flex items-center justify-center">
                        <Lock className="h-4 w-4 text-zinc-400" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
