"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Crown, Layers, Loader2, Medal, Swords, Wallet } from "lucide-react";
import type { Board, LeaderboardDTO, LeaderRow } from "@/lib/leaderboard";
import { Avatar } from "./Avatar";
import { usePlayer } from "./PlayerProvider";
import { CoinAmount } from "./ui";

const BOARDS: { id: Board; label: string; icon: typeof Crown; score: string; detail: string }[] = [
  { id: "value", label: "Collection value", icon: Wallet, score: "Value", detail: "unique cards" },
  { id: "sets", label: "Sets completed", icon: Layers, score: "Sets", detail: "combos" },
  { id: "battles", label: "Battles won", icon: Swords, score: "Wins", detail: "played" },
];

const PODIUM = ["text-amber-300", "text-zinc-300", "text-orange-400"];

function Row({ row, board }: { row: LeaderRow; board: (typeof BOARDS)[number] }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ${
        row.isMe ? "bg-accent-500/15 ring-accent-400/40" : "bg-white/[0.04] ring-white/10"
      }`}
    >
      <span className={`flex w-8 shrink-0 justify-center text-sm font-black tabular-nums ${PODIUM[row.rank - 1] ?? "text-zinc-500"}`}>
        {row.rank <= 3 ? <Medal className="h-5 w-5" /> : `#${row.rank}`}
      </span>
      <Link href={`/u/${row.username}`} className="flex min-w-0 flex-1 items-center gap-3 hover:underline">
        <Avatar name={row.username} avatar={row.avatar} />
        <span className="truncate font-semibold text-white">
          {row.username}
          {row.isMe && <span className="ml-2 text-xs font-normal text-accent-300">you</span>}
        </span>
      </Link>
      <span className="hidden text-xs text-zinc-500 sm:inline">
        {row.detail.toLocaleString("en-US")} {board.detail}
      </span>
      <span className="w-28 shrink-0 text-right text-base font-black tabular-nums text-white">
        {board.id === "value" ? <CoinAmount value={row.score} /> : row.score.toLocaleString("en-US")}
      </span>
    </motion.li>
  );
}

export function LeaderboardView() {
  const { state } = usePlayer();
  const [board, setBoard] = useState<Board>("value");
  const [data, setData] = useState<LeaderboardDTO | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    fetch(`/api/leaderboard?board=${board}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: LeaderboardDTO) => alive && setData(d));
    return () => {
      alive = false;
    };
  }, [board]);

  const def = BOARDS.find((b) => b.id === board)!;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {BOARDS.map((b) => (
          <button
            key={b.id}
            onClick={() => setBoard(b.id)}
            className={`relative flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${board === b.id ? "text-black" : "text-zinc-300"}`}
          >
            {board === b.id && <motion.span layoutId="board-tab" className="absolute inset-0 rounded-full bg-white" />}
            <b.icon className="relative h-4 w-4" />
            <span className="relative">{b.label}</span>
          </button>
        ))}
      </div>

      {!data ? (
        <div className="flex min-h-[30vh] items-center justify-center text-zinc-500">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : data.rows.length === 0 ? (
        <p className="py-16 text-center text-sm text-zinc-500">Nobody on this board yet. Be the first!</p>
      ) : (
        <ol className="space-y-2">
          {data.rows.map((r) => (
            <Row key={r.username} row={r} board={def} />
          ))}
          {data.me && (
            <>
              <li className="py-1 text-center text-zinc-600">...</li>
              <Row row={data.me} board={def} />
            </>
          )}
        </ol>
      )}

      {state && !state.username && (
        <p className="mt-6 text-center text-sm text-zinc-500">
          Guests aren&apos;t ranked.{" "}
          <Link href="/login" className="font-semibold text-accent-300 hover:underline">
            Create an account
          </Link>{" "}
          to appear on the leaderboards, your cards come with you.
        </p>
      )}
      {data && <p className="mt-4 text-center text-[11px] text-zinc-600">Updated every minute · registered players only</p>}
    </div>
  );
}
