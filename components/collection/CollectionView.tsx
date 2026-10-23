"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Gavel, Layers, Loader2, Package, Trophy, Zap } from "lucide-react";
import { RARITY_ORDER, type MediaType, type Rarity } from "@/lib/cards";
import type { CollectionDTO, OwnedGroupDTO } from "@/lib/economy";
import { cardKey } from "@/lib/finishes";
import type { PlayerState } from "@/lib/packs";
import { sfx } from "@/lib/sfx";
import { MovieCard } from "../MovieCard";
import { usePlayer } from "../PlayerProvider";
import { CoinAmount, Modal, RarityChips, SearchInput, Select, ToastStack, TrendIcon, postJson, useToasts } from "../ui";
import { CardActionModal } from "./CardActionModal";
import { SetsPanel } from "./SetsPanel";

type Sort = "rarity" | "value" | "rating" | "year" | "recent" | "title" | "copies";
type TypeFilter = MediaType | "all";

const SORTS: { value: Sort; label: string }[] = [
  { value: "rarity", label: "Rarity" },
  { value: "value", label: "Market value" },
  { value: "rating", label: "Rating" },
  { value: "year", label: "Year" },
  { value: "recent", label: "Recently added" },
  { value: "copies", label: "Most copies" },
  { value: "title", label: "Title" },
];

const SORTERS: Record<Sort, (a: OwnedGroupDTO, b: OwnedGroupDTO) => number> = {
  rarity: (a, b) => RARITY_ORDER[b.card.rarity] - RARITY_ORDER[a.card.rarity] || b.marketValue - a.marketValue,
  value: (a, b) => b.marketValue - a.marketValue,
  rating: (a, b) => b.card.rating - a.card.rating,
  year: (a, b) => (b.card.releaseDate ?? 0) - (a.card.releaseDate ?? 0),
  recent: (a, b) => b.lastPulledAt.localeCompare(a.lastPulledAt),
  copies: (a, b) => b.copies.length - a.copies.length,
  title: (a, b) => a.card.title.localeCompare(b.card.title),
};

export function CollectionView() {
  const { setState } = usePlayer();
  const { toasts, push } = useToasts();
  const [data, setData] = useState<CollectionDTO | null>(null);
  const [tab, setTab] = useState<"cards" | "sets">("cards");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("rarity");
  const [selected, setSelected] = useState<OwnedGroupDTO | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/collection", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as CollectionDTO;
    setData(json);
    setState(json.state);
  }, [setState]);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.groups
      .filter((g) => rarity === "all" || g.card.rarity === rarity)
      .filter((g) => type === "all" || g.card.type === type)
      .filter((g) => !q || g.card.title.toLowerCase().includes(q))
      .sort(SORTERS[sort]);
  }, [data, rarity, type, query, sort]);

  // Unlisted copies beyond the first; one unlisted copy is always kept in case a listing sells
  const duplicates = useMemo(() => {
    if (!data) return { ids: [] as string[], coins: 0 };
    let coins = 0;
    const ids: string[] = [];
    for (const g of data.groups) {
      if (!g.tradeable) continue;
      const spare = g.copies.filter((c) => !c.listed).slice(1);
      for (const c of spare) {
        ids.push(c.id);
        coins += g.quickSell;
      }
    }
    return { ids, coins };
  }, [data]);

  const stats = useMemo(() => {
    if (!data) return null;
    const copies = data.groups.reduce((n, g) => n + g.copies.length, 0);
    const value = data.groups.reduce((n, g) => n + g.marketValue * g.copies.length, 0);
    const mythics = data.groups.filter((g) => g.card.rarity === "Mythic").length;
    return { unique: data.groups.length, copies, value, mythics };
  }, [data]);

  const banners = data?.sets.filter((s) => s.claimed && s.bonus.banner) ?? [];
  const claimable = (data?.sets.filter((s) => s.complete && !s.claimed).length ?? 0) + (data?.combos.filter((c) => c.progress >= c.target && !c.claimed).length ?? 0);

  async function sellDuplicates() {
    setConfirmBulk(false);
    const res = await postJson<{ sold?: number; coins?: number; state?: PlayerState }>("/api/collection/quicksell", {
      ownedCardIds: duplicates.ids,
    });
    if (res.state) setState(res.state);
    if (res.error) return push(res.error, "error");
    sfx.coin();
    push(`Quick sold ${res.sold} duplicates for ${res.coins?.toLocaleString("en-US")} coins`, "success");
    void load();
  }

  function onActionDone(message: string, tone: "success" | "error" = "success") {
    setSelected(null);
    push(message, tone);
    void load();
  }

  if (!data || !stats) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <>
      {/* Gold banners from completed sets */}
      {banners.map((s) => (
        <motion.div
          key={s.slug}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-3 overflow-hidden rounded-2xl bg-gradient-to-r from-amber-600 via-yellow-300 to-amber-600 p-[2px]"
        >
          <div className="relative flex items-center justify-center gap-2 overflow-hidden rounded-[14px] bg-gradient-to-r from-amber-950 via-zinc-950 to-amber-950 px-4 py-2.5 text-sm font-black tracking-widest text-amber-200">
            <motion.div
              aria-hidden
              className="absolute inset-y-0 w-1/4 -skew-x-12 bg-gradient-to-r from-transparent via-amber-200/25 to-transparent"
              initial={{ left: "-30%" }}
              animate={{ left: "130%" }}
              transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1 }}
            />
            <Crown className="h-4 w-4" /> {s.name.toUpperCase()} · MASTER <Crown className="h-4 w-4" />
          </div>
        </motion.div>
      ))}

      {/* Stats */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Unique cards", value: stats.unique.toLocaleString("en-US") },
          { label: "Total copies", value: stats.copies.toLocaleString("en-US") },
          { label: "Mythics", value: stats.mythics.toLocaleString("en-US") },
          { label: "Collection value", value: <CoinAmount value={stats.value} /> },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl bg-white/[0.04] p-4 ring-1 ring-white/10 backdrop-blur">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">{s.label}</p>
            <p className="mt-1 text-2xl font-black text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-2">
        {(
          [
            { id: "cards", label: "Cards", icon: Layers },
            { id: "sets", label: "Sets & Combos", icon: Trophy },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${tab === t.id ? "text-black" : "text-zinc-300"}`}
          >
            {tab === t.id && <motion.span layoutId="collection-tab" className="absolute inset-0 rounded-full bg-white" />}
            <t.icon className="relative h-4 w-4" />
            <span className="relative">{t.label}</span>
            {t.id === "sets" && claimable > 0 && (
              <span className="relative rounded-full bg-amber-400 px-1.5 text-[10px] font-black text-black">{claimable}</span>
            )}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === "cards" ? (
          <motion.div key="cards" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="mb-6 flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput value={query} onChange={setQuery} placeholder="Search your cards..." />
                <Select
                  label="Type"
                  value={type}
                  onChange={setType}
                  options={[
                    { value: "all", label: "All types" },
                    { value: "Movie", label: "Movies" },
                    { value: "TV Series", label: "TV Series" },
                    { value: "Anime", label: "Anime" },
                  ]}
                />
                <Select label="Sort by" value={sort} onChange={setSort} options={SORTS} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <RarityChips value={rarity} onChange={setRarity} />
                {duplicates.ids.length > 0 && (
                  <button
                    onClick={() => setConfirmBulk(true)}
                    className="flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-200 ring-1 ring-white/10 hover:bg-white/10"
                  >
                    <Zap className="h-3.5 w-3.5 text-amber-300" /> Quick sell {duplicates.ids.length} duplicates
                  </button>
                )}
              </div>
            </div>

            {data.groups.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-20 text-center">
                <Package className="h-12 w-12 text-zinc-600" />
                <p className="text-zinc-400">Your collection is empty.</p>
                <Link href="/packs" className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-black">
                  Open your first pack
                </Link>
              </div>
            ) : groups.length === 0 ? (
              <p className="py-20 text-center text-zinc-500">No card matches these filters.</p>
            ) : (
              <motion.div layout className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
                {groups.map((g) => {
                  const listed = g.copies.filter((c) => c.listed).length;
                  return (
                    <motion.button
                      layout
                      key={cardKey(g.card)}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={() => setSelected(g)}
                      className="group relative text-left"
                    >
                      <MovieCard card={g.card} />
                      {g.copies.length > 1 && (
                        <span className="absolute -right-2 -top-2 z-10 rounded-full bg-white px-2 py-0.5 text-xs font-black text-black shadow-lg">
                          ×{g.copies.length}
                        </span>
                      )}
                      {listed > 0 && (
                        <span className="absolute -left-2 -top-2 z-10 flex items-center gap-1 rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black text-black shadow-lg">
                          <Gavel className="h-3 w-3" /> {listed} listed
                        </span>
                      )}
                      <div className="mt-2 flex items-center justify-between px-1 text-xs">
                        {g.tradeable ? (
                          <>
                            <span className="flex items-center gap-1">
                              <CoinAmount value={g.marketValue} /> <TrendIcon trend={g.trend} />
                            </span>
                            <span className="text-zinc-500 group-hover:text-zinc-300">Sell / trade</span>
                          </>
                        ) : (
                          <span className="font-bold text-fuchsia-300">Reward card</span>
                        )}
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            )}
          </motion.div>
        ) : (
          <motion.div key="sets" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <SetsPanel
              sets={data.sets}
              combos={data.combos}
              onClaimed={(m) => {
                push(m, "success");
                void load();
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <CardActionModal group={selected} onClose={() => setSelected(null)} onDone={onActionDone} />

      <Modal open={confirmBulk} onClose={() => setConfirmBulk(false)}>
        <div className="pr-8">
          <h2 className="text-xl font-black text-white">Quick sell all duplicates?</h2>
          <p className="mt-2 text-sm text-zinc-400">
            Sells {duplicates.ids.length} extra copies and keeps one of each card. Listed and reward cards are never touched.
          </p>
          <p className="mt-4 text-2xl">
            <CoinAmount value={duplicates.coins} />
          </p>
          <div className="mt-6 flex gap-3">
            <button onClick={sellDuplicates} className="rounded-full bg-rose-500 px-5 py-2.5 text-sm font-bold text-white hover:bg-rose-400">
              Sell duplicates
            </button>
            <button onClick={() => setConfirmBulk(false)} className="rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-200">
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      <ToastStack toasts={toasts} />
    </>
  );
}
