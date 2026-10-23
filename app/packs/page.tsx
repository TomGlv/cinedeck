import { PackOpener } from "@/components/pack/PackOpener";

export const metadata = { title: "Packs · CineDeck" };

export default function PacksPage() {
  return (
    <main className="mx-auto max-w-6xl overflow-x-clip px-4 py-10 sm:px-6">
      <header className="mb-10 text-center">
        <h1 className="bg-gradient-to-r from-amber-200 via-amber-400 to-fuchsia-400 bg-clip-text text-4xl font-black tracking-tight text-transparent">
          Booster Packs
        </h1>
        <p className="mt-2 text-sm text-zinc-400">A free pack every 15 minutes, limited event packs, and the best card always revealed last.</p>
      </header>
      <PackOpener />
    </main>
  );
}
