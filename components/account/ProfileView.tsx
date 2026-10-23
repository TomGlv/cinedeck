"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeftRight, Check, Clock, Pencil, Crown, Flame, Layers, Loader2, Swords, Trophy, UserPlus, Wallet } from "lucide-react";
import { cardKey } from "@/lib/finishes";
import type { PlayerState } from "@/lib/packs";
import type { ProfileDTO } from "@/lib/social";
import { Avatar } from "../Avatar";
import { OPEN_AVATAR_PICKER } from "./AvatarPicker";
import { MovieCard } from "../MovieCard";
import { usePlayer } from "../PlayerProvider";
import { CoinAmount, ToastStack, postJson, useToasts } from "../ui";

function Stat({ icon: Icon, label, value }: { icon: typeof Crown; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 text-lg font-black tabular-nums text-white">{value}</p>
    </div>
  );
}

export function ProfileView({ username }: { username: string }) {
  const { state, setState } = usePlayer();
  const { toasts, push } = useToasts();
  const [profile, setProfile] = useState<ProfileDTO | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/players/${encodeURIComponent(username)}`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? "Player not found");
    else setProfile(json);
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  async function addFriend() {
    const res = await postJson<{ message?: string; state?: PlayerState }>("/api/friends", { action: "add", username });
    if (res.state) setState(res.state);
    push(res.error ?? res.message ?? "", res.error ? "error" : "success");
    void load();
  }

  if (error) return <p className="py-20 text-center text-zinc-500">{error}</p>;
  if (!profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const { stats } = profile;
  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {profile.isMe ? (
            <button
              onClick={() => window.dispatchEvent(new Event(OPEN_AVATAR_PICKER))}
              aria-label="Change profile picture"
              className="group relative rounded-[30%] transition active:scale-[0.98]"
            >
              <Avatar name={profile.username} avatar={state?.avatar ?? profile.avatar} size="lg" />
              <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-accent-500 text-white ring-2 ring-zinc-950 transition group-hover:scale-110">
                <Pencil className="h-3.5 w-3.5" />
              </span>
            </button>
          ) : (
            <Avatar name={profile.username} avatar={profile.avatar} size="lg" />
          )}
          <div>
            <h1 className="font-display text-4xl font-bold leading-none tracking-[-0.03em] text-white sm:text-5xl">{profile.username}</h1>
            <p className="flex items-center gap-1 text-xs text-zinc-500">
              <Clock className="h-3 w-3" /> Joined {new Date(profile.joinedAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>
        {!profile.isMe && (
          <div className="flex gap-2">
            {profile.relation === "friends" ? (
              <>
                <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
                  <Check className="h-4 w-4" /> Friends
                </span>
                <Link
                  href={`/battles?friend=${encodeURIComponent(profile.username)}`}
                  className="flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-bold text-black"
                >
                  <Swords className="h-4 w-4" /> Challenge
                </Link>
                <Link
                  href={`/trades?with=${encodeURIComponent(profile.username)}`}
                  className="flex items-center gap-2 rounded-full bg-accent-500 px-4 py-2 text-sm font-bold text-white"
                >
                  <ArrowLeftRight className="h-4 w-4" /> Trade
                </Link>
              </>
            ) : profile.relation === "sent" ? (
              <span className="rounded-full bg-white/10 px-4 py-2 text-sm text-zinc-300">Request sent</span>
            ) : (
              <button onClick={addFriend} className="flex items-center gap-2 rounded-full bg-accent-500 px-4 py-2 text-sm font-bold text-white">
                <UserPlus className="h-4 w-4" /> {profile.relation === "received" ? "Accept friend request" : "Add friend"}
              </button>
            )}
          </div>
        )}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Wallet} label="Collection value" value={<CoinAmount value={stats.value} />} />
        <Stat icon={Layers} label="Cards" value={`${stats.cards} · ${stats.unique} unique`} />
        <Stat icon={Crown} label="Mythic" value={stats.mythics} />
        <Stat icon={Flame} label="Legendary" value={stats.legendaries} />
        <Stat icon={Swords} label="Battles" value={stats.battlesPlayed} />
        <Stat icon={Trophy} label="Battle wins" value={stats.battlesPlayed ? `${stats.battlesWon} (${Math.round((stats.battlesWon / stats.battlesPlayed) * 100)}%)` : 0} />
      </div>

      <section>
        <h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-zinc-400">Showcase · top cards</h2>
        {profile.showcase.length === 0 ? (
          <p className="text-sm text-zinc-500">No cards yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {profile.showcase.map((s) => (
              <div key={cardKey(s.card)}>
                <MovieCard card={s.card} clickable />
                <p className="mt-2 flex items-center justify-between text-xs text-zinc-500">
                  <CoinAmount value={s.value} /> {s.copies > 1 && <span>x{s.copies}</span>}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>
      <ToastStack toasts={toasts} />
    </div>
  );
}
