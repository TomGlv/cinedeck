"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, LogIn, UserPlus } from "lucide-react";
import type { PlayerState } from "@/lib/packs";
import { usePlayer } from "../PlayerProvider";
import { postJson } from "../ui";

type Tab = "register" | "login";

export function AuthForm() {
  const router = useRouter();
  const { state, setState } = usePlayer();
  const [tab, setTab] = useState<Tab>("register");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (state?.username) {
    return (
      <p className="text-center text-sm text-zinc-400">
        You&apos;re signed in as <b className="text-white">{state.username}</b>.
      </p>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await postJson<{ state?: PlayerState }>(`/api/auth/${tab}`, { username, password });
    setBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    if (res.state) setState(res.state);
    router.push("/");
    router.refresh();
  }

  const guestHasStuff = (state?.cardCount ?? 0) > 0;
  const input =
    "w-full rounded-xl bg-white/5 px-4 py-3 text-sm text-zinc-100 ring-1 ring-white/10 placeholder:text-zinc-500 focus:outline-none focus:ring-amber-400/60";

  return (
    <div className="mx-auto max-w-sm rounded-3xl bg-white/[0.03] p-6 ring-1 ring-white/10">
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-full bg-white/5 p-1">
        {(["register", "login"] as const).map((t) => (
          <button
            key={t}
            onClick={() => {
              setTab(t);
              setError(null);
            }}
            className={`relative rounded-full py-2 text-sm font-semibold ${tab === t ? "text-black" : "text-zinc-400"}`}
          >
            {tab === t && <motion.span layoutId="auth-tab" className="absolute inset-0 rounded-full bg-white" />}
            <span className="relative">{t === "register" ? "Create account" : "Log in"}</span>
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="space-y-3">
        <input
          className={input}
          placeholder="Username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          maxLength={16}
        />
        <input
          className={input}
          type="password"
          placeholder="Password"
          autoComplete={tab === "register" ? "new-password" : "current-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <p className="text-xs text-zinc-500">
          {tab === "register"
            ? "3-16 letters, digits or _. Your current cards and coins move to the new account."
            : guestHasStuff
              ? `Heads up: the ${state?.cardCount} cards of this guest session stay behind. Create an account instead to keep them.`
              : "Welcome back."}
        </p>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={busy || !username || !password}
          className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-5 py-3 text-sm font-bold text-black disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : tab === "register" ? <UserPlus className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
          {tab === "register" ? "Create account" : "Log in"}
        </button>
      </form>
    </div>
  );
}
