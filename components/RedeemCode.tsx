"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Coins, CreditCard, Ticket } from "lucide-react";
import { COIN_PACKS } from "@/lib/coinPacks";
import type { PlayerState } from "@/lib/packs";
import { usePlayer } from "./PlayerProvider";
import { postJson } from "./ui";

const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

/** Popover under the coin chip: buy CineCoins with crypto (NOWPayments), or type a promo code. */
export function RedeemCode({ open, onClose, onOpen }: { open: boolean; onClose: () => void; onOpen: () => void }) {
  const { setState } = usePlayer();
  const box = useRef<HTMLFormElement>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  // Back from NOWPayments (?checkout=pending): the IPN credits the coins once the network
  // confirms, so the balance is reloaded every 20 s for 10 minutes until it goes up
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("checkout")) return;
    params.delete("checkout");
    window.history.replaceState(null, "", window.location.pathname + (params.size ? `?${params}` : ""));
    onOpen();
    setMessage({ text: "Payment sent! Your CineCoins arrive as soon as it's confirmed (a few minutes)", ok: true });
    let start: number | null = null;
    let tries = 0;
    const timer = window.setInterval(async () => {
      const res = await fetch("/api/player", { cache: "no-store" });
      if (!res.ok) return;
      const next = (await res.json()) as PlayerState;
      if (start == null) start = next.coins;
      setState(next);
      if (next.coins > start || ++tries >= 30) window.clearInterval(timer);
    }, 20_000);
    return () => window.clearInterval(timer);
  }, [setState, onOpen]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.parentElement?.contains(e.target as Node) && onClose();
    window.addEventListener("mousedown", close);
    return () => {
      window.removeEventListener("mousedown", close);
      setMessage(null);
    };
  }, [open, onClose]);

  async function buy(pack: string) {
    if (buying) return;
    setBuying(pack);
    setMessage(null);
    const res = await postJson<{ url?: string }>("/api/checkout", { pack });
    if (res.url) return void (window.location.href = res.url);
    setBuying(null);
    setMessage({ text: res.error ?? "Payment unavailable", ok: false });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    const res = await postJson<{ coins?: number; unlimited?: boolean; state?: PlayerState }>("/api/codes", { code });
    setBusy(false);
    if (res.state) setState(res.state);
    if (res.error) return setMessage({ text: res.error, ok: false });
    setCode("");
    const text = res.unlimited
        ? "Unlimited CineCoins unlocked!"
      : res.coins
        ? `+${res.coins.toLocaleString("en-US")} CineCoins!`
        : "Unlimited CineCoins turned off";
    setMessage({ text, ok: true });
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.form
          ref={box}
          onSubmit={submit}
          initial={{ opacity: 0, y: -6, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -6 }}
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl bg-zinc-950/95 p-3 shadow-2xl ring-1 ring-white/10 backdrop-blur"
        >
          <p className="flex items-center gap-1.5 text-xs font-semibold text-zinc-300">
            <CreditCard className="h-3.5 w-3.5 text-amber-300" /> Buy CineCoins
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {COIN_PACKS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => buy(p.id)}
                disabled={buying != null}
                className="flex flex-col items-center rounded-xl bg-amber-400/10 px-2 py-2 ring-1 ring-amber-400/25 transition-colors hover:bg-amber-400/20 disabled:opacity-40"
              >
                <span className="flex items-center gap-1 text-sm font-black tabular-nums text-amber-300">
                  <Coins className="h-3.5 w-3.5" /> {p.coins.toLocaleString("en-US")}
                </span>
                <span className="text-[11px] font-semibold text-zinc-400">{buying === p.id ? "..." : euros(p.cents)}</span>
              </button>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 border-t border-white/10 pt-3 text-xs font-semibold text-zinc-300">
            <Ticket className="h-3.5 w-3.5 text-amber-300" /> Redeem a code
          </p>
          <div className="mt-2 flex gap-1.5">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CODE"
              className="min-w-0 flex-1 rounded-xl bg-white/5 px-3 py-1.5 text-sm uppercase text-white ring-1 ring-white/10 placeholder:text-zinc-600 focus:outline-none focus:ring-amber-400/50"
            />
            <button
              disabled={busy || !code.trim()}
              className="rounded-xl bg-amber-400 px-3 py-1.5 text-xs font-bold text-black hover:bg-amber-300 disabled:opacity-40"
            >
              {busy ? "..." : "Redeem"}
            </button>
          </div>
          {message && <p className={`mt-2 text-xs font-semibold ${message.ok ? "text-emerald-400" : "text-rose-400"}`}>{message.text}</p>}
        </motion.form>
      )}
    </AnimatePresence>
  );
}
