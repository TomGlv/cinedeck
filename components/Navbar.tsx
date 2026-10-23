"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronsUp, CircleHelp, Coins, Gift, Library, Package, Store, Swords, Timer, Trophy, Volume2, VolumeX } from "lucide-react";
import { formatCountdown, useCountdown, usePlayer } from "./PlayerProvider";
import { isMuted, setMuted } from "@/lib/sfx";
import { AccountMenu } from "./account/AccountMenu";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { OPEN_GUIDE } from "./Onboarding";
import { RedeemCode } from "./RedeemCode";

const LINKS = [
  { href: "/market", label: "Market", icon: Store },
  { href: "/packs", label: "Packs", icon: Package },
  { href: "/collection", label: "Collection", icon: Library },
  { href: "/upgrade", label: "Upgrade", icon: ChevronsUp },
  { href: "/battles", label: "Battles", icon: Swords },
  { href: "/leaderboard", label: "Ranks", icon: Trophy },
];

export function Navbar() {
  const pathname = usePathname();
  const { state } = usePlayer();
  const remaining = useCountdown(state?.nextFreePackAt ?? null);
  const [muted, setMutedState] = useState(false);
  const [redeemOpen, setRedeemOpen] = useState(false);
  const closeRedeem = useCallback(() => setRedeemOpen(false), []);
  const openRedeem = useCallback(() => setRedeemOpen(true), []);

  // Floating "+50" / "-250" when the balance changes
  const prevCoins = useRef<number | null>(null);
  const [delta, setDelta] = useState<{ value: number; key: number } | null>(null);
  useEffect(() => {
    if (state == null) return;
    if (prevCoins.current != null && prevCoins.current !== state.coins && !state.unlimited) {
      setDelta({ value: state.coins - prevCoins.current, key: Date.now() });
    }
    prevCoins.current = state.coins;
  }, [state]);

  useEffect(() => {
    setMutedState(isMuted());
  }, []);

  function toggleMute() {
    setMuted(!muted);
    setMutedState(!muted);
  }

  return (
    <nav className="sticky top-0 z-40 px-3 pt-3 sm:px-4">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-2 rounded-full bg-black/60 pl-3 pr-2 shadow-[0_12px_40px_-12px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] ring-1 ring-white/10 backdrop-blur-xl sm:gap-3 sm:pl-4">
        <Link href="/" aria-label="CineDeck home" className="mr-2 shrink-0">
          <span className="hidden sm:inline">
            <Logo />
          </span>
          <span className="sm:hidden">
            <Logo compact />
          </span>
        </Link>

        {LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`relative flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-sm lg:px-3 transition-colors ${
              pathname === href ? "text-white" : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {pathname === href && (
              <motion.span layoutId="nav-pill" className="absolute inset-0 rounded-full bg-white/10 ring-1 ring-white/10" />
            )}
            <Icon className="relative h-4 w-4" />
            <span className="relative hidden lg:inline">{label}</span>
            {href === "/battles" && (state?.battleAlerts ?? 0) > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black text-white">
                {state?.battleAlerts}
              </span>
            )}
          </Link>
        ))}

        <div className="ml-auto flex items-center gap-2">
          {state && (
            <Link
              href="/packs"
              className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 sm:flex ${
                remaining === 0
                  ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
                  : "bg-white/5 text-zinc-400 ring-white/10"
              }`}
            >
              {remaining === 0 ? (
                <>
                  <Gift className="h-3.5 w-3.5 animate-bounce" /> Free pack ready
                </>
              ) : (
                <>
                  <Timer className="h-3.5 w-3.5" /> {formatCountdown(remaining)}
                </>
              )}
            </Link>
          )}

          <div className="relative">
            <button
              onClick={() => setRedeemOpen((o) => !o)}
              aria-label="Buy CineCoins or redeem a code"
              aria-expanded={redeemOpen}
              className="relative flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1.5 text-sm font-bold text-amber-300 ring-1 ring-amber-400/30 hover:bg-amber-400/20"
            >
              <Coins className="h-4 w-4" />
              <motion.span key={state?.coins} initial={{ scale: 1.4 }} animate={{ scale: 1 }} className="tabular-nums">
                {state ? (state.unlimited ? "∞" : state.coins.toLocaleString("en-US")) : "..."}
              </motion.span>
              <AnimatePresence>
                {delta && (
                  <motion.span
                    key={delta.key}
                    initial={{ opacity: 1, y: 0 }}
                    animate={{ opacity: 0, y: 26 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.4 }}
                    onAnimationComplete={() => setDelta(null)}
                    className={`absolute right-2 top-full text-xs font-black ${delta.value > 0 ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {delta.value > 0 ? `+${delta.value}` : delta.value}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
            <RedeemCode open={redeemOpen} onClose={closeRedeem} onOpen={openRedeem} />
          </div>

          <button
            onClick={toggleMute}
            aria-label={muted ? "Unmute sounds" : "Mute sounds"}
            className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            onClick={() => window.dispatchEvent(new Event(OPEN_GUIDE))}
            aria-label="How to play"
            className="rounded-full p-2 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
          >
            <CircleHelp className="h-4 w-4" />
          </button>
          <NotificationBell />
          <AccountMenu />
        </div>
      </div>
    </nav>
  );
}
