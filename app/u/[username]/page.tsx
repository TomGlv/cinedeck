import { ProfileView } from "@/components/account/ProfileView";

export function generateMetadata({ params }: { params: { username: string } }) {
  return { title: `${decodeURIComponent(params.username)} · CineDeck` };
}

export default function ProfilePage({ params }: { params: { username: string } }) {
  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <ProfileView username={decodeURIComponent(params.username)} />
    </main>
  );
}
