"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Loader2, Star, Store } from "lucide-react";
import type { Rarity } from "@/lib/cards";
import type { CatalogueDTO, CatalogueEntry } from "@/lib/catalogue";
import { MovieCard } from "./MovieCard";
import { CoinAmount, RarityChips, SearchInput, postJson } from "./ui";

/** Most Mythic + Legendary cards shown in the tiers at the top (the API's page limit). */
const TOP = 96;
const PAGE = 48;

function TierTitle({ label, range, className }: { label: string; range: string; className: string }) {
  return (
    <div className="mb-5 flex items-baseline justify-between gap-4 border-b border-white/[0.07] pb-3">
      <h2 className={`font-display text-2xl font-bold tracking-tight ${className}`}>{label}</h2>
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-zinc-500">{range}</span>
    </div>
  );
}

/** A card with a favorite star and where to buy it. */
function CardTile({ entry, index, onFavorite }: { entry: CatalogueEntry; index: number; onFavorite: (e: CatalogueEntry) => void }) {
  const { card, market, favorite } = entry;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-30px" }}
      transition={{ duration: 0.6, delay: Math.min(index % 12, 8) * 0.03, ease: [0.32, 0.72, 0, 1] }}
      className="relative"
    >
      <MovieCard card={card} clickable />
      <div className="mt-2 flex items-center gap-1.5">
        <button
          onClick={() => onFavorite(entry)}
          aria-label={favorite ? `Remove ${card.title} from favorites` : `Add ${card.title} to favorites`}
          aria-pressed={favorite}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1 transition active:scale-95 ${
            favorite ? "bg-amber-400/15 text-amber-300 ring-amber-400/40" : "bg-white/[0.04] text-zinc-400 ring-white/10 hover:text-amber-200"
          }`}
        >
          <Star className={`h-4 w-4 ${favorite ? "fill-amber-300" : ""}`} />
        </button>
        {market.count > 0 ? (
          <Link
            href={`/market?card=${encodeURIComponent(card.id)}`}
            className="flex min-w-0 flex-1 items-center justify-between gap-1 rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-200 ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/20"
          >
            <span className="flex items-center gap-1">
              <Store className="h-3.5 w-3.5" /> {market.count}
            </span>
            {market.lowest != null && <CoinAmount value={market.lowest} className="text-xs" />}
          </Link>
        ) : (
          <span className="flex-1 truncate rounded-full px-3 py-1.5 text-xs text-zinc-500 ring-1 ring-white/[0.06]">Not on the market</span>
        )}
      </div>
    </motion.div>
  );
}

async function fetchCatalogue(params: Record<string, string | number>): Promise<CatalogueDTO> {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`/api/catalogue?${qs}`, { cache: "no-store" });
  return res.json();
}

/**
 * Home page: the Mythic and Legendary tiers, then every other card, searchable, each with a favorite star (you're notified when it goes on sale) and a link
 * to its listings.
 */
export function Showcase() {
  const [query, setQuery] = useState("");
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [top, setTop] = useState<CatalogueEntry[] | null>(null);
  const [list, setList] = useState<CatalogueEntry[] | null>(null);
  const [total, setTotal] = useState(0);
  /** Cards shown in the tiers; the grid below starts after them (the catalogue is sorted rarest first) */
  const [topCount, setTopCount] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const request = useRef(0);

  const filtered = query.trim() !== "" || rarity !== "all" || favoritesOnly;
  const params = useCallback(
    (offset: number) => ({ q: query.trim(), rarity, favorites: favoritesOnly ? 1 : 0, offset, limit: PAGE }),
    [query, rarity, favoritesOnly],
  );

  // The Mythic and Legendary tiers, once
  useEffect(() => {
    void fetchCatalogue({ offset: 0, limit: TOP }).then((d) => {
      const tiers = d.entries.filter((e) => e.card.rarity === "Mythic" || e.card.rarity === "Legendary");
      setTop(tiers);
      setTopCount(tiers.length);
    });
  }, []);

  // The grid below: everything after the tiers, or the search results; debounced while typing
  useEffect(() => {
    if (!filtered && topCount == null) return;
    const id = ++request.current;
    const timer = setTimeout(
      () =>
        void fetchCatalogue(filtered ? params(0) : { offset: topCount ?? 0, limit: PAGE }).then((d) => {
          if (id !== request.current) return;
          setList(d.entries);
          setTotal(filtered ? d.total : Math.max(0, d.total - (topCount ?? 0)));
        }),
      query ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [filtered, params, query, topCount]);

  async function more() {
    if (!list) return;
    setLoadingMore(true);
    const d = await fetchCatalogue(filtered ? params(list.length) : { offset: (topCount ?? 0) + list.length, limit: PAGE });
    setList([...list, ...d.entries]);
    setLoadingMore(false);
  }

  async function toggleFavorite(entry: CatalogueEntry) {
    const flip = (rows: CatalogueEntry[] | null) => rows?.map((e) => (e.card.id === entry.card.id ? { ...e, favorite: !e.favorite } : e)) ?? null;
    setTop(flip);
    setList(flip);
    const res = await postJson<{ favorite?: boolean }>("/api/favorites", { cardId: entry.card.id });
    if (res.error) {
      setTop(flip);
      setList(flip);
    }
  }

  const mythic = top?.filter((e) => e.card.rarity === "Mythic") ?? [];
  const legendary = top?.filter((e) => e.card.rarity === "Legendary") ?? [];

  return (
    <div className="space-y-16">
      {/* Search */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1">
            <SearchInput value={query} onChange={setQuery} placeholder="Search any card, on the market or not..." />
          </div>
          <button
            onClick={() => setFavoritesOnly((f) => !f)}
            aria-pressed={favoritesOnly}
            className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium ring-1 transition active:scale-[0.98] ${
              favoritesOnly ? "bg-amber-400/15 text-amber-200 ring-amber-400/40" : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
            }`}
          >
            <Star className={`h-4 w-4 ${favoritesOnly ? "fill-amber-300 text-amber-300" : ""}`} /> Favorites
          </button>
        </div>
        <RarityChips value={rarity} onChange={setRarity} />
      </div>

      {!filtered && (
        <>
          {!top ? (
            <div className="flex h-60 items-center justify-center text-zinc-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            <>
              {mythic.length > 0 && (
                <section>
                  <TierTitle label="Mythic" range={`${mythic.length} cards`} className="text-red-300" />
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                    {mythic.map((e, i) => (
                      <CardTile key={e.card.id} entry={e} index={i} onFavorite={toggleFavorite} />
                    ))}
                  </div>
                </section>
              )}
              {legendary.length > 0 && (
                <section>
                  <TierTitle label="Legendary" range={`${legendary.length} cards`} className="text-amber-300" />
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
                    {legendary.map((e, i) => (
                      <CardTile key={e.card.id} entry={e} index={i} onFavorite={toggleFavorite} />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </>
      )}

      <section>
        <TierTitle
          label={filtered ? "Results" : "Every other card"}
          range={`${total.toLocaleString("en-US")} cards`}
          className="text-white"
        />
        {!list ? (
          <div className="flex h-40 items-center justify-center text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <p className="py-16 text-center text-sm text-zinc-500">
            {favoritesOnly ? "No favorite yet. Tap the star under a card to watch it." : "No card matches."}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
              {list.map((e, i) => (
                <CardTile key={e.card.id} entry={e} index={i} onFavorite={toggleFavorite} />
              ))}
            </div>
            {list.length < total && (
              <div className="mt-10 flex justify-center">
                <button
                  onClick={more}
                  disabled={loadingMore}
                  className="flex items-center gap-2 rounded-full bg-white/5 px-6 py-3 text-sm font-medium text-zinc-200 ring-1 ring-white/10 transition hover:bg-white/10 active:scale-[0.98]"
                >
                  {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />} Show more
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
