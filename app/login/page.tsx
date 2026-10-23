import { AuthForm } from "@/components/account/AuthForm";

export const metadata = { title: "Account · CineDeck" };

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <header className="mb-8 text-center">
        <h1 className="bg-gradient-to-r from-amber-200 via-amber-400 to-fuchsia-400 bg-clip-text text-4xl font-black tracking-tight text-transparent">
          Your account
        </h1>
        <p className="mt-2 text-sm text-zinc-400">Pick a username to add friends, challenge them and play from any device.</p>
      </header>
      <AuthForm />
    </main>
  );
}
