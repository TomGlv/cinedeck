"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Boxes, Calendar, Clapperboard, Clock, DollarSign, Landmark, Star, TrendingUp, Tv, Users } from "lucide-react";
import type { CardData, CardDetails } from "@/lib/cards";
import { CardInfoContext } from "./card-info";
import { FavoriteButton } from "./FavoriteButton";
import { MovieCard } from "./MovieCard";
import { Modal } from "./ui";

/* ------------------------------------------------------------------ */
/*  Fetching                                                           */
/* ------------------------------------------------------------------ */

const cache = new Map<string, Promise<CardDetails | null>>();

function fetchDetails(cardId: string): Promise<CardDetails | null> {
  let pending = cache.get(cardId);
  if (!pending) {
    pending = fetch(`/api/cards/details?id=${encodeURIComponent(cardId)}`)
      .then((r) => (r.ok ? (r.json() as Promise<CardDetails>) : null))
      .catch(() => null);
    cache.set(cardId, pending);
  }
  return pending;
}

export function useCardDetails(cardId: string) {
  const [details, setDetails] = useState<CardDetails | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setDetails(undefined);
    void fetchDetails(cardId).then((d) => alive && setDetails(d));
    return () => {
      alive = false;
    };
  }, [cardId]);
  return details;
}

interface Supply {
  total: number;
  house: number;
  players: number;
  holders: number;
  listed: number;
}

/** Live count of copies: cards only exist once a booster created them. */
function SupplyLine({ cardId }: { cardId: string }) {
  const [supply, setSupply] = useState<Supply | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/cards/supply?id=${encodeURIComponent(cardId)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: Supply) => alive && setSupply(d))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [cardId]);
  if (!supply) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl bg-white/5 px-3 py-2.5 text-xs text-zinc-400 ring-1 ring-white/10">
      <span className="flex items-center gap-1.5 font-semibold text-zinc-200">
        <Boxes className="h-3.5 w-3.5 text-zinc-500" />
        {supply.total} {supply.total === 1 ? "copy" : "copies"} in existence
      </span>
      <span>
        {supply.players} with {supply.holders} {supply.holders === 1 ? "player" : "players"}
      </span>
      <span>{supply.house} with the bots</span>
      <span className={supply.listed === 0 ? "text-rose-300" : ""}>{supply.listed === 0 ? "none on the market" : `${supply.listed} on the market`}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Formatting                                                         */
/* ------------------------------------------------------------------ */

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(n >= 1e8 ? 0 : 1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n}`;
}

function compact(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);
}

function duration(min: number): string {
  const h = Math.floor(min / 60);
  return h > 0 ? `${h}h ${String(min % 60).padStart(2, "0")}` : `${min} min`;
}

function longDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

/* ------------------------------------------------------------------ */
/*  Panel                                                              */
/* ------------------------------------------------------------------ */

function Stat({ icon: Icon, label, value, hint }: { icon: typeof Star; label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
      <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-zinc-500">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <p className="mt-1 text-base font-bold tabular-nums text-white">{value}</p>
      {hint && <p className="truncate text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}

/** Synopsis, rating, box office and credits for one card. */
export function CardDetailsPanel({ card }: { card: CardData }) {
  const details = useCardDetails(card.id);

  if (card.id.startsWith("special-")) {
    return <p className="text-sm text-zinc-400">A one-of-a-kind reward card earned by completing a set.</p>;
  }
  if (details === undefined) {
    return (
      <div className="space-y-3">
        <div className="h-16 animate-pulse rounded-xl bg-white/5" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }
  if (details === null) {
    return <p className="text-sm text-zinc-500">{card.overview || "Details unavailable right now."}</p>;
  }

  const isMovie = card.id.startsWith("movie-");
  const profit = details.revenue && details.budget ? details.revenue / details.budget : null;

  return (
    <div className="space-y-4">
      <SupplyLine cardId={card.id} />
      <div>
        {details.tagline && <p className="mb-1 text-sm italic text-amber-200/80">“{details.tagline}”</p>}
        <p className="text-sm leading-relaxed text-zinc-300">{details.overview || "No synopsis available."}</p>
        {details.genres.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {details.genres.map((g) => (
              <span key={g} className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300 ring-1 ring-white/10">
                {g}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat
          icon={Star}
          label="Rating"
          value={
            <span className="text-amber-300">
              {details.rating.toFixed(1)}
              <span className="text-xs font-normal text-zinc-500">/10</span>
            </span>
          }
          hint={`${compact(details.voteCount)} votes on TMDB`}
        />
        {isMovie ? (
          <Stat
            icon={TrendingUp}
            label="Box office"
            value={details.revenue ? money(details.revenue) : "n/a"}
            hint={profit ? `${profit.toFixed(1)}x its budget` : "Worldwide gross"}
          />
        ) : (
          <Stat
            icon={Tv}
            label="Seasons"
            value={details.seasons ?? "n/a"}
            hint={details.episodes ? `${details.episodes} episodes` : details.status}
          />
        )}
        {isMovie ? (
          <Stat icon={DollarSign} label="Budget" value={details.budget ? money(details.budget) : "n/a"} />
        ) : (
          <Stat icon={Landmark} label="Network" value={details.networks[0] ?? "n/a"} hint={details.networks[1]} />
        )}
        {details.runtime && <Stat icon={Clock} label={isMovie ? "Runtime" : "Episode"} value={duration(details.runtime)} />}
        {details.releaseDate && (
          <Stat icon={Calendar} label={isMovie ? "Release" : "First aired"} value={longDate(details.releaseDate)} />
        )}
        {details.makers.length > 0 && (
          <Stat
            icon={Clapperboard}
            label={isMovie ? "Director" : "Created by"}
            value={<span className="text-sm">{details.makers.join(", ")}</span>}
          />
        )}
      </div>

      {details.cast.length > 0 && (
        <p className="flex items-start gap-2 text-xs text-zinc-400">
          <Users className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
          <span>
            <span className="text-zinc-500">Starring </span>
            {details.cast.join(", ")}
          </span>
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Global "card info" modal                                           */
/* ------------------------------------------------------------------ */

export function CardInfoProvider({ children }: { children: ReactNode }) {
  const [card, setCard] = useState<CardData | null>(null);
  const close = useCallback(() => setCard(null), []);

  return (
    <CardInfoContext.Provider value={setCard}>
      {children}
      <Modal open={card != null} onClose={close}>
        {card && (
          <div className="grid gap-6 sm:grid-cols-[220px_1fr]">
            <div className="mx-auto w-48 sm:w-full">
              <MovieCard card={card} />
            </div>
            <div className="flex flex-col gap-4">
              <div className="pr-8">
                <h2 className="text-xl font-black text-white">{card.title}</h2>
                <p className="mt-1 text-sm text-zinc-400">
                  {card.type}
                  {card.releaseDate ? ` · ${card.releaseDate}` : ""} · {card.rarity}
                </p>
              </div>
              <FavoriteButton cardId={card.id} />
              <CardDetailsPanel card={card} />
            </div>
          </div>
        )}
      </Modal>
    </CardInfoContext.Provider>
  );
}
