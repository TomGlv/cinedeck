import type { Metadata } from "next";
import { Bricolage_Grotesque } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { CardInfoProvider } from "@/components/CardDetails";
import { Navbar } from "@/components/Navbar";
import { Onboarding } from "@/components/Onboarding";
import { AvatarPicker } from "@/components/account/AvatarPicker";
import { PlayerProvider } from "@/components/PlayerProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
/** Wide display grotesk for titles */
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["500", "700", "800"], variable: "--font-display" });
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "CineDeck",
  description: "Collect movies, series and anime cards, then put your cinema knowledge to the test",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${display.variable} antialiased`}
      >
        <PlayerProvider>
          <CardInfoProvider>
            <Navbar />
            {children}
            <Onboarding />
            <AvatarPicker />
          </CardInfoProvider>
        </PlayerProvider>
      </body>
    </html>
  );
}
