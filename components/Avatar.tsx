"use client";

import type { AvatarDTO } from "@/lib/packs";

const RING: Record<AvatarDTO["rarity"], string> = {
  Common: "#7a7168",
  Rare: "#a78bfa",
  Legendary: "#fbbf24",
  Mythic: "conic-gradient(from 0deg, #fecdd3, #ef4444, #9f1239, #fb7185, #fecdd3)",
};

const SIZES = { sm: "h-8 w-8 text-sm", md: "h-10 w-10 text-base", lg: "h-20 w-20 text-4xl" } as const;

/**
 * A player's picture: the poster of the card they picked to show off, framed in the card's
 * rarity colour. Falls back to their initial.
 */
export function Avatar({ name, avatar, size = "sm" }: { name: string; avatar: AvatarDTO | null; size?: keyof typeof SIZES }) {
  const ring = avatar ? RING[avatar.rarity] : null;
  return (
    <span
      className={`relative inline-flex shrink-0 rounded-[30%] p-[2px] ${SIZES[size]}`}
      style={{ background: ring ?? "transparent" }}
      title={avatar ? avatar.title : undefined}
    >
      <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[28%] bg-accent-800 font-display uppercase text-accent-100">
        {avatar?.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar.poster} alt={name} className="absolute inset-0 h-full w-full object-cover object-top" />
        ) : (
          (name[0] ?? "?")
        )}
      </span>
    </span>
  );
}
