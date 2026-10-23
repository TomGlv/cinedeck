"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight, ChevronsUp, Library, Package, Scissors, Store, Swords, Trophy, UserRound } from "lucide-react";
import { LogoMark } from "./Logo";
import { usePlayer } from "./PlayerProvider";

const STORAGE_KEY = "cinedeck:guide-seen";
/** Any component can reopen the guide with `window.dispatchEvent(new Event(OPEN_GUIDE))`. */
export const OPEN_GUIDE = "cinedeck:open-guide";

interface Step {
  icon: typeof Package;
  title: string;
  body: string;
  /** Short facts shown as a list under the text */
  points: string[];
  href?: string;
  cta?: string;
}

const STEPS: Step[] = [
  {
    icon: Trophy,
    title: "Collect cinema's icons",
    body: "Every card is a movie, a series or an anime from TMDB. The best loved and most watched titles are the rarest.",
    points: ["All-time icons: Mythic", "Beloved blockbusters: Legendary", "Well-known hits: Rare, everything else Common"],
  },
  {
    icon: Package,
    title: "Open packs",
    body: "You get a free pack every 15 minutes, plus a few CineCoins. Bigger packs cost CineCoins and hit harder.",
    points: ["Swipe across a pack to cut it open", "The best card is always revealed last", "Any card can come out Foil, Polychrome or Negative"],
    href: "/packs",
    cta: "Open my free pack",
  },
  {
    icon: Library,
    title: "Build your collection",
    body: "Complete sets and combos for CineCoins rewards. Duplicates can be quick sold in one click.",
    points: ["Open a card for its price history", "Pick a card as your profile picture from your profile page", "Star a card to be told when it goes on sale"],
    href: "/collection",
  },
  {
    icon: Store,
    title: "Trade on the market",
    body: "Buy cards at market price, auction your own, or swap directly with friends. Prices follow real sales.",
    points: ["Set a max bid, we outbid others for you", "5% tax on every sale", "The Upgrader burns cheap cards for a shot at a better one"],
    href: "/market",
  },
  {
    icon: Swords,
    title: "Battle for all ten cards",
    body: "Both sides open the same pack. The higher total market value takes all ten cards. A tie spins the roulette.",
    points: ["Fight a bot instantly", "Open a public lobby", "Or challenge a friend"],
    href: "/battles",
  },
];

const ICONS_STRIP = [Package, Scissors, Library, Store, ChevronsUp, Swords];

/** First-visit walkthrough of the game. Reopened from the navbar's "?" button. */
export function Onboarding() {
  const pathname = usePathname();
  const { state } = usePlayer();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (pathname === "/age") return;
    let seen = false;
    try {
      seen = localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      // Storage blocked: show it, the close button still works
    }
    if (!seen) setOpen(true);
  }, [pathname]);

  useEffect(() => {
    const show = () => {
      setStep(0);
      setOpen(true);
    };
    window.addEventListener(OPEN_GUIDE, show);
    return () => window.removeEventListener(OPEN_GUIDE, show);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      // ignore
    }
  }, []);

  const last = step === STEPS.length - 1;
  const next = useCallback(() => (last ? close() : setStep((s) => s + 1)), [last, close]);
  const back = useCallback(() => setStep((s) => Math.max(0, s - 1)), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") back();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close, next, back]);

  const s = STEPS[step];
  const Icon = s.icon;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 28 }}
            className="relative grid w-full max-w-3xl overflow-hidden rounded-t-[28px] bg-zinc-950 ring-1 ring-white/10 sm:grid-cols-[0.9fr_1.1fr] sm:rounded-[28px]"
          >
            {/* Left: big step number over the accent panel */}
            <div className="relative hidden overflow-hidden bg-accent-900 p-8 sm:block">
              <div
                aria-hidden
                className="absolute inset-0 opacity-70"
                style={{ background: "radial-gradient(circle at 20% 15%, rgba(204,93,109,0.55), transparent 55%), radial-gradient(circle at 90% 90%, rgba(212,176,106,0.25), transparent 50%)" }}
              />
              <div className="relative flex h-full flex-col justify-between">
                <span className="flex items-center gap-2 text-sm text-accent-100/80">
                  <LogoMark className="h-6 w-6" /> How to play
                </span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={step}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="font-display text-[9rem] font-extrabold leading-none tracking-[-0.06em] text-white/90"
                  >
                    {String(step + 1).padStart(2, "0")}
                  </motion.span>
                </AnimatePresence>
                <div className="flex gap-2 text-accent-200/60">
                  {ICONS_STRIP.map((I, i) => (
                    <I key={i} className="h-4 w-4" />
                  ))}
                </div>
              </div>
            </div>

            {/* Right: the step */}
            <div className="flex min-h-[420px] flex-col p-6 sm:p-8">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-[0.28em] text-accent-400">
                  Step {step + 1} of {STEPS.length}
                </span>
                <button onClick={close} className="text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-200">
                  Skip
                </button>
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -24 }}
                  transition={{ duration: 0.25 }}
                  className="mt-6 flex-1"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-500/15 text-accent-300 ring-1 ring-accent-400/30">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h2 id="guide-title" className="mt-4 font-display text-3xl font-bold leading-tight tracking-[-0.03em] text-white">
                    {s.title}
                  </h2>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">{s.body}</p>
                  <ul className="mt-5 space-y-2">
                    {s.points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-sm text-zinc-200">
                        <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rotate-45 bg-accent-400" />
                        {p}
                      </li>
                    ))}
                  </ul>
                  {last && !state?.username && (
                    <p className="mt-5 flex items-center gap-2 rounded-xl bg-white/5 p-3 text-sm text-zinc-300 ring-1 ring-white/10">
                      <UserRound className="h-4 w-4 shrink-0 text-accent-300" />
                      <span>
                        <Link href="/login" onClick={close} className="font-semibold text-accent-300 underline-offset-2 hover:underline">
                          Create an account
                        </Link>{" "}
                        to keep your cards on any device and add friends.
                      </span>
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>

              {/* Progress */}
              <div className="mt-6 flex gap-1.5">
                {STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i)}
                    aria-label={`Step ${i + 1}`}
                    className={`h-1 flex-1 rounded-full transition-colors ${i <= step ? "bg-accent-400" : "bg-white/10"}`}
                  />
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <button
                  onClick={back}
                  disabled={step === 0}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-zinc-400 transition-colors hover:text-zinc-100 disabled:invisible"
                >
                  <ArrowLeft className="h-4 w-4" /> Back
                </button>
                <div className="flex items-center gap-2">
                  {s.href && s.cta && (
                    <Link
                      href={s.href}
                      onClick={close}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-300 underline-offset-4 transition-colors hover:text-white hover:underline"
                    >
                      {s.cta}
                    </Link>
                  )}
                  <button
                    onClick={next}
                    className="flex items-center gap-1.5 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white transition-[background-color,transform] hover:bg-accent-400 active:scale-[0.98]"
                  >
                    {last ? "Start playing" : "Next"} {!last && <ArrowRight className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
