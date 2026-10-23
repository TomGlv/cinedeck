import { AuthForm } from "@/components/account/AuthForm";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Account · CineDeck" };

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <PageHeader kicker="Account" title="Your account" className="mb-8">
        Pick a username to add friends, challenge them and play from any device.
      </PageHeader>
      <AuthForm />
    </main>
  );
}
