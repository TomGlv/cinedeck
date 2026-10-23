import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { CardInfoProvider } from "@/components/CardDetails";
import { Navbar } from "@/components/Navbar";
import { PlayerProvider } from "@/components/PlayerProvider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <PlayerProvider>
          <CardInfoProvider>
            <Navbar />
            {children}
          </CardInfoProvider>
        </PlayerProvider>
      </body>
    </html>
  );
}
