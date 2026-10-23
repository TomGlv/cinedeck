import type { ReactNode } from "react";

/** Page title: a small pill eyebrow over a large display headline. */
export function PageHeader({
  kicker,
  title,
  children,
  center = false,
  className = "mb-10",
}: {
  kicker: string;
  title: ReactNode;
  children?: ReactNode;
  center?: boolean;
  className?: string;
}) {
  return (
    <header className={`${className} ${center ? "text-center" : ""}`}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.04] px-3 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-300 ring-1 ring-white/10">
        <span className="h-1.5 w-1.5 rounded-full bg-accent-400 shadow-[0_0_8px_rgba(255,92,134,0.9)]" />
        {kicker}
      </span>
      <h1 className="mt-4 font-display text-4xl font-bold leading-[0.95] tracking-[-0.03em] text-white sm:text-6xl">{title}</h1>
      {children && <p className={`mt-4 max-w-xl text-[15px] leading-relaxed text-zinc-400 ${center ? "mx-auto" : ""}`}>{children}</p>}
    </header>
  );
}
