"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Coins, Info, Minus, Search, TrendingDown, TrendingUp, X } from "lucide-react";
import type { Rarity } from "@/lib/cards";
import type { Trend } from "@/lib/economy";

/* ------------------------------------------------------------------ */
/*  Coins                                                              */
/* ------------------------------------------------------------------ */

export function CoinAmount({ value, className = "" }: { value: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 font-bold tabular-nums text-amber-300 ${className}`}>
      <Coins className="h-[1em] w-[1em]" />
      {value.toLocaleString("en-US")}
    </span>
  );
}

export function TrendIcon({ trend }: { trend: Trend }) {
  if (trend > 0) return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" aria-label="Price rising" />;
  if (trend < 0) return <TrendingDown className="h-3.5 w-3.5 text-rose-400" aria-label="Price falling" />;
  return <Minus className="h-3.5 w-3.5 text-zinc-500" aria-label="Price stable" />;
}

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 60, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-t-3xl bg-zinc-950/95 p-5 ring-1 ring-white/10 sm:rounded-3xl sm:p-7"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 z-10 rounded-full p-2 text-zinc-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------------------ */
/*  Toasts                                                             */
/* ------------------------------------------------------------------ */

type Tone = "info" | "success" | "error";
interface Toast {
  id: number;
  text: string;
  tone: Tone;
}

export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Tone = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000);
  }, []);
  return { toasts, push };
}

const TONES: Record<Tone, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: "bg-zinc-900/95 text-zinc-100 ring-white/15" },
  success: { icon: CheckCircle2, className: "bg-emerald-950/95 text-emerald-200 ring-emerald-500/40" },
  error: { icon: AlertCircle, className: "bg-rose-950/95 text-rose-200 ring-rose-500/40" },
};

export function ToastStack({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-4 left-4 right-4 z-[60] flex flex-col items-center gap-2 sm:left-auto sm:items-end">
      <AnimatePresence>
        {toasts.map((t) => {
          const { icon: Icon, className } = TONES[t.tone];
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className={`flex max-w-sm items-center gap-2 rounded-xl px-4 py-3 text-sm shadow-xl ring-1 backdrop-blur ${className}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {t.text}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Filters                                                            */
/* ------------------------------------------------------------------ */

const RARITY_CHIP: Record<Rarity, string> = {
  Mythic: "data-[on=true]:bg-gradient-to-r data-[on=true]:from-amber-300 data-[on=true]:to-fuchsia-500 data-[on=true]:text-black",
  Legendary: "data-[on=true]:bg-amber-400 data-[on=true]:text-black",
  Rare: "data-[on=true]:bg-violet-500 data-[on=true]:text-white",
  Common: "data-[on=true]:bg-zinc-500 data-[on=true]:text-white",
};

export const RARITIES: Rarity[] = ["Mythic", "Legendary", "Rare", "Common"];

export function RarityChips({ value, onChange }: { value: Rarity | "all"; onChange: (v: Rarity | "all") => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        data-on={value === "all"}
        onClick={() => onChange("all")}
        className="rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 ring-1 ring-white/10 data-[on=true]:bg-white data-[on=true]:text-black"
      >
        All
      </button>
      {RARITIES.map((r) => (
        <button
          key={r}
          data-on={value === r}
          onClick={() => onChange(value === r ? "all" : r)}
          className={`rounded-full bg-white/5 px-3 py-1.5 text-xs font-semibold text-zinc-300 ring-1 ring-white/10 ${RARITY_CHIP[r]}`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="relative flex min-w-0 flex-1 items-center">
      <Search className="pointer-events-none absolute left-3 h-4 w-4 text-zinc-500" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-full bg-white/5 py-2 pl-9 pr-4 text-sm text-zinc-100 ring-1 ring-white/10 placeholder:text-zinc-500 focus:outline-none focus:ring-violet-400/60"
      />
    </label>
  );
}

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-full bg-white/5 px-3 py-2 text-sm text-zinc-200 ring-1 ring-white/10 focus:outline-none focus:ring-violet-400/60 [&>option]:bg-zinc-900"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** POST JSON helper used by every action button. */
export async function postJson<T>(url: string, body: unknown): Promise<T & { error?: string }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return res.json();
}
