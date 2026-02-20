import { useEffect, useRef, useState } from "react";
import { clamp } from "../lib/utils";

// Deterministic PRNG so mock history is stable across reloads
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const RANGE_CFG = {
  // 1 day of points (5-minute candles)
  "1D": { points: 288, stepMs: 5 * 60 * 1000 },
  // 1 week of points (hourly)
  "1W": { points: 168, stepMs: 60 * 60 * 1000 },
  // 1 month of points (4-hour)
  "1M": { points: 180, stepMs: 4 * 60 * 60 * 1000 },
  // 1 year of points (daily)
  "1Y": { points: 365, stepMs: 24 * 60 * 60 * 1000 },
};

function volFor(sym, range) {
  // Slightly different personalities per asset
  const base = sym === "USDC" ? 0.0005 : sym === "SOL" ? 0.03 : sym === "ETH" ? 0.018 : 0.016;

  // Scale volatility by range so longer ranges have bigger swings
  const mult = range === "1D" ? 0.7 : range === "1W" ? 1.0 : range === "1M" ? 1.4 : 2.2;
  return base * mult;
}

function generateSeriesForRange({ sym, range, startPrice, seed = 1 }) {
  const cfg = RANGE_CFG[range];
  if (!cfg) return [];

  const rand = mulberry32(seed);
  const now = Date.now();

  let price = startPrice;
  const out = [];

  // Build oldest -> newest so x-axis labels make sense
  for (let i = cfg.points - 1; i >= 0; i--) {
    const t = now - i * cfg.stepMs;

    const v = volFor(sym, range);
    const drift = (rand() - 0.5) * v; // -v/2 .. +v/2

    const updated = price * (1 + drift);
    price = sym === "USDC" ? clamp(updated, 0.995, 1.005) : Math.max(0.01, updated);

    out.push({ t, v: Number(price.toFixed(sym === "USDC" ? 4 : 2)) });
  }

  return out;
}

// Builds the same shape your chart expects: series[range][symbol] = [{t,v}, ...]
export function buildMockHistorySeries(basePrices, symbols = Object.keys(basePrices || {})) {
  const ranges = ["1D", "1W", "1M", "1Y"];
  const series = {};

  for (const r of ranges) {
    series[r] = {};
    for (const sym of symbols) {
      const base = basePrices?.[sym] ?? (sym === "USDC" ? 1 : 100);
      // Different seed per symbol+range but deterministic
      const seed =
        (sym.split("").reduce((a, c) => a + c.charCodeAt(0), 0) +
          r.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) |
        0;

      series[r][sym] = generateSeriesForRange({ sym, range: r, startPrice: base, seed });
    }
  }

  return series;
}

export function useMockLivePrices(initial) {
  const [prices, setPrices] = useState(initial);
  const [status, setStatus] = useState("connecting");
  const [lastTickAt, setLastTickAt] = useState(Date.now());

  const prevRef = useRef(prices);

  useEffect(() => {
    setStatus("connected");

    const id = window.setInterval(() => {
      setPrices((prev) => {
        const next = { ...prev };

        for (const sym of Object.keys(next)) {
          const baseVol =
            sym === "USDC" ? 0.0002 : sym === "SOL" ? 0.012 : sym === "ETH" ? 0.009 : 0.008;

          const drift = (Math.random() - 0.5) * baseVol;
          const updated = next[sym] * (1 + drift);

          next[sym] = sym === "USDC" ? clamp(updated, 0.995, 1.005) : Math.max(0.01, updated);
        }

        return next;
      });

      setLastTickAt(Date.now());
    }, 1200);

    return () => {
      setStatus("disconnected");
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    prevRef.current = prices;
  }, [prices]);

  return { prices, status, lastTickAt, prevPrices: prevRef.current };
}
