"use client";

import Link from "next/link";
import { Activity, Coins, Gift, Library, Package, Timer, TrendingUp } from "lucide-react";
import type { Rarity } from "@/lib/cards";
import type { MarketStats, SaleDTO } from "@/lib/economy";
import { formatCountdown, useCountdown, usePlayer } from "../PlayerProvider";
import { CoinAmount } from "../ui";
import { PageHeader } from "../PageHeader";

const RARITY_TEXT: Record<Rarity, string> = {
  Mythic: "text-red-300",
  Legendary: "text-amber-300",
  Rare: "text-violet-300",
  Common: "text-zinc-400",
};

function compact(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`;
  return n.toLocaleString("en-US");
}

function Stat({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
      <Icon className="h-5 w-5 shrink-0 text-amber-300" />
      <div className="min-w-0">
        <p className="text-lg font-black tabular-nums leading-none text-white">{value}</p>
        <p className="mt-1 truncate text-[11px] uppercase tracking-wider text-zinc-500">{label}</p>
      </div>
    </div>
  );
}

/** Scrolling tape of the latest sales, like a stock ticker. */
function SalesTicker({ sales }: { sales: SaleDTO[] }) {
  if (sales.length === 0) return null;
  // Rendered twice so the loop is seamless
  const tape = [...sales, ...sales];
  return (
    <div className="relative overflow-hidden rounded-2xl bg-black/30 py-2 ring-1 ring-white/10 [mask-image:linear-gradient(90deg,transparent,black_6%,black_94%,transparent)]">
      <div className="flex w-max animate-[ticker_60s_linear_infinite] gap-6 hover:[animation-play-state:paused]">
        {tape.map((s, i) => (
          <span key={`${s.id}-${i}`} className="flex shrink-0 items-center gap-2 text-xs">
            {s.poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={s.poster.replace("/w500/", "/w92/")} alt="" className="h-7 w-5 rounded-sm object-cover" />
            ) : (
              <span className="h-7 w-5 rounded-sm bg-white/10" />
            )}
            <span className={`max-w-[160px] truncate font-semibold ${RARITY_TEXT[s.rarity] ?? "text-zinc-300"}`}>{s.title}</span>
            <CoinAmount value={s.price} />
            <span className="text-zinc-600">{s.buyerName ? `→ ${s.buyerName}` : ""}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Home hero: market activity, the player's wallet and the free pack timer. */
export function MarketHeader({ stats, recentSales }: { stats: MarketStats; recentSales: SaleDTO[] }) {
  const { state } = usePlayer();
  const freeIn = useCountdown(state?.nextFreePackAt ?? null);

  return (
    <header className="mb-8 space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader kicker="Transfer market" title="The market" className="mb-0">
          Buy at market price, bid on other players&apos; cards, sell your own. Set a max bid and we defend your lead. Prices follow real
          trades, every sale is taxed 5%.
        </PageHeader>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/packs"
            className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-transform hover:scale-105 ${
              freeIn === 0
                ? "bg-gradient-to-r from-emerald-300 to-emerald-500 text-black shadow-lg shadow-emerald-500/20"
                : "bg-gradient-to-r from-amber-300 to-amber-500 text-black shadow-lg shadow-amber-500/20"
            }`}
          >
            {freeIn === 0 ? <Gift className="h-4 w-4" /> : <Package className="h-4 w-4" />}
            {freeIn === 0 ? "Free pack ready" : "Open packs"}
            {state && freeIn > 0 && (
              <span className="flex items-center gap-1 text-xs font-semibold opacity-70">
                <Timer className="h-3 w-3" /> {formatCountdown(freeIn)}
              </span>
            )}
          </Link>
          <Link
            href="/collection"
            className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-100 ring-1 ring-white/15 hover:bg-white/15"
          >
            <Library className="h-4 w-4" /> Sell from my collection
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={Activity} label="Live auctions" value={String(stats.active)} />
        <Stat icon={TrendingUp} label="Sales (24h)" value={String(stats.sales24h)} />
        <Stat icon={Coins} label="Volume (24h)" value={compact(stats.volume24h)} />
        <Stat icon={Library} label="Cards you own" value={state ? String(state.cardCount) : "..."} />
      </div>

      <SalesTicker sales={recentSales} />
    </header>
  );
}
