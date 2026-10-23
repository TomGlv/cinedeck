"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, Crown, Eye, Globe, Hourglass, Loader2, RotateCcw, Skull, Swords, Trophy, User, UserPlus, Users, X } from "lucide-react";
import {
  BATTLE_PACKS,
  type BattleDTO,
  type BattleMode,
  type BattleOpponent,
  type BattlePack,
  type BattleSide,
  type BattlesDTO,
} from "@/lib/economy";
import { PACKS, packChanceAtLeast, type PlayerState } from "@/lib/packs";
import { sfx } from "@/lib/sfx";
import { MovieCard } from "../MovieCard";
import { CardBack } from "../pack/CardBack";
import { usePlayer } from "../PlayerProvider";
import { CoinAmount, ToastStack, postJson, useToasts } from "../ui";

const ROUND_MS = 1300;
const POLL_MS = 4000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const MODES: { id: BattleMode; label: string; hint: string }[] = [
  { id: "classic", label: "Classic", hint: "Highest total value wins" },
  { id: "underdog", label: "Underdog", hint: "Lowest total value wins" },
];

const OPPONENTS: { id: BattleOpponent; label: string; hint: string; icon: typeof Bot }[] = [
  { id: "bot", label: "Bot", hint: "Instant", icon: Bot },
  { id: "open", label: "Random player", hint: "Public lobby, a bot steps in after 90s", icon: Globe },
  { id: "friend", label: "Friend", hint: "Private challenge", icon: Users },
];

const modeLabel = (m: BattleMode) => (m === "classic" ? "Classic" : "Underdog");

/* ------------------------------------------------------------------ */
/*  Arena (replay of a finished battle)                                */
/* ------------------------------------------------------------------ */

function Slot({ side, index, revealed, winning }: { side: BattleSide; index: number; revealed: boolean; winning: boolean }) {
  const { card, value } = side.cards[index];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative aspect-[2/3] w-full [perspective:1000px]">
        <motion.div
          className="relative h-full w-full"
          style={{ transformStyle: "preserve-3d" }}
          initial={false}
          animate={{ rotateY: revealed ? 180 : 0 }}
          transition={{ type: "spring", stiffness: 90, damping: 14 }}
        >
          <div className="absolute inset-0 [backface-visibility:hidden]">
            <CardBack />
          </div>
          <div className="absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)]">
            <MovieCard card={card} clickable={revealed} />
          </div>
        </motion.div>
      </div>
      <span
        className={`rounded-full px-2 py-0.5 text-[11px] ring-1 transition-colors ${
          !revealed ? "opacity-0" : winning ? "bg-emerald-500/15 ring-emerald-500/40" : "bg-white/5 ring-white/10"
        }`}
      >
        <CoinAmount value={value} />
      </span>
    </div>
  );
}

function SideRow({ side, isYou, revealed, wins }: { side: BattleSide; isYou: boolean; revealed: number; wins: boolean[] }) {
  const total = side.cards.slice(0, revealed).reduce((sum, c) => sum + c.value, 0);
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-bold text-white">
          {isYou ? <User className="h-4 w-4 text-emerald-300" /> : <Swords className="h-4 w-4 text-rose-300" />}
          {isYou ? `You (${side.name})` : side.name}
        </span>
        <motion.span key={total} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-lg">
          <CoinAmount value={total} />
        </motion.span>
      </div>
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {side.cards.map((_, i) => (
          <Slot key={i} side={side} index={i} revealed={i < revealed} winning={wins[i]} />
        ))}
      </div>
    </div>
  );
}

function Arena({ battle, onClose }: { battle: BattleDTO; onClose: () => void }) {
  const [revealed, setRevealed] = useState(0);
  const [done, setDone] = useState(false);
  const skip = useRef(false);
  const you = battle.you!;
  const opponent = battle.opponent!;

  useEffect(() => {
    let alive = true;
    (async () => {
      await sleep(400);
      for (let i = 1; i <= 5 && alive; i++) {
        await sleep(skip.current ? 60 : ROUND_MS);
        sfx.flip();
        setRevealed(i);
      }
      await sleep(skip.current ? 100 : 800);
      if (!alive) return;
      if (battle.won) sfx.reveal("Legendary");
      else sfx.shake();
      setDone(true);
    })();
    return () => {
      alive = false;
    };
  }, [battle]);

  const better = (a: number, b: number) => (battle.mode === "classic" ? a >= b : a <= b);
  const youWins = you.cards.map((c, i) => better(c.value, opponent.cards[i].value));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <SideRow side={opponent} isYou={false} revealed={revealed} wins={youWins.map((w) => !w)} />
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-white/10" />
        <span className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.3em] text-zinc-500">
          <Swords className="h-4 w-4" /> {PACKS[battle.pack].name} · {battle.mode === "classic" ? "Highest wins" : "Lowest wins"}
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>
      <SideRow side={you} isYou revealed={revealed} wins={youWins} />

      <AnimatePresence>
        {done ? (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex flex-col items-center gap-4 rounded-3xl p-6 text-center ring-1 ${
              battle.won ? "bg-emerald-500/10 ring-emerald-500/40" : "bg-rose-500/10 ring-rose-500/30"
            }`}
          >
            {battle.won ? <Trophy className="h-10 w-10 text-emerald-300" /> : <Skull className="h-10 w-10 text-rose-300" />}
            <div>
              <p className="text-2xl font-black text-white">{battle.won ? "You win!" : `${opponent.name} wins`}</p>
              <p className="mt-1 text-sm text-zinc-300">
                {you.total.toLocaleString("en-US")} vs {opponent.total.toLocaleString("en-US")}.{" "}
                {battle.won
                  ? `All 10 cards, worth ${(you.total + opponent.total).toLocaleString("en-US")} coins, are in your collection.`
                  : `${opponent.name} takes all 10 cards.`}
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <button onClick={onClose} className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-black">
                <RotateCcw className="h-4 w-4" /> Back to battles
              </button>
              {battle.won && (
                <Link
                  href="/collection"
                  className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-zinc-100 ring-1 ring-white/15"
                >
                  <Crown className="h-4 w-4" /> View collection
                </Link>
              )}
            </div>
          </motion.div>
        ) : (
          <div className="flex justify-center">
            <button
              onClick={() => (skip.current = true)}
              className="rounded-full bg-white/5 px-4 py-2 text-xs font-semibold text-zinc-300 ring-1 ring-white/10 hover:bg-white/10"
            >
              Skip animation
            </button>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Lobby                                                              */
/* ------------------------------------------------------------------ */

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Bot; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white/[0.03] p-4 ring-1 ring-white/10 sm:p-5">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-zinc-400">
        <Icon className="h-4 w-4" /> {title}
      </h2>
      {children}
    </section>
  );
}

function BattleRow({ b, children }: { b: BattleDTO; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">
          {PACKS[b.pack].name} · {modeLabel(b.mode)}
        </p>
        <p className="truncate text-xs text-zinc-500">
          {b.isCreator ? (b.invitedName ? `Challenge to ${b.invitedName}` : "Your public lobby") : `by ${b.creatorName}`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

export function BoosterBattle() {
  const { state, setState } = usePlayer();
  const { toasts, push } = useToasts();
  const params = useSearchParams();
  const [data, setData] = useState<BattlesDTO | null>(null);
  const [pack, setPack] = useState<BattlePack>("premium");
  const [mode, setMode] = useState<BattleMode>("classic");
  const [opponent, setOpponent] = useState<BattleOpponent>(params.get("friend") ? "friend" : "bot");
  const [friend, setFriend] = useState(params.get("friend") ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [watching, setWatching] = useState<BattleDTO | null>(null);
  const prevWaiting = useRef<Set<string> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/battles", { cache: "no-store" });
    if (!res.ok) return;
    const json = (await res.json()) as BattlesDTO;
    // A lobby of mine that left "waiting" and shows up in recent = someone (or a bot) played it
    if (prevWaiting.current) {
      for (const b of json.recent) {
        if (prevWaiting.current.has(b.id)) push(`${b.opponentName} joined your battle: you ${b.won ? "won" : "lost"}! Watch the replay below.`, b.won ? "success" : "error");
      }
    }
    prevWaiting.current = new Set(json.waiting.map((b) => b.id));
    setData(json);
    setState(json.state);
    if (!friend && json.friends[0]) setFriend(json.friends[0]);
  }, [push, setState, friend]);

  useEffect(() => {
    void load();
    const poll = setInterval(load, POLL_MS);
    return () => clearInterval(poll);
  }, [load]);

  async function act(key: string, body: object) {
    setBusy(key);
    const res = await postJson<{ battle?: BattleDTO; state?: PlayerState }>("/api/battles", body);
    setBusy(null);
    if (res.state) setState(res.state);
    if (res.error) {
      push(res.error, "error");
      return;
    }
    if (res.battle?.status === "done") watch(res.battle);
    else if (res.battle) push(res.battle.invitedName ? `Challenge sent to ${res.battle.invitedName}` : "Lobby open, waiting for an opponent...", "success");
    void load();
  }

  function watch(b: BattleDTO) {
    setWatching(b);
    if (b.isCreator) void postJson("/api/battles", { action: "seen", battleId: b.id });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (watching) {
    return (
      <>
        <Arena
          key={watching.id}
          battle={watching}
          onClose={() => {
            setWatching(null);
            void load();
          }}
        />
        <ToastStack toasts={toasts} />
      </>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const cost = PACKS[pack].cost;
  const tooPoor = !state || state.coins < cost;
  const needsFriend = opponent === "friend" && !friend;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Create */}
      <Section title="New battle" icon={Swords}>
        <div className="grid gap-3 sm:grid-cols-2">
          {BATTLE_PACKS.map((type) => {
            const def = PACKS[type];
            return (
              <button
                key={type}
                onClick={() => setPack(type)}
                className={`rounded-2xl p-4 text-left ring-2 transition-colors ${
                  pack === type ? "bg-amber-400/10 ring-amber-400" : "bg-white/[0.03] ring-white/10 hover:bg-white/[0.06]"
                }`}
              >
                <p className="flex items-center justify-between font-black text-white">
                  {def.name} <CoinAmount value={def.cost} className="text-sm" />
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {packChanceAtLeast(def, "Legendary").toFixed(0)}% Legendary+ · {packChanceAtLeast(def, "Mythic").toFixed(1)}% Mythic
                </p>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {OPPONENTS.map((o) => (
            <button
              key={o.id}
              onClick={() => setOpponent(o.id)}
              className={`flex items-start gap-2 rounded-2xl p-3 text-left ring-1 ${
                opponent === o.id ? "bg-white text-black ring-white" : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
              }`}
            >
              <o.icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <span className="block text-sm font-bold">{o.label}</span>
                <span className={`block text-xs ${opponent === o.id ? "text-zinc-600" : "text-zinc-500"}`}>{o.hint}</span>
              </span>
            </button>
          ))}
        </div>

        {opponent === "friend" &&
          (data.friends.length === 0 ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
              No friends yet.
              <Link href={state?.username ? "/friends" : "/login"} className="flex items-center gap-1 font-semibold text-amber-300 underline">
                <UserPlus className="h-4 w-4" /> {state?.username ? "Add friends" : "Create an account first"}
              </Link>
            </p>
          ) : (
            <select
              aria-label="Friend to challenge"
              value={friend}
              onChange={(e) => setFriend(e.target.value)}
              className="mt-3 w-full rounded-full bg-white/5 px-4 py-2 text-sm text-zinc-100 ring-1 ring-white/10 focus:outline-none [&>option]:bg-zinc-900"
            >
              {data.friends.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          ))}

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                title={m.hint}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                  mode === m.id ? "bg-white text-black ring-white" : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
                }`}
              >
                {m.label} · {m.hint}
              </button>
            ))}
          </div>
          <motion.button
            onClick={() => act("create", { action: "create", pack, mode, opponent, friend })}
            disabled={tooPoor || needsFriend || busy != null}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-400 to-amber-400 px-6 py-3 text-sm font-black text-black disabled:from-zinc-800 disabled:to-zinc-800 disabled:text-zinc-500"
          >
            {busy === "create" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Swords className="h-4 w-4" />}
            {tooPoor ? `Need ${(cost - (state?.coins ?? 0)).toLocaleString("en-US")} more coins` : `Battle for ${cost} coins`}
          </motion.button>
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Both sides open the same pack. Cards are scored at market value, the winner takes all 10 cards. Ties go to whoever opened the
          battle.
        </p>
      </Section>

      {data.invites.length > 0 && (
        <Section title="Challenges for you" icon={Users}>
          <div className="space-y-2">
            {data.invites.map((b) => (
              <BattleRow key={b.id} b={b}>
                <button
                  onClick={() => act(b.id, { action: "cancel", battleId: b.id })}
                  disabled={busy != null}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-200 ring-1 ring-white/15"
                >
                  Decline
                </button>
                <button
                  onClick={() => act(b.id, { action: "join", battleId: b.id })}
                  disabled={busy != null || (state?.coins ?? 0) < PACKS[b.pack].cost}
                  className="rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-black disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  Accept · {PACKS[b.pack].cost}
                </button>
              </BattleRow>
            ))}
          </div>
        </Section>
      )}

      {data.waiting.length > 0 && (
        <Section title="Waiting for an opponent" icon={Hourglass}>
          <div className="space-y-2">
            {data.waiting.map((b) => (
              <BattleRow key={b.id} b={b}>
                <Loader2 className="h-4 w-4 animate-spin text-zinc-500" />
                {!b.invitedName && (
                  <button
                    onClick={() => act(b.id, { action: "bot", battleId: b.id })}
                    disabled={busy != null}
                    className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-200 ring-1 ring-white/15"
                  >
                    <Bot className="h-3.5 w-3.5" /> Call a bot
                  </button>
                )}
                <button
                  onClick={() => act(b.id, { action: "cancel", battleId: b.id })}
                  disabled={busy != null}
                  className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-200 ring-1 ring-white/15"
                >
                  <X className="h-3.5 w-3.5" /> Cancel
                </button>
              </BattleRow>
            ))}
          </div>
        </Section>
      )}

      <Section title="Open lobbies" icon={Globe}>
        {data.open.length === 0 ? (
          <p className="text-sm text-zinc-500">No public lobby right now. Open one and another player can join it.</p>
        ) : (
          <div className="space-y-2">
            {data.open.map((b) => (
              <BattleRow key={b.id} b={b}>
                <button
                  onClick={() => act(b.id, { action: "join", battleId: b.id })}
                  disabled={busy != null || (state?.coins ?? 0) < PACKS[b.pack].cost}
                  className="flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1.5 text-xs font-bold text-black disabled:bg-zinc-800 disabled:text-zinc-500"
                >
                  {busy === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Swords className="h-3.5 w-3.5" />} Join ·{" "}
                  {PACKS[b.pack].cost}
                </button>
              </BattleRow>
            ))}
          </div>
        )}
      </Section>

      {data.recent.length > 0 && (
        <Section title="Recent battles" icon={Trophy}>
          <div className="space-y-2">
            {data.recent.map((b) => (
              <div
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-semibold text-white">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                        b.won ? "bg-emerald-400 text-black" : "bg-rose-500 text-white"
                      }`}
                    >
                      {b.won ? "Won" : "Lost"}
                    </span>
                    vs {b.opponent?.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {PACKS[b.pack].name} · {modeLabel(b.mode)} · {b.you?.total.toLocaleString("en-US")} vs{" "}
                    {b.opponent?.total.toLocaleString("en-US")}
                  </p>
                </div>
                <button
                  onClick={() => watch(b)}
                  className="flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-zinc-200 ring-1 ring-white/15 hover:bg-white/15"
                >
                  <Eye className="h-3.5 w-3.5" /> Watch
                </button>
              </div>
            ))}
          </div>
        </Section>
      )}
      <ToastStack toasts={toasts} />
    </div>
  );
}
