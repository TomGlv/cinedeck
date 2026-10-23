/**
 * CineDeck mark: a play button on a hot-rose tile, sliced through on the diagonal like a
 * pack being cut open; the lower half shifts along the cut.
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        <linearGradient id="xm-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7aa0" />
          <stop offset="0.55" stopColor="#f72d64" />
          <stop offset="1" stopColor="#bc0a41" />
        </linearGradient>
        <clipPath id="xm-top">
          <polygon points="0,0 32,0 32,12.2 0,19.8" />
        </clipPath>
        <clipPath id="xm-bottom">
          <polygon points="0,21.2 32,13.6 32,32 0,32" />
        </clipPath>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#xm-tile)" />
      <rect x="0.5" y="0.5" width="31" height="31" rx="8.5" fill="none" stroke="#fff" strokeOpacity="0.25" />
      <g fill="#0b0b0c" stroke="#0b0b0c" strokeWidth="2.4" strokeLinejoin="round">
        <g clipPath="url(#xm-top)">
          <path d="M12 8.5 23.5 16 12 23.5Z" />
        </g>
        <g clipPath="url(#xm-bottom)" transform="translate(1.1 0.6)">
          <path d="M12 8.5 23.5 16 12 23.5Z" />
        </g>
      </g>
    </svg>
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      {!compact && <span className="font-display text-[1.3rem] font-extrabold leading-none tracking-[-0.05em] text-white">cinedeck</span>}
    </span>
  );
}
