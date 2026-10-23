"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { PlayerState } from "@/lib/packs";

interface PlayerContextValue {
  state: PlayerState | null;
  setState: (state: PlayerState) => void;
  refresh: () => Promise<void>;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerState | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/player", { cache: "no-store" });
    if (res.ok) setState(await res.json());
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return <PlayerContext.Provider value={{ state, setState, refresh }}>{children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return ctx;
}

/** Milliseconds until `target` (ISO), ticking every second. 0 when passed or null. */
export function useCountdown(target: string | null): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);
  return target ? Math.max(0, new Date(target).getTime() - now) : 0;
}

export function formatCountdown(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
