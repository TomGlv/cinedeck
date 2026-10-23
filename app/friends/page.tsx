import { FriendsView } from "@/components/account/FriendsView";

export const metadata = { title: "Friends · CineDeck" };

export default function FriendsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header className="mb-8 text-center">
        <h1 className="bg-gradient-to-r from-violet-300 via-fuchsia-400 to-amber-300 bg-clip-text text-4xl font-black tracking-tight text-transparent">
          Friends
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Add players, check their collections and challenge them to booster battles.</p>
      </header>
      <FriendsView />
    </main>
  );
}
