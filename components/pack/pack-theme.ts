import type { PackType } from "@/lib/packs";

/**
 * Look of each pack, shared by the sealed booster and the backs of the cards it deals:
 * `tint` is the foil colour, `seal` the crimped metal and accents.
 */
export const PACK_THEMES: Record<PackType, { tint: string; seal: string; label: string }> = {
  free: { tint: "#3b2a7a", seal: "#8b7cf6", label: "Free" },
  quickie: { tint: "#0b4a6b", seal: "#5ad1f2", label: "Quick" },
  premium: { tint: "#5b1430", seal: "#ff5c86", label: "Premium" },
  blockbuster: { tint: "#6b2a06", seal: "#ffb547", label: "Legendary inside" },
  boxoffice: { tint: "#0f4a32", seal: "#7fe0a8", label: "High roller" },
  halloffame: { tint: "#3d3108", seal: "#f5d36b", label: "Hall of Fame" },
  halloween: { tint: "#4a1a05", seal: "#ff8a3d", label: "Event" },
  holidays: { tint: "#0c3b22", seal: "#ff6b7d", label: "Event" },
};

/** Crumpled foil relief, lit from the top left. */
export const CRINKLE =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='c'%3E%3CfeTurbulence type='turbulence' baseFrequency='0.035' numOctaves='2'/%3E%3CfeDiffuseLighting lighting-color='white' surfaceScale='3'%3E%3CfeDistantLight azimuth='45' elevation='55'/%3E%3C/feDiffuseLighting%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23c)'/%3E%3C/svg%3E\")";

/** Iridescent band printed across the foil. */
export const IRIDESCENT = "linear-gradient(115deg, transparent 20%, #ff9ad5 35%, #9ae6ff 50%, #fff3a6 62%, transparent 78%)";
