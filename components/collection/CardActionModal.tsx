"use client";

import { useState } from "react";
import { Gavel, Lock, Zap } from "lucide-react";
import { CardDetailsPanel } from "../CardDetails";
import { MovieCard } from "../MovieCard";
import { PriceChart, useSales } from "../market/PriceChart";
import { CoinAmount, Modal, TrendIcon, postJson } from "../ui";
import { usePlayer } from "../PlayerProvider";
import { cardKey } from "@/lib/finishes";
import { LISTING_DURATIONS, MARKET_TAX, afterTax, roundPrice, type OwnedGroupDTO } from "@/lib/economy";
import type { PlayerState } from "@/lib/packs";
import { sfx } from "@/lib/sfx";

/** Card detail: quick sell one copy, or list it on the transfer market. */
export function CardActionModal({
  group,
  onClose,
  onDone,
}: {
  group: OwnedGroupDTO | null;
  onClose: () => void;
  onDone: (message: string, tone?: "success" | "error") => void;
}) {
  return (
    <Modal open={group != null} onClose={onClose}>
      {group && <Content key={cardKey(group.card)} group={group} onDone={onDone} />}
    </Modal>
  );
}

function Content({ group, onDone }: { group: OwnedGroupDTO; onDone: (m: string, t?: "success" | "error") => void }) {
  const { setState } = usePlayer();
  const { card } = group;
  const available = group.copies.filter((c) => !c.listed);
  const sales = useSales(card.id, card.finish);
  const listedCount = group.copies.length - available.length;

  const [confirmSell, setConfirmSell] = useState(false);
  const [busy, setBusy] = useState(false);
  const [startPrice, setStartPrice] = useState(roundPrice(group.marketValue * 0.8));
  const [buyNowPrice, setBuyNowPrice] = useState(roundPrice(group.marketValue * 1.2));
  const [duration, setDuration] = useState<number>(60);
  const [error, setError] = useState<string | null>(null);

  async function run(url: string, body: unknown, success: string) {
    setBusy(true);
    setError(null);
    const data = await postJson<{ state?: PlayerState }>(url, body);
    if (data.state) setState(data.state);
    setBusy(false);
    if (data.error) {
      setError(data.error);
      return;
    }
    onDone(success);
  }

  async function quickSell() {
    if (!confirmSell) {
      setConfirmSell(true);
      return;
    }
    sfx.coin();
    await run("/api/collection/quicksell", { ownedCardIds: [available[0].id] }, `Sold ${card.title} for ${group.quickSell} coins`);
  }

  async function list() {
    await run(
      "/api/market/list",
      { ownedCardId: available[0].id, startPrice, buyNowPrice, durationMin: duration },
      `${card.title} listed on the transfer market`,
    );
  }

  const priceInput =
    "w-full rounded-xl bg-white/5 px-3 py-2 text-sm font-bold tabular-nums text-amber-200 ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/60";

  return (
    <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
      <div className="mx-auto w-48 sm:w-full">
        <MovieCard card={card} />
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <h2 className="pr-8 text-xl font-black text-white">{card.title}</h2>
          <p className="mt-1 text-sm text-zinc-400">
            {group.copies.length} {group.copies.length === 1 ? "copy" : "copies"}
            {listedCount > 0 && ` · ${listedCount} on the market`}
          </p>
        </div>

        {!group.tradeable ? (
          <p className="flex items-center gap-2 rounded-xl bg-amber-400/10 p-4 text-sm text-amber-200 ring-1 ring-amber-400/30">
            <Lock className="h-4 w-4" /> Reward card: it can&apos;t be sold or traded.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Market value</p>
                <p className="mt-1 flex items-center gap-2 text-lg">
                  <CoinAmount value={group.marketValue} /> <TrendIcon trend={group.trend} />
                </p>
              </div>
              <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                <p className="text-[11px] uppercase tracking-wider text-zinc-500">Quick sell</p>
                <p className="mt-1 text-lg">
                  <CoinAmount value={group.quickSell} />
                </p>
              </div>
            </div>

            {available.length === 0 ? (
              <p className="text-sm text-zinc-400">Every copy is already on the market.</p>
            ) : (
              <>
                <button
                  onClick={quickSell}
                  onMouseLeave={() => setConfirmSell(false)}
                  disabled={busy}
                  className={`flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-bold transition-colors disabled:opacity-50 ${
                    confirmSell ? "bg-rose-500 text-white" : "bg-white/10 text-zinc-100 ring-1 ring-white/15 hover:bg-white/15"
                  }`}
                >
                  <Zap className="h-4 w-4" />
                  {confirmSell ? `Confirm: sell 1 copy for ${group.quickSell} coins` : "Quick sell 1 copy"}
                </button>

                <div className="rounded-2xl bg-white/[0.03] p-4 ring-1 ring-white/10">
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-zinc-100">
                    <Gavel className="h-4 w-4 text-amber-300" /> List on the transfer market
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="text-xs text-zinc-400">
                      Start price
                      <input
                        type="number"
                        min={1}
                        value={startPrice}
                        onChange={(e) => setStartPrice(Math.max(1, Math.floor(Number(e.target.value) || 0)))}
                        className={`${priceInput} mt-1`}
                      />
                    </label>
                    <label className="text-xs text-zinc-400">
                      Buy Now
                      <input
                        type="number"
                        min={2}
                        value={buyNowPrice}
                        onChange={(e) => setBuyNowPrice(Math.max(2, Math.floor(Number(e.target.value) || 0)))}
                        className={`${priceInput} mt-1`}
                      />
                    </label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {LISTING_DURATIONS.map((d) => (
                      <button
                        key={d.minutes}
                        onClick={() => setDuration(d.minutes)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                          duration === d.minutes
                            ? "bg-amber-400 text-black ring-amber-400"
                            : "bg-white/5 text-zinc-300 ring-white/10"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-3 text-xs text-zinc-500">
                    You receive {afterTax(buyNowPrice).toLocaleString("en-US")} coins at Buy Now price, after the {MARKET_TAX * 100}% tax.
                    Bots pay up to about market value.
                  </p>
                  <button
                    onClick={list}
                    disabled={busy || buyNowPrice <= startPrice}
                    className="mt-3 w-full rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-5 py-2.5 text-sm font-bold text-black disabled:opacity-50"
                  >
                    {buyNowPrice <= startPrice ? "Buy Now must be above start price" : "List card"}
                  </button>
                </div>
              </>
            )}
          </>
        )}

        {error && <p className="text-sm text-rose-400">{error}</p>}
      </div>

      {group.tradeable && (
        <div className="rounded-xl bg-white/5 p-4 ring-1 ring-white/10 sm:col-span-2">
          <p className="mb-2 text-[11px] uppercase tracking-wider text-zinc-500">Price history</p>
          <PriceChart sales={sales} marketValue={group.marketValue} />
        </div>
      )}

      <div className="border-t border-white/5 pt-5 sm:col-span-2">
        <CardDetailsPanel card={card} />
      </div>
    </div>
  );
}
