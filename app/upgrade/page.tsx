import { Upgrader } from "@/components/upgrade/Upgrader";

export const metadata = { title: "Upgrader · CineDeck" };

export default function UpgradePage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 text-center">
        <h1 className="bg-gradient-to-r from-emerald-200 via-emerald-400 to-amber-300 bg-clip-text text-4xl font-black tracking-tight text-transparent">
          Upgrader
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Stake cheap cards for a shot at a better one. Win and it&apos;s yours, miss and they&apos;re gone.</p>
      </header>
      <Upgrader />
    </main>
  );
}
