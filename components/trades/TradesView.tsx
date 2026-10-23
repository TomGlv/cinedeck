"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, ArrowLeftRight, Check, Coins, Loader2, Send, UserPlus, X } from "lucide-react";
import type { PlayerState } from "@/lib/packs";
import type { InventoryGroupDTO, TradeCardDTO, TradeDTO } from "@/lib/trades";
import { sfx } from "@/lib/sfx";
import { CardThumb } from "../CardThumb";
import { usePlayer } from "../PlayerProvider";
import { CoinAmount, SearchInput, Select, ToastStack, postJson, useToasts } from "../ui";

const MAX_CARDS = 10;

interface TradesData {
  incoming: TradeDTO[];
  outgoing: TradeDTO[];
  history: TradeDTO[];
  state: PlayerState;
}

const STATUS: Record<TradeDTO["status"], { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-white/10 text-zinc-300" },
  accepted: { label: "Accepted", className: "bg-emerald-500/15 text-emerald-300" },
  declined: { label: "Declined", className: "bg-rose-500/15 text-rose-300" },
  cancelled: { label: "Cancelled", className: "bg-white/5 text-zinc-500" },
  failed: { label: "Failed", className: "bg-amber-400/15 text-amber-300" },
};

const sumValue = (cards: TradeCardDTO[], coins: number) => cards.reduce((s, c) => s + c.value, 0) + coins;

/* ------------------------------------------------------------------ */
/*  Offer display                                                      */
/* ------------------------------------------------------------------ */

function Side({ label, cards, coins }: { label: string; cards: TradeCardDTO[]; coins: number }) {
  return (
    <div className="min-w-0 flex-1 rounded-2xl bg-white/[0.03] p-3 ring-1 ring-white/10">
      <p className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-zinc-500">
        {label} <CoinAmount value={sumValue(cards, coins)} className="text-xs normal-case" />
      </p>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
        {cards.map((c) => (
          <CardThumb key={c.ownedCardId} card={c.card} value={c.value} />
        ))}
      </div>
      {coins > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-sm">
          + <CoinAmount value={coins} /> coins
        </p>
      )}
      {cards.length === 0 && coins === 0 && <p className="text-sm text-zinc-500">Nothing</p>}
    </div>
  );
}

function OfferCard({ t, busy, onAct }: { t: TradeDTO; busy: boolean; onAct: (action: "accept" | "decline" | "cancel", t: TradeDTO) => void }) {
  // Always from my point of view
  const give = t.incoming ? { cards: t.request, coins: t.requestCoins } : { cards: t.offer, coins: t.offerCoins };
  const get = t.incoming ? { cards: t.offer, coins: t.offerCoins } : { cards: t.request, coins: t.requestCoins };
  const delta = sumValue(get.cards, get.coins) - sumValue(give.cards, give.coins);

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} className="rounded-3xl bg-white/[0.04] p-4 ring-1 ring-white/10">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-300">
          {t.incoming ? "From" : "To"}{" "}
          <Link href={`/u/${t.otherName}`} className="font-bold text-white hover:underline">
            {t.otherName}
          </Link>
          <span className="ml-2 text-xs text-zinc-500">{new Date(t.createdAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
        </p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-bold tabular-nums ${delta >= 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-rose-500/15 text-rose-300"}`}>
          {delta >= 0 ? "+" : ""}
          {delta.toLocaleString("en-US")} for you
        </span>
      </div>
      {t.message && <p className="mb-3 rounded-xl bg-white/5 px-3 py-2 text-sm italic text-zinc-300">&ldquo;{t.message}&rdquo;</p>}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Side label="You give" cards={give.cards} coins={give.coins} />
        <div className="flex items-center justify-center text-zinc-600">
          <ArrowLeftRight className="h-5 w-5 rotate-90 sm:rotate-0" />
        </div>
        <Side label="You get" cards={get.cards} coins={get.coins} />
      </div>

      {t.status === "pending" ? (
        <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
          {!t.valid && (
            <p className="mr-auto flex items-center gap-1.5 text-xs text-amber-300">
              <AlertTriangle className="h-3.5 w-3.5" /> Some cards moved since this offer was sent, it can&apos;t go through.
            </p>
          )}
          {t.incoming ? (
            <>
              <button
                onClick={() => onAct("decline", t)}
                disabled={busy}
                className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-white/15 disabled:opacity-50"
              >
                <X className="h-4 w-4" /> Decline
              </button>
              <button
                onClick={() => onAct("accept", t)}
                disabled={busy || !t.valid}
                className="flex items-center gap-1.5 rounded-full bg-emerald-400 px-4 py-2 text-sm font-bold text-black disabled:opacity-50"
              >
                <Check className="h-4 w-4" /> Accept trade
              </button>
            </>
          ) : (
            <button
              onClick={() => onAct("cancel", t)}
              disabled={busy}
              className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-zinc-200 ring-1 ring-white/15 disabled:opacity-50"
            >
              Cancel offer
            </button>
          )}
        </div>
      ) : (
        <p className="mt-3 text-right">
          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS[t.status].className}`}>{STATUS[t.status].label}</span>
        </p>
      )}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Builder                                                            */
/* ------------------------------------------------------------------ */

/** One side of the builder: pick copies from an inventory. `picked` holds copy ids. */
function Picker({
  title,
  groups,
  picked,
  onChange,
  coins,
  onCoins,
  maxCoins,
}: {
  title: string;
  groups: InventoryGroupDTO[] | null;
  picked: string[];
  onChange: (ids: string[]) => void;
  coins: number;
  onCoins: (n: number) => void;
  maxCoins?: number;
}) {
  const [query, setQuery] = useState("");
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (groups ?? []).filter((g) => !q || g.card.title.toLowerCase().includes(q)).slice(0, 80);
  }, [groups, query]);

  const pickedSet = new Set(picked);
  const countIn = (g: InventoryGroupDTO) => g.copies.filter((id) => pickedSet.has(id)).length;
  const value = (groups ?? []).reduce((s, g) => s + countIn(g) * g.value, 0) + coins;

  /** Click adds the next copy; once all are in, a click takes them all out. */
  function toggle(g: InventoryGroupDTO) {
    const next = g.copies.find((id) => !pickedSet.has(id));
    if (next && picked.length < MAX_CARDS) onChange([...picked, next]);
    else onChange(picked.filter((id) => !g.copies.includes(id)));
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-3xl bg-white/[0.03] p-4 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <span className="text-xs text-zinc-400">
          {picked.length}/{MAX_CARDS} cards · <CoinAmount value={value} />
        </span>
      </div>
      <SearchInput value={query} onChange={setQuery} placeholder="Search..." />
      {groups == null ? (
        <div className="flex h-40 items-center justify-center text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : groups.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">No tradeable cards.</p>
      ) : (
        <div className="grid max-h-80 grid-cols-4 gap-2 overflow-y-auto p-1 sm:grid-cols-5">
          {shown.map((g) => {
            const n = countIn(g);
            return (
              <CardThumb
                key={g.key}
                card={g.card}
                value={g.value}
                selected={n > 0}
                badge={g.copies.length > 1 ? `${n}/${g.copies.length}` : undefined}
                onClick={() => toggle(g)}
              />
            );
          })}
        </div>
      )}
      <label className="flex items-center gap-2 text-xs text-zinc-400">
        <Coins className="h-4 w-4 text-amber-300" /> Coins
        <input
          type="number"
          min={0}
          max={maxCoins}
          value={coins}
          onChange={(e) => onCoins(Math.max(0, Math.min(maxCoins ?? Infinity, Math.floor(Number(e.target.value) || 0))))}
          className="w-32 rounded-xl bg-white/5 px-3 py-1.5 text-sm font-bold tabular-nums text-amber-200 ring-1 ring-white/10 focus:outline-none focus:ring-amber-400/60"
        />
      </label>
    </div>
  );
}

function Builder({ friends, initialFriend, onSent }: { friends: string[]; initialFriend: string | null; onSent: (m: string) => void }) {
  const { state, setState } = usePlayer();
  const [friend, setFriend] = useState(initialFriend && friends.includes(initialFriend) ? initialFriend : (friends[0] ?? ""));
  const [inv, setInv] = useState<{ mine: InventoryGroupDTO[]; theirs: InventoryGroupDTO[] } | null>(null);
  const [offer, setOffer] = useState<string[]>([]);
  const [request, setRequest] = useState<string[]>([]);
  const [offerCoins, setOfferCoins] = useState(0);
  const [requestCoins, setRequestCoins] = useState(0);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!friend) return;
    setInv(null);
    setRequest([]);
    setRequestCoins(0);
    fetch(`/api/trades?inventory=1&with=${encodeURIComponent(friend)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => (d.error ? setError(d.error) : setInv({ mine: d.mine, theirs: d.theirs })))
      .catch(() => setError("Could not load the cards"));
  }, [friend]);

  async function send() {
    setBusy(true);
    setError(null);
    const res = await postJson<{ state?: PlayerState }>("/api/trades", {
      action: "create",
      to: friend,
      offer,
      request,
      offerCoins,
      requestCoins,
      message,
    });
    setBusy(false);
    if (res.state) setState(res.state);
    if (res.error) return setError(res.error);
    sfx.deal();
    setOffer([]);
    setRequest([]);
    setOfferCoins(0);
    setRequestCoins(0);
    setMessage("");
    onSent(`Offer sent to ${friend}`);
  }

  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-white/[0.03] p-8 text-center ring-1 ring-white/10">
        <UserPlus className="h-8 w-8 text-zinc-500" />
        <p className="text-sm text-zinc-400">Trades are between friends. Add someone first.</p>
        <Link href="/friends" className="rounded-full bg-accent-500 px-5 py-2 text-sm font-bold text-white">
          Find friends
        </Link>
      </div>
    );
  }

  const empty = offer.length + request.length === 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-zinc-400">Trade with</span>
        <Select label="Friend" value={friend} onChange={setFriend} options={friends.map((f) => ({ value: f, label: f }))} />
      </div>
      <div className="flex flex-col gap-4 lg:flex-row">
        <Picker
          title="You give"
          groups={inv?.mine ?? null}
          picked={offer}
          onChange={setOffer}
          coins={offerCoins}
          onCoins={setOfferCoins}
          maxCoins={state?.coins}
        />
        <Picker title={`You ask ${friend}`} groups={inv?.theirs ?? null} picked={request} onChange={setRequest} coins={requestCoins} onCoins={setRequestCoins} />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 140))}
          placeholder="Add a message (optional)"
          className="min-w-0 flex-1 rounded-full bg-white/5 px-4 py-2.5 text-sm text-zinc-100 ring-1 ring-white/10 placeholder:text-zinc-500 focus:outline-none focus:ring-accent-400/60"
        />
        <button
          onClick={send}
          disabled={busy || empty || !friend}
          className="flex items-center justify-center gap-2 rounded-full bg-accent-500 hover:bg-accent-400 px-6 py-2.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send offer
        </button>
      </div>
      {error && <p className="text-sm text-rose-400">{error}</p>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

export function TradesView() {
  const { state, setState } = usePlayer();
  const { toasts, push } = useToasts();
  const router = useRouter();
  const params = useSearchParams();
  const withFriend = params.get("with");
  const [data, setData] = useState<TradesData | null>(null);
  const [friends, setFriends] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [trades, f] = await Promise.all([
      fetch("/api/trades", { cache: "no-store" }).then((r) => r.json() as Promise<TradesData>),
      fetch("/api/friends", { cache: "no-store" }).then((r) => r.json() as Promise<{ friends: { username: string }[] }>),
    ]);
    setData(trades);
    setState(trades.state);
    setFriends(f.friends.map((x) => x.username));
  }, [setState]);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: "accept" | "decline" | "cancel", t: TradeDTO) {
    setBusy(true);
    const res = await postJson<{ message?: string; state?: PlayerState }>("/api/trades", { action, tradeId: t.id });
    setBusy(false);
    if (res.state) setState(res.state);
    if (res.error) push(res.error, "error");
    else {
      if (action === "accept") sfx.reveal("Legendary");
      push(res.message ?? "Done", "success");
    }
    void load();
  }

  if (state && !state.username) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
        <ArrowLeftRight className="h-10 w-10 text-zinc-500" />
        <p className="text-zinc-400">Create an account to add friends and trade cards with them.</p>
        <Link href="/login" className="rounded-full bg-accent-500 px-5 py-2.5 text-sm font-bold text-white">
          Sign up
        </Link>
      </div>
    );
  }

  if (!data || !friends) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const section = "text-sm font-bold uppercase tracking-wider text-zinc-400";
  return (
    <div className="space-y-10">
      {data.incoming.length > 0 && (
        <section className="space-y-3">
          <h2 className={section}>Offers for you · {data.incoming.length}</h2>
          <AnimatePresence mode="popLayout">
            {data.incoming.map((t) => (
              <OfferCard key={t.id} t={t} busy={busy} onAct={act} />
            ))}
          </AnimatePresence>
        </section>
      )}

      <section className="space-y-3">
        <h2 className={section}>New offer</h2>
        <Builder
          friends={friends}
          initialFriend={withFriend}
          onSent={(m) => {
            push(m, "success");
            router.replace("/trades");
            void load();
          }}
        />
      </section>

      {data.outgoing.length > 0 && (
        <section className="space-y-3">
          <h2 className={section}>Sent offers · {data.outgoing.length}</h2>
          <AnimatePresence mode="popLayout">
            {data.outgoing.map((t) => (
              <OfferCard key={t.id} t={t} busy={busy} onAct={act} />
            ))}
          </AnimatePresence>
        </section>
      )}

      {data.history.length > 0 && (
        <section className="space-y-3">
          <h2 className={section}>History</h2>
          {data.history.map((t) => (
            <OfferCard key={t.id} t={t} busy={busy} onAct={act} />
          ))}
        </section>
      )}
      <ToastStack toasts={toasts} />
    </div>
  );
}
