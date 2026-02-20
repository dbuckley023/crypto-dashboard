import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "./Card";
import Sparkline from "./Sparkline";
import { fmtUsd } from "../lib/utils";

// Deterministic PRNG so fallback history is stable
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANGE_CFG = {
  // 24 hours, 5-min points
  "1D": { points: 288, stepMs: 5 * 60 * 1000 },
  // 7 days, hourly points
  "1W": { points: 168, stepMs: 60 * 60 * 1000 },
  // ~30 days, 4-hour points
  "1M": { points: 180, stepMs: 4 * 60 * 60 * 1000 },
  // 1 year, daily points
  "1Y": { points: 365, stepMs: 24 * 60 * 60 * 1000 },
};

function seedFrom(sym, range) {
  const a = sym.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  const b = range.split("").reduce((s, c) => s + c.charCodeAt(0), 0);
  return (a * 31 + b * 97) | 0;
}

function volFor(sym, range) {
  const base = sym === "USDC" ? 0.0005 : sym === "SOL" ? 0.03 : sym === "ETH" ? 0.018 : 0.016;
  const mult = range === "1D" ? 0.7 : range === "1W" ? 1.0 : range === "1M" ? 1.4 : 2.2;
  return base * mult;
}

function generateFallbackSeries({ sym, range, startPrice }) {
  const cfg = RANGE_CFG[range] ?? RANGE_CFG["1D"];
  const rand = mulberry32(seedFrom(sym, range));
  const now = Date.now();

  let price = startPrice;
  const out = [];

  for (let i = cfg.points - 1; i >= 0; i--) {
    const t = now - i * cfg.stepMs;
    const v = volFor(sym, range);
    const drift = (rand() - 0.5) * v;
    const next = price * (1 + drift);
    price = sym === "USDC" ? Math.min(1.005, Math.max(0.995, next)) : Math.max(0.01, next);
    out.push({ t, v: Number(price.toFixed(sym === "USDC" ? 4 : 2)) });
  }

  return out;
}

function isValidRangeSeries(arr, range) {
  if (!Array.isArray(arr) || arr.length < 2) return false;

  const cfg = RANGE_CFG[range];
  if (!cfg) return true;

  // Expected span for this range
  const expectedSpan = (cfg.points - 1) * cfg.stepMs;

  const times = arr.map((p) => p?.t).filter((t) => Number.isFinite(t));
  if (times.length < 2) return false;

  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const span = maxT - minT;

  // Also require a reasonable point count (prevents 1D data being reused for 1Y)
  const enoughPoints = arr.length >= Math.max(20, Math.floor(cfg.points * 0.6));

  // If timestamps are not spanning most of the expected window, treat it as invalid
  const enoughSpan = span >= expectedSpan * 0.75;

  return enoughPoints && enoughSpan;
}

function buildWalletSeries(wallet, seriesByRange, range, prices) {
  // Use BTC timestamps as the timeline base (all your series are same length per range)
  const base = seriesByRange?.[range]?.["BTC"];
  const baseOk = isValidRangeSeries(base, range);
  if (!wallet) return [];

  // If BTC series is missing, create a fallback timeline from BTC start price
  const baseTimeline =
    baseOk
      ? base
      : generateFallbackSeries({ sym: "BTC", range, startPrice: prices?.BTC ?? 50000 });

  return baseTimeline.map((pt, i) => {
    let total = 0;

    for (const h of wallet.holdings) {
      const assetSeries = seriesByRange?.[range]?.[h.symbol];
      const fallback = generateFallbackSeries({
        sym: h.symbol,
        range,
        startPrice: prices?.[h.symbol] ?? 100,
      });
      const priceAtT = (assetSeries?.[i]?.v ?? fallback?.[i]?.v) ?? 0;
      total += h.quantity * priceAtT;
    }

    return { t: pt.t, v: total };
  });
}

function pxPerPointForRange(range) {
  if (range === "1D") return 10;
  if (range === "1W") return 6;
  if (range === "1M") return 4;
  return 2.5; // 1Y
}

export default function PricePanel({ chartTarget, wallet, walletAccentSymbol, prices, series, range, setRange }) {
  const isWallet = chartTarget.type === "wallet";

  const symbol = isWallet ? "BTC" : chartTarget.symbol;

  const accentMap = {
    BTC: "var(--btc)",
    ETH: "var(--eth)",
    SOL: "var(--sol)",
    USDC: "var(--usdc)",
  };

  const accent = isWallet
    ? (accentMap[walletAccentSymbol] || "var(--glow-a)")
    : (accentMap[symbol] || "var(--glow-a)");

  const data = useMemo(() => {
    if (isWallet) return buildWalletSeries(wallet, series, range, prices);

    const raw = series?.[range]?.[symbol];
    if (isValidRangeSeries(raw, range)) return raw;

    // Fallback ensures timestamps actually span the selected range
    return generateFallbackSeries({ sym: symbol, range, startPrice: prices?.[symbol] ?? 100 });
  }, [isWallet, wallet, series, range, symbol, prices]);

  const headerTitle = isWallet ? `Wallet: ${wallet?.name ?? "Unknown"}` : symbol;

  const liveValue = useMemo(() => {
    if (!isWallet) return prices?.[symbol] ?? 0;
    if (!wallet) return 0;
    return wallet.holdings.reduce((sum, h) => sum + h.quantity * (prices?.[h.symbol] ?? 0), 0);
  }, [isWallet, wallet, prices, symbol]);

  // Zoom controls (Coinbase-ish)
  const [zoomX, setZoomX] = useState(1);
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

  const scrollRef = useRef(null);
  const [viewportW, setViewportW] = useState(520);

  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateEdgeFades = () => {
    const el = scrollRef.current;
    if (!el) return;
    const maxScroll = Math.max(0, el.scrollWidth - el.clientWidth);
    const left = el.scrollLeft;
    // small epsilon so it doesn't flicker near the edges
    const eps = 2;
    setCanLeft(left > eps);
    setCanRight(left < maxScroll - eps);
  };

  useEffect(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const ro = new ResizeObserver(() => setViewportW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    updateEdgeFades();
  }, [viewportW]);

  const pxPerPoint = pxPerPointForRange(range);
  const pointCount = data?.length ?? 0;
  const baseW = Math.max(1, Math.round(pointCount * pxPerPoint));

  // Minimum zoom that fits the whole range into the visible viewport.
  // (So when fully zoomed out, 1M shows the whole month and 1Y shows the whole year.)
  const minZoom = clamp(viewportW / baseW, 0.12, 1);

  // Always enforce minZoom so the chart can fully fit the selected range.
  const effectiveZoom = Math.max(zoomX, minZoom);
  const innerW = Math.max(viewportW, Math.round(baseW * effectiveZoom));

  // Keep scroll position stable when zoom changes (preserve % position)
  const lastMetricsRef = useRef({ maxScroll: 0, scrollLeft: 0 });

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const prev = lastMetricsRef.current;
    const prevMax = Math.max(1, prev.maxScroll);
    const pct = prevMax > 0 ? prev.scrollLeft / prevMax : 0;

    requestAnimationFrame(() => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      el.scrollLeft = pct * Math.max(0, maxScroll);
      lastMetricsRef.current = { maxScroll, scrollLeft: el.scrollLeft };
      updateEdgeFades();
    });
  }, [innerW]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      lastMetricsRef.current = { maxScroll, scrollLeft: el.scrollLeft };
      updateEdgeFades();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // initialize
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const formatLabel = (t) => {
    const d = new Date(t);
    if (range === "1D") {
      return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    }
    if (range === "1W") {
      return d.toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
    }
    if (range === "1M") {
      return d.toLocaleDateString(undefined, { month: "short", day: "2-digit" });
    }
    // 1Y
    return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
  };

  const formatTooltipLabel = (t) => {
    const d = new Date(t);
    return d.toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const zoomOut = () => setZoomX((z) => clamp(Number((z - 0.2).toFixed(2)), minZoom, 5));
  const zoomIn = () => setZoomX((z) => clamp(Number((z + 0.2).toFixed(2)), minZoom, 5));
  const zoomReset = () => setZoomX(1);
  const zoomFit = () => setZoomX(minZoom);

  const onWheelZoomOrPan = (e) => {
    const el = scrollRef.current;
    if (!el) return;

    // Ctrl/Cmd + wheel = zoom
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const dir = e.deltaY > 0 ? -1 : 1;
      setZoomX((z) => clamp(Number((z + dir * 0.15).toFixed(2)), minZoom, 5));
      return;
    }

    // Normal wheel pans horizontally while hovering chart
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
  };

  const onMouseDownPan = (e) => {
    const el = scrollRef.current;
    if (!el) return;

    const startX = e.clientX;
    const startLeft = el.scrollLeft;

    const onMove = (ev) => {
      el.scrollLeft = startLeft - (ev.clientX - startX);
    };

    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  return (
    <Card
      title="Chart"
      accent={accent}
      right={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div className="seg">
            {["1D", "1W", "1M", "1Y"].map((r) => (
              <button
                key={r}
                className={`segBtn ${r === range ? "active" : ""}`}
                onClick={() => {
                  setRange(r);
                  // Force a fit on the NEXT render (minZoom depends on the new range)
                  setZoomX(0);
                  requestAnimationFrame(() => {
                    const el = scrollRef.current;
                    if (el) el.scrollLeft = el.scrollWidth;
                  });
                }}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="seg" aria-label="Zoom">
            <button className="segBtn" onClick={zoomOut} title="Zoom out" disabled={effectiveZoom <= minZoom + 0.0001}>
              −
            </button>
            <button className="segBtn" onClick={zoomFit} title="Fit to range">
              Fit
            </button>
            <button className="segBtn" onClick={zoomReset} title="Reset zoom">
              {Math.round(effectiveZoom * 100)}%
            </button>
            <button className="segBtn" onClick={zoomIn} title="Zoom in">
              +
            </button>
          </div>
        </div>
      }
    >
      <div className="chartHeader">
        <div>
          <div className="muted">Selected</div>
          <div className="h2">{headerTitle}</div>
        </div>
        <div className="right">
          <div className="muted">{isWallet ? "Live wallet value" : "Live price"}</div>
          <div className="h2">{fmtUsd(liveValue)}</div>
        </div>
      </div>

      <div className="chartWrap" style={{ position: "relative" }}>
        {/* Edge fades (appear only when scrollable) */}
        {canLeft ? (
          <div
            className="chartFadeLeft"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              bottom: 0,
              width: 28,
              pointerEvents: "none",
              background:
                "linear-gradient(90deg, rgba(8,8,12,.75), rgba(8,8,12,.0))",
            }}
          />
        ) : null}
        {canRight ? (
          <div
            className="chartFadeRight"
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: 28,
              pointerEvents: "none",
              background:
                "linear-gradient(270deg, rgba(8,8,12,.75), rgba(8,8,12,.0))",
            }}
          />
        ) : null}
        <div className="chartLine">
          <div
            ref={scrollRef}
            className="chartScroll"
            onWheel={onWheelZoomOrPan}
            onMouseDown={onMouseDownPan}
          >
            <Sparkline
              className="chartCanvas"
              data={data}
              width={innerW}
              height={160}
              formatLabel={formatLabel}
              formatTooltipLabel={formatTooltipLabel}
              formatValue={(v) => fmtUsd(v)}
            />
          </div>
        </div>

        <div className="chartMeta">
          <div className="muted">Drag to pan • Ctrl/Cmd + scroll to zoom</div>
        </div>
      </div>
    </Card>
  );
}