"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftRight, LogOut, User, UserPlus, Users } from "lucide-react";
import { usePlayer } from "../PlayerProvider";
import { postJson } from "../ui";

/** Navbar account chip: "Sign up" for guests, a menu with profile / friends / log out otherwise. */
export function AccountMenu() {
  const router = useRouter();
  const { state, refresh } = usePlayer();
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  if (!state) return null;

  if (!state.username) {
    return (
      <Link
        href="/login"
        className="flex items-center gap-1.5 rounded-full bg-violet-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-400"
      >
        <UserPlus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Sign up</span>
      </Link>
    );
  }

  async function logout() {
    setOpen(false);
    await postJson("/api/auth/logout", {});
    await refresh();
    router.push("/");
    router.refresh();
  }

  const item = "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-200 hover:bg-white/10";

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-sm font-black uppercase text-white"
      >
        {state.username[0]}
        {state.friendRequests + state.tradeOffers > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-black">
            {state.friendRequests + state.tradeOffers}
          </span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute right-0 top-full mt-2 w-52 rounded-2xl bg-zinc-950/95 p-1.5 shadow-2xl ring-1 ring-white/10 backdrop-blur"
          >
            <p className="truncate px-3 py-2 text-xs text-zinc-500">
              Signed in as <b className="text-zinc-200">{state.username}</b>
            </p>
            <Link href={`/u/${state.username}`} onClick={() => setOpen(false)} className={item}>
              <User className="h-4 w-4" /> Profile
            </Link>
            <Link href="/friends" onClick={() => setOpen(false)} className={item}>
              <Users className="h-4 w-4" /> Friends
              {state.friendRequests > 0 && (
                <span className="ml-auto rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white">{state.friendRequests}</span>
              )}
            </Link>
            <Link href="/trades" onClick={() => setOpen(false)} className={item}>
              <ArrowLeftRight className="h-4 w-4" /> Trades
              {state.tradeOffers > 0 && (
                <span className="ml-auto rounded-full bg-rose-500 px-1.5 text-[10px] font-black text-white">{state.tradeOffers}</span>
              )}
            </Link>
            <button onClick={logout} className={`${item} text-rose-300`}>
              <LogOut className="h-4 w-4" /> Log out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
