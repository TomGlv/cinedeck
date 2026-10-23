"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeftRight, Check, Loader2, Swords, UserMinus, UserPlus, X } from "lucide-react";
import type { PlayerState } from "@/lib/packs";
import type { FriendsDTO } from "@/lib/social";
import { Avatar } from "../Avatar";
import { usePlayer } from "../PlayerProvider";
import { ToastStack, postJson, useToasts } from "../ui";

export function FriendsView() {
  const { state, setState } = usePlayer();
  const { toasts, push } = useToasts();
  const [data, setData] = useState<FriendsDTO | null>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/friends", { cache: "no-store" });
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(body: object) {
    setBusy(true);
    const res = await postJson<{ message?: string; state?: PlayerState }>("/api/friends", body);
    setBusy(false);
    if (res.state) setState(res.state);
    if (res.error) push(res.error, "error");
    else if (res.message) push(res.message, "success");
    void load();
  }

  function add(e: FormEvent) {
    e.preventDefault();
    if (!username.trim()) return;
    void act({ action: "add", username: username.trim() });
    setUsername("");
  }

  if (state && !state.username) {
    return (
      <div className="mx-auto max-w-md rounded-3xl bg-white/[0.03] p-6 text-center ring-1 ring-white/10">
        <p className="text-sm text-zinc-300">Friends need an account so they can find you by name.</p>
        <Link href="/login" className="mt-4 inline-flex items-center gap-2 rounded-full bg-amber-400 px-5 py-2.5 text-sm font-bold text-black">
          <UserPlus className="h-4 w-4" /> Create an account
        </Link>
        <p className="mt-3 text-xs text-zinc-500">Your cards and coins come with you.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const row = "flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 ring-1 ring-white/10";
  const pill = "flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 disabled:opacity-50";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <form onSubmit={add} className="flex gap-2">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Add a friend by username"
          className="min-w-0 flex-1 rounded-full bg-white/5 px-4 py-2.5 text-sm text-zinc-100 ring-1 ring-white/10 placeholder:text-zinc-500 focus:outline-none focus:ring-accent-400/60"
        />
        <button type="submit" disabled={busy} className="flex items-center gap-2 rounded-full bg-accent-500 px-5 py-2.5 text-sm font-bold text-white">
          <UserPlus className="h-4 w-4" /> Add
        </button>
      </form>

      {data.incoming.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Requests</h2>
          {data.incoming.map((r) => (
            <div key={r.id} className={row}>
              <Link href={`/u/${r.username}`} className="flex items-center gap-3 font-semibold text-white hover:underline">
                <Avatar name={r.username} avatar={r.avatar} /> {r.username}
              </Link>
              <div className="flex gap-2">
                <button onClick={() => act({ action: "decline", requestId: r.id })} disabled={busy} className={`${pill} bg-white/10 text-zinc-200 ring-white/15`}>
                  <X className="h-3.5 w-3.5" /> Decline
                </button>
                <button onClick={() => act({ action: "accept", requestId: r.id })} disabled={busy} className={`${pill} bg-emerald-400 text-black ring-emerald-400`}>
                  <Check className="h-3.5 w-3.5" /> Accept
                </button>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Friends · {data.friends.length}</h2>
        {data.friends.length === 0 ? (
          <p className="text-sm text-zinc-500">No friends yet. Add someone by their username above.</p>
        ) : (
          data.friends.map((f) => (
            <div key={f.username} className={row}>
              <Link href={`/u/${f.username}`} className="flex items-center gap-3 font-semibold text-white hover:underline">
                <Avatar name={f.username} avatar={f.avatar} /> {f.username}
              </Link>
              <div className="flex gap-2">
                <Link href={`/battles?friend=${encodeURIComponent(f.username)}`} className={`${pill} bg-amber-400 text-black ring-amber-400`}>
                  <Swords className="h-3.5 w-3.5" /> Challenge
                </Link>
                <Link href={`/trades?with=${encodeURIComponent(f.username)}`} className={`${pill} bg-accent-500 text-white ring-accent-500`}>
                  <ArrowLeftRight className="h-3.5 w-3.5" /> Trade
                </Link>
                <button
                  onClick={() => act({ action: "remove", username: f.username })}
                  disabled={busy}
                  aria-label={`Remove ${f.username}`}
                  className={`${pill} bg-white/5 text-zinc-400 ring-white/10 hover:text-rose-300`}
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {data.outgoing.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">Sent</h2>
          {data.outgoing.map((r) => (
            <div key={r.id} className={row}>
              <span className="flex items-center gap-3 text-zinc-300">
                <Avatar name={r.username} avatar={r.avatar} /> {r.username}
              </span>
              <button onClick={() => act({ action: "remove", username: r.username })} disabled={busy} className={`${pill} bg-white/10 text-zinc-200 ring-white/15`}>
                Cancel
              </button>
            </div>
          ))}
        </section>
      )}
      <ToastStack toasts={toasts} />
    </div>
  );
}
