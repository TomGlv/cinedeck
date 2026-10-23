"use client";

import { useEffect, useState } from "react";
import { Gavel, Minus, Plus, ShieldCheck, ShoppingCart, Trophy, X } from "lucide-react";
import { CardDetailsPanel } from "../CardDetails";
import { MovieCard } from "../MovieCard";
import { usePlayer } from "../PlayerProvider";
import { CoinAmount, Modal, TrendIcon, postJson } from "../ui";
import { afterTax, bidIncrement, roundPrice, type BidDTO, type ListingDTO } from "@/lib/economy";
import type { PlayerState } from "@/lib/packs";
import { sfx } from "@/lib/sfx";
import { Countdown } from "./ListingTile";
import { PriceChart, type SalePoint } from "./PriceChart";

export function ListingModal({
  listing,
  now,
  onClose,
  onDone,
}: {
  listing: ListingDTO | null;
  now: number;
  onClose: () => void;
  onDone: (message: string, tone?: "success" | "error") => void;
}) {
  return (
    <Modal open={listing != null} onClose={onClose}>
      {listing && <Content key={listing.id} listing={listing} now={now} onDone={onDone} />}
    </Modal>
  );
}

/** Latest bids, newest first. Proxy auto-bids are tagged. */
function BidHistory({ bids }: { bids: BidDTO[] }) {
  if (bids.length === 0) return <p className="text-xs text-zinc-500">No bids yet. Be the first.</p>;
  return (
    <ul className="max-h-40 space-y-1 overflow-y-auto pr-1 text-xs">
      {bids.slice(0, 12).map((b, i) => (
        <li key={`${b.createdAt}-${i}`} className="flex items-center justify-between gap-2">
          <span className={`flex min-w-0 items-center gap-1.5 truncate ${b.isMe ? "font-bold text-emerald-300" : "text-zinc-300"}`}>
            {b.isMe ? "You" : b.bidderName}
            {b.auto && <span className="rounded bg-white/10 px-1 text-[9px] font-semibold uppercase text-zinc-400">auto</span>}
          </span>
          <span className="flex shrink-0 items-center gap-2">
            <CoinAmount value={b.amount} className={i === 0 ? "" : "text-zinc-400"} />
            <span className="w-14 text-right tabular-nums text-zinc-600">{timeAgo(b.createdAt)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function Content({ listing: l, now, onDone }: { listing: ListingDTO; now: number; onDone: (m: string, t?: "success" | "error") => void }) {
  const { state, setState } = usePlayer();
  const leadingMax = l.myMax ?? 0;
  const floor = l.iAmHighest ? leadingMax + 1 : l.minBid;
  const [max, setMax] = useState(() => Math.min(l.buyNowPrice - 1, Math.max(l.minBid, roundPrice(l.marketValue * 0.9))));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sales, setSales] = useState<SalePoint[] | null>(null);
  const [bids, setBids] = useState<BidDTO[] | null>(null);

  // Keep the input valid when someone outbids while the modal is open
  useEffect(() => setMax((m) => Math.max(m, floor)), [floor]);

  // Refresh the history whenever a new bid lands
  useEffect(() => {
    fetch(`/api/market/history?cardId=${encodeURIComponent(l.card.id)}&finish=${l.card.finish ?? "normal"}&listingId=${l.id}`)
      .then((r) => r.json())
      .then((d: { sales: SalePoint[]; bids: BidDTO[] }) => {
        setSales(d.sales);
        setBids(d.bids);
      })
      .catch(() => {
        setSales([]);
        setBids([]);
      });
  }, [l.card.id, l.card.finish, l.id, l.bidCount]);

  const coins = state?.coins ?? 0;
  const active = l.status === "active" && new Date(l.endsAt).getTime() > now;
  // Our max is already in escrow: raising it or buying now only charges the difference
  const held = l.iAmHighest ? leadingMax : 0;
  const buyNowDue = l.buyNowPrice - held;
  const maxTooHigh = max >= l.buyNowPrice;
  const cantAfford = max - held > coins;

  async function act(action: "bid" | "buy" | "cancel", body: object) {
    setBusy(true);
    setError(null);
    const data = await postJson<{ state?: PlayerState; leading?: boolean; price?: number }>(`/api/market/${action}`, {
      listingId: l.id,
      ...body,
    });
    if (data.state) setState(data.state);
    setBusy(false);
    if (data.error) {
      setError(data.error);
      return;
    }
    if (action === "buy") {
      sfx.reveal(l.card.rarity);
      onDone(`You bought ${l.card.title}!`);
    } else if (action === "cancel") {
      onDone("Listing cancelled, card returned");
    } else if (data.leading) {
      sfx.coin();
      onDone(
        l.iAmHighest
          ? `Max bid raised to ${max.toLocaleString("en-US")} on ${l.card.title}`
          : `You're winning ${l.card.title} at ${data.price?.toLocaleString("en-US")} (max ${max.toLocaleString("en-US")})`,
      );
    } else {
      // Someone's hidden max beat ours: stay open so the player can go higher
      setError(`Outbid instantly: another bidder's max is higher. Price is now ${data.price?.toLocaleString("en-US")}.`);
    }
  }

  const step = bidIncrement(max);
  const presets = [
    { label: "Min", value: floor },
    { label: "90% value", value: roundPrice(l.marketValue * 0.9) },
    { label: "Value", value: l.marketValue },
  ].filter((p, i, all) => p.value >= floor && p.value < l.buyNowPrice && all.findIndex((q) => q.value === p.value) === i);

  return (
    <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
      <div className="mx-auto w-48 sm:w-full">
        <MovieCard card={l.card} />
      </div>

      <div className="flex flex-col gap-4">
        <div className="pr-8">
          <h2 className="text-xl font-black text-white">{l.card.title}</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Seller: <span className="font-semibold text-zinc-200">{l.isMine ? "You" : l.sellerName}</span>
            {l.bidCount > 0 && ` · ${l.bidCount} bid${l.bidCount > 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">{l.currentBid != null ? "Current bid" : "Start price"}</p>
            <p className="mt-1 text-lg">
              <CoinAmount value={l.currentBid ?? l.startPrice} />
            </p>
            <p className="truncate text-xs text-zinc-500">
              {l.currentBid != null ? (l.iAmHighest ? "You're winning" : `by ${l.bidderName}`) : "No bids yet"}
            </p>
          </div>
          <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            <p className="text-[11px] uppercase tracking-wider text-zinc-500">Time left</p>
            <p className="mt-1 text-lg font-bold text-white">{active ? <Countdown endsAt={l.endsAt} now={now} /> : "Ended"}</p>
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              Value <CoinAmount value={l.marketValue} className="font-semibold" /> <TrendIcon trend={l.trend} />
            </p>
          </div>
        </div>

        {l.isMine ? (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">
              {l.status === "sold"
                ? `Sold to ${l.buyerName} for ${l.soldPrice?.toLocaleString("en-US")} coins. You received ${afterTax(l.soldPrice ?? 0).toLocaleString("en-US")}.`
                : l.status === "expired"
                  ? "Ended without bids. The card is back in your collection."
                  : l.status === "cancelled"
                    ? "Listing cancelled."
                    : `Buy Now: ${l.buyNowPrice.toLocaleString("en-US")} coins.`}
            </p>
            {active && l.currentBid == null && (
              <button
                onClick={() => act("cancel", {})}
                disabled={busy}
                className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-100 ring-1 ring-white/15 hover:bg-white/15"
              >
                <X className="h-4 w-4" /> Cancel listing
              </button>
            )}
          </div>
        ) : l.iWon ? (
          <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
            <Trophy className="h-4 w-4" /> You won this card for {l.soldPrice?.toLocaleString("en-US")} coins. It&apos;s in your collection.
          </p>
        ) : active ? (
          <div className="space-y-3">
            {l.iAmHighest ? (
              <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200 ring-1 ring-emerald-500/30">
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <span>
                  You&apos;re winning. Your max of <b>{leadingMax.toLocaleString("en-US")}</b> defends you automatically.
                </span>
              </p>
            ) : (
              l.outbid && (
                <p className="rounded-xl bg-rose-500/10 px-4 py-3 text-sm text-rose-200 ring-1 ring-rose-500/30">
                  You&apos;ve been outbid. Raise your max to get back in.
                </p>
              )
            )}

            <div>
              <p className="mb-1.5 text-[11px] uppercase tracking-wider text-zinc-500">{l.iAmHighest ? "Raise your max bid" : "Your max bid"}</p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMax((m) => Math.max(floor, m - bidIncrement(Math.max(floor, m - 1))))}
                  aria-label="Lower max bid"
                  className="rounded-full bg-white/10 p-2.5 text-zinc-200 hover:bg-white/15"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <input
                  type="number"
                  value={max}
                  min={floor}
                  onChange={(e) => setMax(Math.floor(Number(e.target.value) || 0))}
                  className="w-full rounded-full bg-white/5 px-4 py-2.5 text-center text-lg font-black tabular-nums text-amber-200 ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/60"
                />
                <button
                  onClick={() => setMax((m) => m + step)}
                  aria-label="Raise max bid"
                  className="rounded-full bg-white/10 p-2.5 text-zinc-200 hover:bg-white/15"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              {presets.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {presets.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => setMax(p.value)}
                      className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                        max === p.value ? "bg-amber-400 text-black ring-amber-400" : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
                      }`}
                    >
                      {p.label} · {p.value.toLocaleString("en-US")}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              <button
                onClick={() => act("bid", { max })}
                disabled={busy || max < floor || maxTooHigh || cantAfford}
                className="flex items-center justify-center gap-2 rounded-full bg-accent-500 px-5 py-3 text-sm font-bold text-white hover:bg-accent-400 disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                <Gavel className="h-4 w-4" />
                {maxTooHigh
                  ? "Above Buy Now"
                  : cantAfford
                    ? "Not enough coins"
                    : l.iAmHighest
                      ? `Raise max to ${max.toLocaleString("en-US")}`
                      : `Bid up to ${max.toLocaleString("en-US")}`}
              </button>
              <button
                onClick={() => act("buy", {})}
                disabled={busy || buyNowDue > coins}
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-5 py-3 text-sm font-bold text-black disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500"
              >
                <ShoppingCart className="h-4 w-4" /> Buy Now {l.buyNowPrice.toLocaleString("en-US")}
              </button>
            </div>
            <p className="text-xs text-zinc-500">
              We bid for you, only as much as needed to stay ahead, up to your max. Your max is held while you lead and the unused
              part comes back when the auction ends. Bids in the last 30s extend the auction.
            </p>
          </div>
        ) : (
          <p className="text-sm text-zinc-400">{l.lost ? `This auction went to ${l.buyerName ?? "another bidder"}.` : "This auction has ended."}</p>
        )}

        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>

      <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10 sm:col-span-2">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">Price history</p>
        <PriceChart sales={sales} marketValue={l.marketValue} />
      </div>
      <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10 sm:col-span-2">
        <p className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">Bids</p>
        {bids ? <BidHistory bids={bids} /> : <div className="h-12 animate-pulse rounded bg-white/5" />}
      </div>

      <div className="border-t border-white/5 pt-5 sm:col-span-2">
        <CardDetailsPanel card={l.card} />
      </div>
    </div>
  );
}
