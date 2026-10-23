"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, Bell, CheckCheck, Clock, Coins, Gavel, Star, Swords, Trophy, UserPlus, Users } from "lucide-react";
import type { NotificationDTO, NotificationKind } from "@/lib/notifications";
import type { PlayerState } from "@/lib/packs";
import { sfx } from "@/lib/sfx";
import { usePlayer } from "./PlayerProvider";
import { postJson } from "./ui";

const POLL_MS = 60_000;
const MARKET_KINDS = new Set<NotificationKind>(["outbid", "won", "sold", "expired"]);

const KIND: Record<NotificationKind, { icon: typeof Bell; color: string }> = {
  outbid: { icon: Gavel, color: "text-rose-300 bg-rose-500/15" },
  won: { icon: Trophy, color: "text-emerald-300 bg-emerald-500/15" },
  sold: { icon: Coins, color: "text-amber-300 bg-amber-400/15" },
  expired: { icon: Clock, color: "text-zinc-300 bg-white/10" },
  battle_invite: { icon: Swords, color: "text-amber-300 bg-amber-400/15" },
  battle_result: { icon: Swords, color: "text-accent-300 bg-accent-500/15" },
  friend_request: { icon: UserPlus, color: "text-accent-300 bg-accent-500/15" },
  friend_accepted: { icon: Users, color: "text-emerald-300 bg-emerald-500/15" },
  trade_offer: { icon: ArrowLeftRight, color: "text-fuchsia-300 bg-fuchsia-500/15" },
  trade_accepted: { icon: ArrowLeftRight, color: "text-emerald-300 bg-emerald-500/15" },
  trade_declined: { icon: ArrowLeftRight, color: "text-zinc-300 bg-white/10" },
  favorite_listed: { icon: Star, color: "text-amber-300 bg-amber-400/15" },
};

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

function Row({ n, onClick }: { n: NotificationDTO; onClick?: () => void }) {
  const { icon: Icon, color } = KIND[n.kind] ?? KIND.expired;
  return (
    <button onClick={onClick} className="flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-white/5">
      <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${color}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block text-sm leading-snug ${n.read ? "text-zinc-300" : "font-semibold text-white"}`}>{n.title}</span>
        {n.body && <span className="mt-0.5 block text-xs leading-snug text-zinc-500">{n.body}</span>}
        <span className="mt-1 block text-[10px] uppercase tracking-wider text-zinc-600">{ago(n.createdAt)}</span>
      </span>
      {!n.read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-fuchsia-400" />}
    </button>
  );
}

/**
 * Navbar bell. Polls every 15s (which also ticks the market server-side), pops a toast for
 * anything new and keeps the coin balance fresh when a sale lands while you're elsewhere.
 */
export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const { setState } = usePlayer();
  const [items, setItems] = useState<NotificationDTO[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [popups, setPopups] = useState<NotificationDTO[]>([]);
  const seen = useRef<Set<string> | null>(null);
  const box = useRef<HTMLDivElement>(null);

  const poll = useCallback(async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" }).catch(() => null);
    if (!res?.ok) return;
    const data = (await res.json()) as { items: NotificationDTO[]; unread: number; state: PlayerState };
    setItems(data.items);
    setUnread(data.unread);
    setState(data.state);

    // The first load only fills `seen`; later, unread items we haven't seen pop up
    // The market page already toasts its own auction events
    const onMarket = pathRef.current === "/";
    const fresh = seen.current
      ? data.items.filter((n) => !n.read && !seen.current!.has(n.id) && !(onMarket && MARKET_KINDS.has(n.kind)))
      : [];
    seen.current = new Set(data.items.map((n) => n.id));
    if (fresh.length) {
      setPopups((p) => [...fresh.slice(0, 3), ...p].slice(0, 3));
      if (fresh.some((n) => n.kind === "sold" || n.kind === "won")) sfx.coin();
      else sfx.flip();
    }
  }, [setState]);

  useEffect(() => {
    void poll();
    const id = setInterval(() => document.visibilityState === "visible" && void poll(), POLL_MS);
    const onFocus = () => void poll();
    window.addEventListener("focus", onFocus);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
  }, [poll]);

  // Popups fade on their own
  useEffect(() => {
    if (popups.length === 0) return;
    const id = setTimeout(() => setPopups((p) => p.slice(0, -1)), 6000);
    return () => clearTimeout(id);
  }, [popups]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  async function markAllRead() {
    setUnread(0);
    const res = await postJson<{ state?: PlayerState }>("/api/notifications", {});
    if (res.state) setState(res.state);
  }

  function toggle() {
    const next = !open;
    setOpen(next);
    // Opening the panel counts as reading; items keep their bold style until the next poll
    if (next && unread > 0) void markAllRead();
  }

  function go(n: NotificationDTO) {
    setOpen(false);
    setPopups((p) => p.filter((x) => x.id !== n.id));
    if (!n.read) void postJson("/api/notifications", { ids: [n.id] });
    if (n.link) router.push(n.link);
  }

  return (
    <div ref={box} className="relative">
      <button
        onClick={toggle}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        aria-expanded={open}
        className="relative rounded-full p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
      >
        <motion.span key={unread} animate={unread ? { rotate: [0, -18, 14, -8, 0] } : undefined} transition={{ duration: 0.6 }} className="block">
          <Bell className="h-4 w-4" />
        </motion.span>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-fuchsia-500 px-1 text-[9px] font-black text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="fixed inset-x-4 top-16 rounded-2xl bg-zinc-950/95 p-1.5 shadow-2xl ring-1 ring-white/10 backdrop-blur sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96"
          >
            <div className="flex items-center justify-between px-3 py-2">
              <p className="text-sm font-bold text-white">Notifications</p>
              {items.some((n) => !n.read) && (
                <button onClick={markAllRead} className="flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-200">
                  <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                </button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-3 py-8 text-center text-sm text-zinc-500">
                  Nothing yet. Bids, sales, battles and trades show up here.
                </p>
              ) : (
                items.map((n) => <Row key={n.id} n={n} onClick={() => go(n)} />)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New notification popups */}
      <div className="pointer-events-none fixed right-4 top-16 z-[60] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        <AnimatePresence>
          {popups.map((n) => (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40 }}
              className="pointer-events-auto rounded-2xl bg-zinc-900/95 shadow-2xl ring-1 ring-fuchsia-400/30 backdrop-blur"
            >
              <Row n={n} onClick={() => go(n)} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
