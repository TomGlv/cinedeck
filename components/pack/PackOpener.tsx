"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { AlertCircle, CalendarClock, Coins, Eye, Gift, Library, Loader2, RotateCcw, Timer } from "lucide-react";
import { RARITY_ORDER, type Rarity } from "@/lib/cards";
import { FINISHES, SPECIAL_FINISHES } from "@/lib/finishes";
import { FREE_PACK_COINS, PACKS, availablePacks, eventEndsAt, packChanceAtLeast, type PackType, type PlayerState } from "@/lib/packs";
import { sfx } from "@/lib/sfx";
import { formatCountdown, useCountdown, usePlayer } from "../PlayerProvider";
import { BoosterPack } from "./BoosterPack";
import { FlipCard, type PulledCard } from "./FlipCard";
import { RevealOverlay, type BigPull } from "./RarityEffects";
import { isSpecial, revealTier } from "./rarity-theme";

type Phase = "select" | "loading" | "tear" | "reveal";

interface OpenResponse {
  cards?: PulledCard[];
  coinsEarned?: number;
  state?: PlayerState;
  error?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function PackOpener() {
  const { state, setState } = usePlayer();
  const reduced = useReducedMotion();
  const shake = useAnimationControls();
  const freeIn = useCountdown(state?.nextFreePackAt ?? null);

  const [phase, setPhase] = useState<Phase>("select");
  const [packType, setPackType] = useState<PackType>("free");
  const [cards, setCards] = useState<PulledCard[]>([]);
  const [flipped, setFlipped] = useState<boolean[]>([]);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [bigPull, setBigPull] = useState<BigPull | null>(null);
  // Fixed for the visit so the list doesn't change under the player at midnight
  const [packs] = useState(() => availablePacks());

  const flippedRef = useRef<boolean[]>([]);
  const autoRevealing = useRef(false);

  // The pack's glow hints at the strongest reveal inside, special prints included
  const bestRarity = cards.reduce<Rarity | undefined>((best, c) => {
    const tier = revealTier(c);
    return !best || RARITY_ORDER[tier] > RARITY_ORDER[best] ? tier : best;
  }, undefined);
  const allFlipped = flipped.length > 0 && flipped.every(Boolean);

  async function open(type: PackType) {
    setError(null);
    setPackType(type);
    setPhase("loading");
    sfx.shake();
    const started = Date.now();

    try {
      const res = await fetch("/api/packs/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      const data = (await res.json()) as OpenResponse;
      if (data.state) setState(data.state);
      if (!res.ok || !data.cards) throw new Error(data.error ?? "Could not open the pack");

      // Let the shake play for a beat even when the server is fast
      await sleep(Math.max(0, 900 - (Date.now() - started)));
      flippedRef.current = data.cards.map(() => false);
      setFlipped(flippedRef.current);
      setCards(data.cards);
      setCoinsEarned(data.coinsEarned ?? 0);
      setPhase("tear");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("select");
    }
  }

  function onTorn() {
    setPhase("reveal");
    cards.forEach((_, i) => setTimeout(sfx.deal, 150 + i * 120));
  }

  const flip = useCallback(
    (i: number) => {
      if (flippedRef.current[i]) return;
      flippedRef.current = flippedRef.current.map((f, j) => f || j === i);
      setFlipped(flippedRef.current);

      const { rarity, finish } = cards[i];
      const tier = revealTier(cards[i]);
      sfx.flip();
      setTimeout(() => sfx.reveal(tier), 180);

      const big = tier === "Legendary" || tier === "Mythic";
      if (big || isSpecial(finish)) {
        setBigPull({ rarity, finish, key: Date.now() });
        if (!reduced && big) {
          const amp = tier === "Mythic" ? 16 : 8;
          void shake.start({
            x: [0, -amp, amp, -amp * 0.7, amp * 0.6, -amp * 0.3, 0],
            y: [0, amp * 0.4, -amp * 0.4, amp * 0.2, 0, 0, 0],
            transition: { duration: tier === "Mythic" ? 0.7 : 0.45, delay: 0.15 },
          });
        }
      }
      if (flippedRef.current.every(Boolean) && coinsEarned > 0) setTimeout(sfx.coin, 900);
    },
    [cards, coinsEarned, reduced, shake],
  );

  async function revealAll() {
    if (autoRevealing.current) return;
    autoRevealing.current = true;
    for (let i = 0; i < cards.length; i++) {
      if (flippedRef.current[i]) continue;
      flip(i);
      // Give big pulls and special prints their moment before the next card
      await sleep(RARITY_ORDER[revealTier(cards[i])] >= 2 || isSpecial(cards[i].finish) ? 1800 : 450);
    }
    autoRevealing.current = false;
  }

  function reset() {
    setCards([]);
    setFlipped([]);
    flippedRef.current = [];
    setPhase("select");
  }

  const dismissBigPull = useCallback(() => setBigPull(null), []);
  const newCount = cards.filter((c, i) => flipped[i] && c.isNew).length;

  return (
    <motion.div animate={shake} className="relative">
      <AnimatePresence mode="wait">
        {phase === "select" && (
          <motion.div
            key="select"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`grid gap-6 sm:grid-cols-2 ${packs.length > 3 ? "xl:grid-cols-4" : "lg:grid-cols-3"}`}
          >
            {error && (
              <div className="col-span-full flex items-center gap-2 rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-300 ring-1 ring-rose-500/30">
                <AlertCircle className="h-4 w-4 shrink-0" /> {error}
              </div>
            )}
            {packs.map((pack) => {
              const type = pack.type;
              const free = type === "free";
              const disabled = !state || (free ? freeIn > 0 : state.coins < pack.cost);
              const daysLeft = pack.event ? Math.max(0, Math.ceil((eventEndsAt(pack.event).getTime() - Date.now()) / 86_400_000)) : 0;

              return (
                <div
                  key={type}
                  className={`relative flex flex-col items-center gap-5 rounded-3xl p-6 backdrop-blur-sm ${
                    pack.event ? "bg-orange-500/[0.06] ring-2 ring-orange-400/40" : "bg-white/[0.03] ring-1 ring-white/10"
                  } ${free && packs.length === 3 ? "sm:col-span-2 lg:col-span-1" : ""}`}
                >
                  {pack.event && (
                    <span className="absolute -top-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full bg-orange-400 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-black shadow-lg shadow-orange-500/30">
                      <CalendarClock className="h-3.5 w-3.5" /> {pack.event.name} · {daysLeft <= 1 ? "last day" : `${daysLeft} days left`}
                    </span>
                  )}
                  <button type="button" onClick={() => !disabled && open(type)} disabled={disabled} className="disabled:opacity-60">
                    <BoosterPack pack={pack} mode="idle" />
                  </button>
                  <div className="text-center">
                    <p className="text-sm text-zinc-300">{pack.tagline}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      {packChanceAtLeast(pack, "Legendary").toFixed(0)}% Legendary+ · {packChanceAtLeast(pack, "Mythic").toFixed(1)}% Mythic
                      {free && state ? ` · +${Math.round(FREE_PACK_COINS * (1 + state.coinBoost))} CineCoins` : ""}
                    </p>
                  </div>
                  <motion.button
                    type="button"
                    onClick={() => open(type)}
                    disabled={disabled}
                    whileHover={disabled ? undefined : { scale: 1.04 }}
                    whileTap={disabled ? undefined : { scale: 0.96 }}
                    className={`flex w-full max-w-xs items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-colors disabled:cursor-not-allowed ${
                      free
                        ? "bg-violet-500 text-white hover:bg-violet-400 disabled:bg-zinc-800 disabled:text-zinc-500"
                        : "bg-gradient-to-r from-amber-300 to-amber-500 text-black disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500"
                    }`}
                  >
                    {!state ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : free ? (
                      freeIn > 0 ? (
                        <>
                          <Timer className="h-4 w-4" /> Next free pack in {formatCountdown(freeIn)}
                        </>
                      ) : (
                        <>
                          <Gift className="h-4 w-4" /> Open free pack
                        </>
                      )
                    ) : state.coins < pack.cost ? (
                      <>
                        <Coins className="h-4 w-4" /> Need {pack.cost - state.coins} more coins
                      </>
                    ) : (
                      <>
                        <Coins className="h-4 w-4" /> Open for {pack.cost} coins
                      </>
                    )}
                  </motion.button>
                </div>
              );
            })}
            <p className="col-span-full text-center text-xs text-zinc-500">
              Any card can come out as a special print:{" "}
              {SPECIAL_FINISHES.slice()
                .reverse()
                .map((f) => `${FINISHES[f].name} ${FINISHES[f].chance}% (x${FINISHES[f].multiplier} value)`)
                .join(" · ")}
              . Event packs print them 3x more often.
            </p>
          </motion.div>
        )}

        {(phase === "loading" || phase === "tear") && (
          <motion.div
            key="pack"
            initial={{ opacity: 0, scale: 0.7, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 160, damping: 16 }}
            className="flex min-h-[60vh] items-center justify-center"
          >
            <BoosterPack
              pack={PACKS[packType]}
              mode={phase === "loading" ? "shaking" : "ready"}
              hint={phase === "tear" ? bestRarity : undefined}
              onTorn={onTorn}
            />
          </motion.div>
        )}

        {phase === "reveal" && (
          <motion.div key="reveal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="mx-auto grid max-w-5xl grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-5">
              {cards.map((card, i) => (
                <div key={`${card.id}-${i}`} className={i === cards.length - 1 ? "col-span-2 mx-auto w-1/2 sm:col-span-1 sm:w-full" : ""}>
                  <FlipCard card={card} index={i} flipped={flipped[i]} onFlip={() => flip(i)} />
                </div>
              ))}
            </div>

            <div className="mt-10 flex min-h-[48px] flex-wrap items-center justify-center gap-3">
              <AnimatePresence mode="wait">
                {!allFlipped ? (
                  <motion.button
                    key="reveal-all"
                    type="button"
                    onClick={revealAll}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-100 ring-1 ring-white/15 hover:bg-white/15"
                  >
                    <Eye className="h-4 w-4" /> Reveal all
                  </motion.button>
                ) : (
                  <motion.div
                    key="summary"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 }}
                    className="flex flex-wrap items-center justify-center gap-3"
                  >
                    <span className="rounded-full bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300 ring-1 ring-emerald-500/30">
                      {newCount} new card{newCount === 1 ? "" : "s"}
                    </span>
                    {coinsEarned > 0 && (
                      <span className="flex items-center gap-1.5 rounded-full bg-amber-400/10 px-4 py-2 text-sm text-amber-300 ring-1 ring-amber-400/30">
                        <Coins className="h-4 w-4" /> +{coinsEarned}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={reset}
                      className="flex items-center gap-2 rounded-full bg-violet-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-violet-400"
                    >
                      <RotateCcw className="h-4 w-4" /> Open another
                    </button>
                    <Link
                      href="/collection"
                      className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-100 ring-1 ring-white/15 hover:bg-white/15"
                    >
                      <Library className="h-4 w-4" /> View collection
                    </Link>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <RevealOverlay pull={bigPull} onDone={dismissBigPull} />
    </motion.div>
  );
}
