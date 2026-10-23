"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { RARITY_ORDER } from "@/lib/cards";
import type { CollectionDTO, OwnedGroupDTO } from "@/lib/economy";
import { cardKey } from "@/lib/finishes";
import type { PlayerState } from "@/lib/packs";
import { Avatar } from "../Avatar";
import { usePlayer } from "../PlayerProvider";
import { Modal, SearchInput, postJson } from "../ui";

/** Any component can open the picker with `window.dispatchEvent(new Event(OPEN_AVATAR_PICKER))`. */
export const OPEN_AVATAR_PICKER = "cinedeck:open-avatar-picker";

/** Pick one of your cards as profile picture, best cards first. */
export function AvatarPicker() {
  const { state, setState } = usePlayer();
  const [open, setOpen] = useState(false);
  const [groups, setGroups] = useState<OwnedGroupDTO[] | null>(null);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_AVATAR_PICKER, show);
    return () => window.removeEventListener(OPEN_AVATAR_PICKER, show);
  }, []);

  useEffect(() => {
    if (!open) return;
    setGroups(null);
    setError(null);
    void fetch("/api/collection", { cache: "no-store" })
      .then((r) => r.json() as Promise<CollectionDTO>)
      .then((c) => setGroups(c.groups));
  }, [open]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (groups ?? [])
      .filter((g) => !q || g.card.title.toLowerCase().includes(q))
      .sort((a, b) => RARITY_ORDER[b.card.rarity] - RARITY_ORDER[a.card.rarity] || b.marketValue - a.marketValue);
  }, [groups, query]);

  async function pick(group: OwnedGroupDTO | null) {
    const copy = group ? (group.copies.find((c) => !c.listed) ?? group.copies[0]) : null;
    setBusy(group ? cardKey(group.card) : "none");
    setError(null);
    const res = await postJson<{ state?: PlayerState }>("/api/player", { avatar: copy?.id ?? null });
    setBusy(null);
    if (res.state) setState(res.state);
    if (res.error) setError(res.error);
    else setOpen(false);
  }

  const current = (g: OwnedGroupDTO) => state?.avatar?.title === g.card.title && state.avatar.finish === (g.card.finish ?? "normal");

  return (
    <Modal open={open} onClose={() => setOpen(false)}>
      <div className="flex flex-wrap items-center gap-4 pr-8">
        <Avatar name={state?.displayName ?? "?"} avatar={state?.avatar ?? null} size="lg" />
        <div>
          <h2 className="font-display text-2xl font-bold tracking-tight text-white">Profile picture</h2>
          <p className="text-sm text-zinc-400">Show off one of your cards.</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <SearchInput value={query} onChange={setQuery} placeholder="Search your cards" />
        </div>
        {state?.avatar && (
          <button
            onClick={() => pick(null)}
            disabled={busy != null}
            className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 ring-1 ring-white/10 transition hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" /> Remove
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

      {!groups ? (
        <div className="flex h-40 items-center justify-center text-zinc-500">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-zinc-500">No card yet. Open a pack first.</p>
      ) : (
        <div className="mt-5 grid max-h-[55vh] grid-cols-3 gap-3 overflow-y-auto pr-1 sm:grid-cols-5">
          {shown.map((g) => {
            const key = cardKey(g.card);
            const selected = current(g);
            return (
              <button
                key={key}
                onClick={() => pick(g)}
                disabled={busy != null}
                className={`group relative overflow-hidden rounded-2xl text-left ring-2 transition active:scale-[0.98] ${
                  selected ? "ring-accent-400" : "ring-transparent hover:ring-white/30"
                }`}
              >
                <span className="block aspect-[3/4] bg-zinc-900">
                  {g.card.poster && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={g.card.poster} alt={g.card.title} loading="lazy" className="h-full w-full object-cover object-top transition duration-500 group-hover:scale-105" />
                  )}
                </span>
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent px-2 pb-1.5 pt-6">
                  <span className="block truncate text-xs font-semibold text-white">{g.card.title}</span>
                  <span className="text-[10px] text-zinc-400">
                    {g.card.rarity}
                    {g.card.finish && g.card.finish !== "normal" ? ` · ${g.card.finish}` : ""}
                  </span>
                </span>
                {(selected || busy === key) && (
                  <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent-500 text-white">
                    {busy === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
