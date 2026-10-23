"use client";

import { motion } from "framer-motion";
import { Bot, Crown, Timer, Trophy } from "lucide-react";
import { MovieCard } from "../MovieCard";
import { CoinAmount, TrendIcon } from "../ui";
import type { ListingDTO } from "@/lib/economy";

export function Countdown({ endsAt, now }: { endsAt: string; now: number }) {
  const ms = Math.max(0, new Date(endsAt).getTime() - now);
  const total = Math.ceil(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const text = h > 0 ? `${h}h ${m.toString().padStart(2, "0")}m` : `${m}:${s.toString().padStart(2, "0")}`;
  return <span className={`tabular-nums ${ms < 60_000 ? "text-rose-400" : ""}`}>{text}</span>;
}

const STATUS_LABEL: Record<ListingDTO["status"], string> = {
  active: "",
  sold: "Sold",
  expired: "Expired",
  cancelled: "Cancelled",
};

export function ListingTile({ listing: l, now, onOpen }: { listing: ListingDTO; now: number; onOpen: () => void }) {
  const ended = l.status !== "active" || new Date(l.endsAt).getTime() <= now;
  const price = l.currentBid ?? l.startPrice;
  const deal = !l.isMine && !ended && l.buyNowPrice < l.marketValue * 0.9;

  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9 }}
      onClick={onOpen}
      className={`group relative flex flex-col text-left ${ended ? "opacity-70" : ""}`}
    >
      <div className="relative">
        <MovieCard card={l.card} />
        {l.iAmHighest && !ended && (
          <span className="absolute -left-2 -top-2 z-10 flex items-center gap-1 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-black text-black shadow-lg">
            <Crown className="h-3 w-3" /> Winning
          </span>
        )}
        {l.outbid && !ended && (
          <span className="absolute -left-2 -top-2 z-10 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white shadow-lg">
            Outbid
          </span>
        )}
        {l.iWon && (
          <span className="absolute -left-2 -top-2 z-10 flex items-center gap-1 rounded-full bg-emerald-400 px-2 py-0.5 text-[10px] font-black text-black shadow-lg">
            <Trophy className="h-3 w-3" /> Won
          </span>
        )}
        {deal && (
          <span className="absolute -right-2 -top-2 z-10 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black text-white shadow-lg">
            DEAL
          </span>
        )}
      </div>

      <div className="mt-2 space-y-1 rounded-xl bg-white/[0.04] p-2.5 text-xs ring-1 ring-white/10 transition-colors group-hover:bg-white/[0.07]">
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">
            {l.currentBid != null ? `Bid${l.bidCount > 1 ? ` (${l.bidCount})` : ""}` : "Start"}
          </span>
          <CoinAmount value={price} />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-zinc-500">Buy Now</span>
          <CoinAmount value={l.buyNowPrice} className="text-amber-200" />
        </div>
        <div className="flex items-center justify-between border-t border-white/5 pt-1">
          <span className="flex min-w-0 items-center gap-1 truncate text-zinc-400">
            {!l.isMine && <Bot className="h-3 w-3 shrink-0" />}
            <span className="truncate">{l.isMine ? (l.bidderName ? `Top: ${l.bidderName}` : "Your listing") : l.sellerName}</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 font-semibold text-zinc-200">
            {ended ? (
              STATUS_LABEL[l.status] || "Ended"
            ) : (
              <>
                <Timer className="h-3 w-3" /> <Countdown endsAt={l.endsAt} now={now} />
              </>
            )}
          </span>
        </div>
        <div className="flex items-center justify-between text-[10px] text-zinc-500">
          <span>Value</span>
          <span className="flex items-center gap-1">
            {l.marketValue.toLocaleString("en-US")} <TrendIcon trend={l.trend} />
          </span>
        </div>
      </div>
    </motion.button>
  );
}
