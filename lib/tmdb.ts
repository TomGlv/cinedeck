import "server-only";
import { computeRarity, type CardData, type CardDetails, type MediaType } from "./cards";
import { franchiseForCollection, getFranchise } from "./franchises";
import { SAMPLE_CARDS } from "./sample-cards";

/* ------------------------------------------------------------------ */
/*  TMDB client                                                        */
/* ------------------------------------------------------------------ */

const API_BASE = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p";

/** TMDB genre id for Animation; Japanese animation (by language or origin country) is classed as Anime. */
const ANIMATION_GENRE = 16;

export class TmdbError extends Error {}

/** Raw entry shared by /trending, /movie/top_rated, /discover, /collection parts. */
interface TmdbMedia {
  id: number;
  media_type?: "movie" | "tv" | "person";
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  popularity?: number;
  release_date?: string;
  first_air_date?: string;
  genre_ids?: number[];
  genres?: { id: number }[];
  original_language?: string;
  origin_country?: string[];
  belongs_to_collection?: { id: number } | null;
}

interface TmdbPage {
  results: TmdbMedia[];
}

/**
 * Accepts either a v3 API key or a v4 "API Read Access Token" (a JWT starting with eyJ).
 * Both are free from https://www.themoviedb.org/settings/api
 */
function authFor(url: URL): HeadersInit {
  const key = process.env.TMDB_API_KEY;
  if (!key) throw new TmdbError("TMDB_API_KEY is not set");
  if (key.startsWith("eyJ")) return { Authorization: `Bearer ${key}` };
  url.searchParams.set("api_key", key);
  return {};
}

async function tmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const url = new URL(API_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const headers = { Accept: "application/json", ...authFor(url) };

  const res = await fetch(url, {
    headers,
    next: { revalidate: 3600 },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new TmdbError(`TMDB ${path} responded ${res.status}`);
  return res.json() as Promise<T>;
}

export function imageUrl(path: string | null | undefined, size: "w342" | "w500" | "w780" | "original" = "w500") {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

/* ------------------------------------------------------------------ */
/*  Mapping                                                            */
/* ------------------------------------------------------------------ */

function mediaTypeOf(m: TmdbMedia, fallback: "movie" | "tv"): MediaType {
  const genres = m.genre_ids ?? m.genres?.map((g) => g.id) ?? [];
  const japanese = m.original_language === "ja" || m.origin_country?.includes("JP");
  if (genres.includes(ANIMATION_GENRE) && japanese) return "Anime";
  return (m.media_type ?? fallback) === "tv" ? "TV Series" : "Movie";
}

export function toCard(m: TmdbMedia, fallback: "movie" | "tv" = "movie", franchise: string | null = null): CardData {
  const kind = m.media_type === "tv" || m.media_type === "movie" ? m.media_type : fallback;
  const type = mediaTypeOf(m, kind);
  const rating = Math.round((m.vote_average ?? 0) * 10) / 10;
  const voteCount = m.vote_count ?? 0;
  const date = m.release_date || m.first_air_date;

  return {
    id: `${kind}-${m.id}`,
    tmdbId: m.id,
    title: m.title ?? m.name ?? "Untitled",
    poster: imageUrl(m.poster_path),
    backdrop: imageUrl(m.backdrop_path, "w780"),
    type,
    rating,
    voteCount,
    popularity: m.popularity ?? 0,
    releaseDate: date ? Number(date.slice(0, 4)) : null,
    overview: m.overview ?? "",
    franchise: franchise ?? (m.belongs_to_collection ? franchiseForCollection(m.belongs_to_collection.id) : null),
    rarity: computeRarity(type, voteCount, rating),
  };
}

/* ------------------------------------------------------------------ */
/*  Public queries                                                     */
/* ------------------------------------------------------------------ */

export async function getTrending(window: "day" | "week" = "day"): Promise<CardData[]> {
  const data = await tmdb<TmdbPage>(`/trending/all/${window}`);
  return data.results.filter((m) => m.media_type !== "person").map((m) => toCard(m));
}

export async function getTopRated(kind: "movie" | "tv" = "movie", page = 1): Promise<CardData[]> {
  const data = await tmdb<TmdbPage>(`/${kind}/top_rated`, { page });
  return data.results.map((m) => toCard(m, kind));
}

export async function getPopular(kind: "movie" | "tv" = "movie", page = 1): Promise<CardData[]> {
  const data = await tmdb<TmdbPage>(`/${kind}/popular`, { page });
  return data.results.map((m) => toCard(m, kind));
}

/** Best-known films of one genre (most voted first). */
export async function getGenreMovies(genre: number, page = 1, sort: "vote_count.desc" | "popularity.desc" = "vote_count.desc"): Promise<CardData[]> {
  const data = await tmdb<TmdbPage>("/discover/movie", { with_genres: genre, sort_by: sort, page, "vote_count.gte": 50 });
  return data.results.map((m) => toCard(m, "movie"));
}

export async function getMovie(id: number): Promise<CardData> {
  return toCard(await tmdb<TmdbMedia>(`/movie/${id}`), "movie");
}

interface TmdbDetails extends TmdbMedia {
  tagline?: string;
  genres?: { id: number; name: string }[];
  runtime?: number;
  episode_run_time?: number[];
  budget?: number;
  revenue?: number;
  number_of_seasons?: number;
  number_of_episodes?: number;
  status?: string;
  created_by?: { name: string }[];
  networks?: { name: string }[];
  credits?: { cast: { name: string }[]; crew: { name: string; job: string }[] };
}

/** Full details for a card id like "movie-11" or "tv-1399". */
export async function getCardDetails(cardId: string): Promise<CardDetails> {
  const match = /^(movie|tv)-(\d+)$/.exec(cardId);
  if (!match) throw new TmdbError(`No TMDB details for "${cardId}"`);
  const [, kind, id] = match;
  const d = await tmdb<TmdbDetails>(`/${kind}/${id}`, { append_to_response: "credits" });

  const makers =
    kind === "movie"
      ? (d.credits?.crew ?? []).filter((c) => c.job === "Director").map((c) => c.name)
      : (d.created_by ?? []).map((c) => c.name);
  return {
    overview: d.overview ?? "",
    tagline: d.tagline || null,
    genres: (d.genres ?? []).map((g) => g.name),
    rating: Math.round((d.vote_average ?? 0) * 10) / 10,
    voteCount: d.vote_count ?? 0,
    releaseDate: d.release_date || d.first_air_date || null,
    runtime: d.runtime || d.episode_run_time?.[0] || null,
    budget: d.budget || null,
    revenue: d.revenue || null,
    seasons: d.number_of_seasons ?? null,
    episodes: d.number_of_episodes ?? null,
    makers: Array.from(new Set(makers)).slice(0, 3),
    cast: (d.credits?.cast ?? []).slice(0, 5).map((c) => c.name),
    networks: (d.networks ?? []).slice(0, 2).map((n) => n.name),
    backdrop: imageUrl(d.backdrop_path, "w780"),
    status: d.status ?? null,
  };
}

/** Every card needed to complete a set, oldest first. */
export async function getFranchiseCards(slug: string): Promise<CardData[]> {
  const franchise = getFranchise(slug);
  if (!franchise) throw new TmdbError(`Unknown franchise "${slug}"`);
  const { source } = franchise;
  let media: TmdbMedia[];

  switch (source.kind) {
    case "collection": {
      const col = await tmdb<{ parts: TmdbMedia[] }>(`/collection/${source.collectionId}`);
      const extras = await Promise.all(
        (source.extraMovieIds ?? []).map((id) => tmdb<TmdbMedia>(`/movie/${id}`)),
      );
      media = [...col.parts, ...extras];
      break;
    }
    case "company": {
      const pages = await Promise.all(
        [1, 2].map((page) =>
          tmdb<TmdbPage>("/discover/movie", { with_companies: source.companyId, sort_by: "primary_release_date.asc", page }),
        ),
      );
      // Studio catalogues include obscure shorts and making-ofs; keep real releases only
      media = pages.flatMap((p) => p.results).filter((m) => (m.vote_count ?? 0) >= 100);
      break;
    }
    case "director": {
      const credits = await tmdb<{ crew: (TmdbMedia & { job: string })[] }>(`/person/${source.personId}/movie_credits`);
      media = credits.crew.filter((c) => c.job === "Director");
      break;
    }
  }

  // Unreleased entries can't be collected yet
  const released = media.filter((m) => m.release_date && new Date(m.release_date) <= new Date());
  return released
    .map((m) => toCard(m, "movie", slug))
    .sort((a, b) => (a.releaseDate ?? 0) - (b.releaseDate ?? 0));
}

/* ------------------------------------------------------------------ */
/*  Fallback wrapper                                                   */
/* ------------------------------------------------------------------ */

export interface CardsResult {
  cards: CardData[];
  source: "live" | "sample";
  error?: string;
}

/** Runs a TMDB query, falling back to bundled sample cards (no key, network error...). */
export async function withFallback(query: () => Promise<CardData[]>): Promise<CardsResult> {
  try {
    return { cards: await query(), source: "live" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[tmdb] ${message}, using sample cards`);
    return { cards: SAMPLE_CARDS, source: "sample", error: message };
  }
}
