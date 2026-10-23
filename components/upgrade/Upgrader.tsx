"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { ChevronsUp, Loader2, X } from "lucide-react";
import type { CardData, Rarity } from "@/lib/cards";
import { UPGRADE_MAX_CHANCE, UPGRADE_MAX_INPUTS, upgradeChance, type CollectionDTO } from "@/lib/economy";
import type { PlayerState } from "@/lib/packs";
import { sfx } from "@/lib/sfx";
import { CardThumb } from "../CardThumb";
import { MovieCard } from "../MovieCard";
import { usePlayer } from "../PlayerProvider";
import { CoinAmount, RarityChips, SearchInput, ToastStack, postJson, useToasts } from "../ui";

interface Copy {
  id: string;
  card: CardData;
  value: number;
}

interface Target {
  /** Card print key (lib/finishes cardKey) */
  key: string;
  card: CardData;
  value: number;
  /** Copies left to win */
  stock: number;
}

interface UpgradeResponse {
  won?: boolean;
  chance?: number;
  roll?: number;
  state?: PlayerState;
}

const MULTIPLIERS = [1.5, 2, 5, 10];
const SPIN_S = 4.2;

/** Ring with the winning arc from 12 o'clock, and a needle that spins to the server's roll. */
function Wheel({ chance, controls }: { chance: number; controls: ReturnType<typeof useAnimationControls> }) {
  const r = 88;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative mx-auto aspect-square w-full max-w-[260px]">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90">
        <circle cx={100} cy={100} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} />
        <motion.circle
          cx={100}
          cy={100}
          r={r}
          fill="none"
          stroke="#10b981"
          strokeWidth={14}
          strokeDasharray={c}
          animate={{ strokeDashoffset: c * (1 - chance) }}
          transition={{ type: "spring", stiffness: 120, damping: 20 }}
        />
      </svg>
      <motion.div className="absolute inset-0" animate={controls} initial={{ rotate: 0 }}>
        <div className="absolute left-1/2 top-[3%] h-[22%] w-1.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_12px_rgba(255,255,255,0.8)]" />
      </motion.div>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-black tabular-nums text-white">{(chance * 100).toFixed(chance < 0.1 ? 1 : 0)}%</span>
        <span className="text-xs uppercase tracking-wider text-zinc-500">chance</span>
      </div>
    </div>
  );
}

export function Upgrader() {
  const { setState } = usePlayer();
  const { toasts, push } = useToasts();
  const reduced = useReducedMotion();
  const controls = useAnimationControls();

  const [copies, setCopies] = useState<Copy[] | null>(null);
  const [targets, setTargets] = useState<Target[] | null>(null);
  const [picked, setPicked] = useState<string[]>([]);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [targetRarity, setTargetRarity] = useState<Rarity | "all">("all");
  const [query, setQuery] = useState("");
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<{ won: boolean; card: CardData } | null>(null);

  const load = useCallback(async () => {
    const [col, tgt] = await Promise.all([
      fetch("/api/collection", { cache: "no-store" }).then((r) => r.json() as Promise<CollectionDTO>),
      // Stock changes after every upgrade, so targets are always reloaded
      fetch("/api/upgrade", { cache: "no-store" }).then((r) => r.json() as Promise<{ targets: Target[] }>),
    ]);
    setState(col.state);
    setCopies(
      col.groups
        .filter((g) => g.tradeable)
        .flatMap((g) => g.copies.filter((c) => !c.listed).map((c) => ({ id: c.id, card: g.card, value: g.marketValue })))
        .sort((a, b) => b.value - a.value),
    );
    setTargets(tgt.targets);
  }, [setState]);

  useEffect(() => {
    void load();
    // Only on mount; later reloads are explicit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byId = useMemo(() => new Map((copies ?? []).map((c) => [c.id, c])), [copies]);
  const stake = picked.reduce((sum, id) => sum + (byId.get(id)?.value ?? 0), 0);
  const target = targets?.find((t) => t.key === targetId) ?? null;
  const chance = target && target.value > stake ? upgradeChance(stake, target.value) : 0;

  const shownCopies = (copies ?? []).filter((c) => rarity === "all" || c.card.rarity === rarity);
  const shownTargets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (targets ?? [])
      .filter((t) => t.value > stake)
      .filter((t) => targetRarity === "all" || t.card.rarity === targetRarity)
      .filter((t) => !q || t.card.title.toLowerCase().includes(q))
      .slice(0, 60);
  }, [targets, stake, targetRarity, query]);

  // Dropping the stake above the target's value makes the target invalid
  useEffect(() => {
    if (target && target.value <= stake) setTargetId(null);
  }, [target, stake]);

  function toggle(id: string) {
    setResult(null);
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= UPGRADE_MAX_INPUTS ? p : [...p, id]));
  }

  /** Picks the target whose value is closest to stake x multiplier. */
  function pickMultiplier(m: number) {
    if (!targets || stake === 0) return;
    const goal = stake * m;
    const best = targets
      .filter((t) => t.value > stake)
      .reduce<Target | null>((b, t) => (!b || Math.abs(t.value - goal) < Math.abs(b.value - goal) ? t : b), null);
    if (best) setTargetId(best.key);
  }

  async function run() {
    if (!target || picked.length === 0) return;
    setSpinning(true);
    setResult(null);
    const res = await postJson<UpgradeResponse>("/api/upgrade", { ownedCardIds: picked, targetCardId: target.key });
    if (res.error || res.roll == null) {
      setSpinning(false);
      push(res.error ?? "Upgrade failed", "error");
      if (res.state) setState(res.state);
      return;
    }

    sfx.shake();
    await controls.start({
      rotate: (reduced ? 0 : 360 * 6) + res.roll * 360,
      transition: { duration: reduced ? 0.3 : SPIN_S, ease: [0.12, 0.8, 0.2, 1] },
    });
    if (res.state) setState(res.state);
    if (res.won) sfx.reveal(target.card.rarity);
    setResult({ won: !!res.won, card: target.card });
    push(res.won ? `Upgraded into ${target.card.title}!` : `Upgrade failed, ${picked.length} card${picked.length > 1 ? "s" : ""} lost`, res.won ? "success" : "error");
    setPicked([]);
    setSpinning(false);
    controls.set({ rotate: (res.roll * 360) % 360 });
    void load();
  }

  if (!copies || !targets) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1fr_300px_1fr]">
        {/* Stake */}
        <section className="order-2 rounded-3xl bg-white/[0.03] p-4 ring-1 ring-white/10 lg:order-1">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-white">Your cards</h2>
            <span className="text-xs text-zinc-500">
              {picked.length}/{UPGRADE_MAX_INPUTS} · <CoinAmount value={stake} />
            </span>
          </div>
          <RarityChips value={rarity} onChange={setRarity} />
          {shownCopies.length === 0 ? (
            <p className="py-10 text-center text-sm text-zinc-500">
              No cards to stake. <Link href="/packs" className="text-amber-300 underline">Open a pack</Link>
            </p>
          ) : (
            <div className="mt-3 grid max-h-[480px] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">
              {shownCopies.map((c) => (
                <CardThumb key={c.id} card={c.card} value={c.value} selected={picked.includes(c.id)} onClick={() => !spinning && toggle(c.id)} />
              ))}
            </div>
          )}
        </section>

        {/* Wheel */}
        <section className="order-1 flex flex-col items-center gap-4 lg:order-2">
          <Wheel chance={chance} controls={controls} />
          <AnimatePresence mode="wait">
            {result ? (
              <motion.div
                key="result"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className={`w-full rounded-2xl p-3 text-center text-sm font-bold ring-1 ${
                  result.won ? "bg-emerald-500/15 text-emerald-200 ring-emerald-500/40" : "bg-rose-500/10 text-rose-200 ring-rose-500/30"
                }`}
              >
                {result.won ? `You got ${result.card.title}!` : "Missed. Your cards are gone."}
              </motion.div>
            ) : (
              <motion.p key="hint" className="text-center text-xs text-zinc-500">
                Stake up to {UPGRADE_MAX_INPUTS} cards, pick a pricier target. Chance = stake / target value × 90%, capped at{" "}
                {UPGRADE_MAX_CHANCE * 100}%.
              </motion.p>
            )}
          </AnimatePresence>
          <div className="flex w-full flex-wrap justify-center gap-1.5">
            {MULTIPLIERS.map((m) => (
              <button
                key={m}
                onClick={() => pickMultiplier(m)}
                disabled={stake === 0 || spinning}
                className="rounded-full bg-white/5 px-3 py-1 text-xs font-bold text-zinc-200 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-40"
              >
                x{m}
              </button>
            ))}
          </div>
          <motion.button
            onClick={run}
            disabled={spinning || !target || picked.length === 0}
            whileTap={{ scale: 0.96 }}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-emerald-300 to-emerald-500 px-5 py-3 text-sm font-black text-black disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500"
          >
            {spinning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronsUp className="h-4 w-4" />}
            {spinning ? "Spinning..." : !picked.length ? "Pick cards to stake" : !target ? "Pick a target" : `Upgrade · ${(chance * 100).toFixed(1)}%`}
          </motion.button>
          {target && (
            <div className="w-40">
              <MovieCard card={target.card} clickable />
              <p className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                Target <CoinAmount value={target.value} />
              </p>
              <p className="text-[11px] text-zinc-500">
                {target.stock} {target.stock === 1 ? "copy" : "copies"} left to win
              </p>
              <button onClick={() => setTargetId(null)} className="mt-1 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
                <X className="h-3 w-3" /> Clear target
              </button>
            </div>
          )}
        </section>

        {/* Target */}
        <section className="order-3 rounded-3xl bg-white/[0.03] p-4 ring-1 ring-white/10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-white">Target</h2>
            <span className="text-xs text-zinc-500">{stake === 0 ? "Stake cards first" : `worth more than ${stake.toLocaleString("en-US")}`}</span>
          </div>
          <div className="flex flex-col gap-2">
            <SearchInput value={query} onChange={setQuery} placeholder="Search a card..." />
            <RarityChips value={targetRarity} onChange={setTargetRarity} />
          </div>
          <div className="mt-3 grid max-h-[480px] grid-cols-4 gap-2 overflow-y-auto pr-1 sm:grid-cols-5">
            {shownTargets.map((t) => (
              <CardThumb
                key={t.key}
                card={t.card}
                value={t.value}
                selected={t.key === targetId}
                badge={stake > 0 ? `${(upgradeChance(stake, t.value) * 100).toFixed(0)}%` : undefined}
                onClick={() => !spinning && (setTargetId(t.key), setResult(null))}
              />
            ))}
          </div>
        </section>
      </div>
      <ToastStack toasts={toasts} />
    </>
  );
}
