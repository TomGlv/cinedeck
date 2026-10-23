"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Gavel, Loader2, Store, Tag } from "lucide-react";
import type { MediaType, Rarity } from "@/lib/cards";
import { afterTax, type ListingDTO, type MarketDTO } from "@/lib/economy";
import { sfx } from "@/lib/sfx";
import { usePlayer } from "../PlayerProvider";
import { RarityChips, SearchInput, Select, ToastStack, useToasts } from "../ui";
import { ListingModal } from "./ListingModal";
import { MarketHeader } from "./MarketHeader";
import { ListingTile } from "./ListingTile";

type Tab = "browse" | "mine" | "bids";
type Sort = "ending" | "priceAsc" | "priceDesc" | "deal";

const POLL_MS = 4000;

const SORTERS: Record<Sort, (a: ListingDTO, b: ListingDTO) => number> = {
  ending: (a, b) => a.endsAt.localeCompare(b.endsAt),
  priceAsc: (a, b) => (a.currentBid ?? a.startPrice) - (b.currentBid ?? b.startPrice),
  priceDesc: (a, b) => (b.currentBid ?? b.startPrice) - (a.currentBid ?? a.startPrice),
  // Biggest discount of Buy Now vs market value first
  deal: (a, b) => a.buyNowPrice / a.marketValue - b.buyNowPrice / b.marketValue,
};

export function MarketView() {
  const { setState } = usePlayer();
  const { toasts, push } = useToasts();
  const [data, setData] = useState<MarketDTO | null>(null);
  const [tab, setTab] = useState<Tab>("browse");
  // Notification links open a tab: /?tab=mine, /?tab=bids
  const params = useSearchParams();
  useEffect(() => {
    const asked = params.get("tab");
    if (asked === "browse" || asked === "mine" || asked === "bids") setTab(asked);
  }, [params]);
  const [rarity, setRarity] = useState<Rarity | "all">("all");
  const [type, setType] = useState<MediaType | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("ending");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const prev = useRef<MarketDTO | null>(null);

  /** Compares two snapshots to announce outbids, wins and sales. */
  const announce = useCallback(
    (before: MarketDTO, after: MarketDTO) => {
      const afterBids = new Map(after.bids.map((l) => [l.id, l]));
      for (const old of before.bids) {
        if (old.status !== "active" || !old.iAmHighest) continue;
        const current = afterBids.get(old.id);
        if (current?.iWon) {
          push(`You won ${current.card.title} for ${current.soldPrice?.toLocaleString("en-US")} coins!`, "success");
          sfx.reveal(current.card.rarity);
        } else if (!current || !current.iAmHighest) {
          push(`Outbid on ${old.card.title}! Your coins were refunded.`, "error");
        }
      }

      const beforeMine = new Map(before.mine.map((l) => [l.id, l]));
      for (const l of after.mine) {
        const old = beforeMine.get(l.id);
        if (old?.status !== "active" || l.status === "active") continue;
        if (l.status === "sold") {
          push(`${l.card.title} sold to ${l.buyerName} for ${l.soldPrice?.toLocaleString("en-US")} (+${afterTax(l.soldPrice ?? 0).toLocaleString("en-US")} after tax)`, "success");
          sfx.coin();
        } else if (l.status === "expired") {
          push(`${l.card.title} didn't sell and is back in your collection`);
        }
      }
    },
    [push],
  );

  const load = useCallback(async () => {
    const res = await fetch("/api/market", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as MarketDTO;
    if (prev.current) announce(prev.current, json);
    prev.current = json;
    setData(json);
    setState(json.state);
  }, [announce, setState]);

  useEffect(() => {
    void load();
    const poll = setInterval(load, POLL_MS);
    const clock = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
  }, [load]);

  const listings = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data[tab]
      .filter((l) => rarity === "all" || l.card.rarity === rarity)
      .filter((l) => type === "all" || l.card.type === type)
      .filter((l) => !q || l.card.title.toLowerCase().includes(q))
      .sort(tab === "browse" ? SORTERS[sort] : () => 0);
  }, [data, tab, rarity, type, query, sort]);

  const all = data ? [...data.browse, ...data.mine, ...data.bids] : [];
  const selected = all.find((l) => l.id === selectedId) ?? null;

  function onDone(message: string, tone: "success" | "error" = "success") {
    setSelectedId(null);
    push(message, tone);
    void load();
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const activeMine = data.mine.filter((l) => l.status === "active").length;
  const activeBids = data.bids.filter((l) => l.status === "active").length;
  const TABS = [
    { id: "browse" as const, label: "Transfer market", icon: Store, count: data.browse.length },
    { id: "mine" as const, label: "My listings", icon: Tag, count: activeMine },
    { id: "bids" as const, label: "My bids", icon: Gavel, count: activeBids },
  ];

  return (
    <>
      <MarketHeader stats={data.stats} recentSales={data.recentSales} />

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${tab === t.id ? "text-black" : "text-zinc-300"}`}
          >
            {tab === t.id && <motion.span layoutId="market-tab" className="absolute inset-0 rounded-full bg-white" />}
            <t.icon className="relative h-4 w-4" />
            <span className="relative">{t.label}</span>
            {t.count > 0 && (
              <span className={`relative rounded-full px-1.5 text-[10px] font-black ${tab === t.id ? "bg-black text-white" : "bg-white/15"}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={query} onChange={setQuery} placeholder="Search the market..." />
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
          {tab === "browse" && (
            <Select
              label="Sort by"
              value={sort}
              onChange={setSort}
              options={[
                { value: "ending", label: "Ending soonest" },
                { value: "deal", label: "Best deals" },
                { value: "priceAsc", label: "Price: low to high" },
                { value: "priceDesc", label: "Price: high to low" },
              ]}
            />
          )}
        </div>
        <RarityChips value={rarity} onChange={setRarity} />
      </div>

      {listings.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center text-zinc-500">
          {tab === "mine" ? (
            <>
              <p>You have no listings.</p>
              <Link href="/collection" className="rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-black">
                Sell cards from your collection
              </Link>
            </>
          ) : tab === "bids" ? (
            <p>No active bids. Find a card on the transfer market.</p>
          ) : (
            <p>No listing matches these filters.</p>
          )}
        </div>
      ) : (
        <motion.div layout className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4 xl:grid-cols-5">
          <AnimatePresence>
            {listings.map((l) => (
              <ListingTile key={l.id} listing={l} now={now} onOpen={() => setSelectedId(l.id)} />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <ListingModal listing={selected} now={now} onClose={() => setSelectedId(null)} onDone={onDone} />
      <ToastStack toasts={toasts} />
    </>
  );
}
