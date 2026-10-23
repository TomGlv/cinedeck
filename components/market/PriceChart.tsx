"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

export interface SalePoint {
  price: number;
  soldAt: string;
}

const RANGES = [
  { id: "24h", label: "24h", ms: 24 * 3600_000 },
  { id: "3d", label: "3 days", ms: 3 * 24 * 3600_000 },
  { id: "7d", label: "7 days", ms: 7 * 24 * 3600_000 },
] as const;
type RangeId = (typeof RANGES)[number]["id"];

// Validated against the zinc-950 surface (lightness band + 3:1 contrast)
const LINE = "#d97706";
const GRID = "rgba(255,255,255,0.07)";
const PAD = { top: 12, right: 52, bottom: 22, left: 8 };
const HEIGHT = 180;

/** 3-4 clean ticks covering [min, max]. */
function niceTicks(min: number, max: number): number[] {
  const span = Math.max(1, max - min);
  const raw = span / 3;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let t = Math.floor(min / step) * step; t <= max + step * 0.01; t += step) if (t >= min - step * 0.01) ticks.push(Math.round(t));
  return ticks;
}

function compact(n: number): string {
  return n >= 10_000 ? `${Math.round(n / 1000)}K` : n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
}

function when(iso: string, range: RangeId): string {
  const d = new Date(iso);
  return range === "24h"
    ? d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleString("en-US", { weekday: "short", hour: "2-digit", minute: "2-digit" });
}

/** Stock-style chart of recent sales with a market value reference, crosshair and tooltip. */
export function PriceChart({ sales, marketValue }: { sales: SalePoint[] | null; marketValue: number }) {
  const [range, setRange] = useState<RangeId>("3d");
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const points = useMemo(() => {
    if (!sales) return [];
    const since = Date.now() - RANGES.find((r) => r.id === range)!.ms;
    return sales.filter((s) => new Date(s.soldAt).getTime() >= since);
  }, [sales, range]);

  const prices = points.map((p) => p.price);
  const first = prices[0];
  const last = prices[prices.length - 1];
  const change = points.length >= 2 ? ((last - first) / first) * 100 : null;
  const low = prices.length ? Math.min(...prices) : 0;
  const high = prices.length ? Math.max(...prices) : 0;

  // Scales
  const lo = Math.min(low, marketValue) * 0.95;
  const hi = Math.max(high, marketValue) * 1.05;
  const ticks = niceTicks(lo, hi);
  const yMin = Math.min(lo, ticks[0]);
  const yMax = Math.max(hi, ticks[ticks.length - 1]);
  const plotW = Math.max(1, width - PAD.left - PAD.right);
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const t0 = points.length ? new Date(points[0].soldAt).getTime() : 0;
  const t1 = points.length ? new Date(points[points.length - 1].soldAt).getTime() : 1;
  const x = (iso: string) => PAD.left + (t1 === t0 ? plotW / 2 : ((new Date(iso).getTime() - t0) / (t1 - t0)) * plotW);
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin || 1)) * plotH;

  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.soldAt).toFixed(1)},${y(p.price).toFixed(1)}`).join(" ");
  const area = points.length ? `${path} L${x(points[points.length - 1].soldAt)},${PAD.top + plotH} L${x(points[0].soldAt)},${PAD.top + plotH} Z` : "";

  function onMove(e: PointerEvent<SVGRectElement>) {
    if (points.length === 0) return;
    const rect = e.currentTarget.ownerSVGElement!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(points[i].soldAt) - px) < Math.abs(x(points[best].soldAt) - px)) best = i;
    setHover(best);
  }

  const h = hover != null ? points[hover] : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-black tabular-nums text-white">{last != null ? last.toLocaleString("en-US") : "-"}</span>
          {change != null && (
            <span className={`flex items-center gap-1 text-sm font-bold tabular-nums ${change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {change >= 0 ? "+" : ""}
              {change.toFixed(1)}%
            </span>
          )}
          <span className="text-xs text-zinc-500">last sale</span>
        </div>
        <div className="flex gap-1" role="group" aria-label="Time range">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              aria-pressed={range === r.id}
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                range === r.id ? "bg-white text-black ring-white" : "bg-white/5 text-zinc-300 ring-white/10 hover:bg-white/10"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={box} className="relative">
        {sales == null ? (
          <div className="animate-pulse rounded-lg bg-white/5" style={{ height: HEIGHT }} />
        ) : points.length < 2 ? (
          <div className="flex items-center justify-center rounded-lg bg-white/[0.02] text-xs text-zinc-500" style={{ height: HEIGHT }}>
            {points.length === 1 ? `Only one sale in this period (${points[0].price})` : "No sales in this period"}
          </div>
        ) : (
          width > 0 && (
            <svg width={width} height={HEIGHT} role="img" aria-label={`Sale prices, ${range}: from ${first} to ${last}`}>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={PAD.left} x2={PAD.left + plotW} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
                  <text x={PAD.left + plotW + 6} y={y(t) + 3} className="fill-zinc-500 text-[10px] tabular-nums">
                    {compact(t)}
                  </text>
                </g>
              ))}

              {/* Market value reference */}
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(marketValue)} y2={y(marketValue)} stroke="rgba(255,255,255,0.35)" strokeWidth={1} />
              <text x={PAD.left + 4} y={y(marketValue) - 4} className="fill-zinc-400 text-[10px]">
                Market value {marketValue.toLocaleString("en-US")}
              </text>

              <path d={area} fill={LINE} opacity={0.1} />
              <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              <circle cx={x(points[points.length - 1].soldAt)} cy={y(last)} r={4} fill={LINE} stroke="#09090b" strokeWidth={2} />

              <text x={PAD.left} y={HEIGHT - 6} className="fill-zinc-500 text-[10px]">
                {when(points[0].soldAt, range)}
              </text>
              <text x={PAD.left + plotW} y={HEIGHT - 6} textAnchor="end" className="fill-zinc-500 text-[10px]">
                {when(points[points.length - 1].soldAt, range)}
              </text>

              {h && (
                <g pointerEvents="none">
                  <line x1={x(h.soldAt)} x2={x(h.soldAt)} y1={PAD.top} y2={PAD.top + plotH} stroke="rgba(255,255,255,0.3)" strokeWidth={1} />
                  <circle cx={x(h.soldAt)} cy={y(h.price)} r={5} fill={LINE} stroke="#09090b" strokeWidth={2} />
                </g>
              )}
              <rect
                x={PAD.left}
                y={0}
                width={plotW}
                height={HEIGHT}
                fill="transparent"
                onPointerMove={onMove}
                onPointerLeave={() => setHover(null)}
              />
            </svg>
          )
        )}

        {h && (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-zinc-900/95 px-2.5 py-1.5 text-xs shadow-xl ring-1 ring-white/15"
            style={{ left: Math.min(Math.max(x(h.soldAt), 60), width - 60) }}
          >
            <p className="font-bold tabular-nums text-white">{h.price.toLocaleString("en-US")} coins</p>
            <p className="text-zinc-400">{when(h.soldAt, range)}</p>
          </div>
        )}
      </div>

      {points.length >= 2 && (
        <div className="mt-2 flex justify-between text-[11px] tabular-nums text-zinc-500">
          <span>Low {low.toLocaleString("en-US")}</span>
          <span>{points.length} sales</span>
          <span>High {high.toLocaleString("en-US")}</span>
        </div>
      )}
    </div>
  );
}

/** Fetches a card's last 7 days of sales. */
export function useSales(cardId: string, finish = "normal", refreshKey: unknown = 0) {
  const [sales, setSales] = useState<SalePoint[] | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/market/history?cardId=${encodeURIComponent(cardId)}&finish=${finish}`)
      .then((r) => r.json())
      .then((d: { sales: SalePoint[] }) => alive && setSales(d.sales))
      .catch(() => alive && setSales([]));
    return () => {
      alive = false;
    };
  }, [cardId, finish, refreshKey]);
  return sales;
}
