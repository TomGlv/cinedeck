import { FriendsView } from "@/components/account/FriendsView";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Friends · CineDeck" };

export default function FriendsPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <PageHeader kicker="Social" title="Friends" className="mb-8">
        Add players, check their collections and challenge them to booster battles.
      </PageHeader>
      <FriendsView />
    </main>
  );
}
