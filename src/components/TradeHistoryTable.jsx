import React, { useEffect, useMemo, useState } from "react";
import Card from "./Card";
import { clamp, fmtDate, fmtUsd } from "../lib/utils";

// Deterministic PRNG so mock data is stable across renders
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateMockTrades({ days = 730, count = 900, seed = 42 } = {}) {
  const rand = mulberry32(seed);
  const now = Date.now();
  const start = now - days * 24 * 60 * 60 * 1000;

  const symbols = ["BTC", "ETH", "SOL", "XRP", "AVAX"];
  const sides = ["BUY", "SELL"];
  const base = { BTC: 42000, ETH: 2400, SOL: 110, XRP: 0.58, AVAX: 38 };

  const trades = Array.from({ length: count }, (_, idx) => {
    const symbol = symbols[Math.floor(rand() * symbols.length)];
    const side = sides[Math.floor(rand() * sides.length)];

    // Random timestamp across the last 2 years
    const ts = start + rand() * (now - start);

    // Price around base with some drift/noise
    const noise = (rand() - 0.5) * base[symbol] * 0.18; // ±9%
    const price = Math.max(0.01, base[symbol] + noise);

    // Quantity scaled per asset
    const quantity =
      symbol === "BTC"
        ? rand() * 0.08 + 0.004
        : symbol === "ETH"
          ? rand() * 1.2 + 0.03
          : symbol === "SOL"
            ? rand() * 25 + 0.5
            : symbol === "AVAX"
              ? rand() * 18 + 0.5
              : rand() * 2500 + 25;

    // Fee: ~0.15% to 0.35% of notional
    const feeRate = 0.0015 + rand() * 0.002;
    const feeUsd = price * quantity * feeRate;

    return {
      id: `t_${idx}_${Math.floor(rand() * 1e9).toString(16)}`,
      ts: new Date(ts).toISOString(),
      symbol,
      side,
      quantity: Number(quantity.toFixed(4)),
      price: Number(price.toFixed(symbol === "XRP" ? 4 : 2)),
      feeUsd: Number(feeUsd.toFixed(2)),
    };
  });

  // Newest first
  trades.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  return trades;
}

export default function TradeHistoryTable({ trades }) {
  const effectiveTrades = useMemo(() => {
    const DAYS = 730;
    const now = Date.now();
    const start = now - DAYS * 24 * 60 * 60 * 1000;

    // If no trades were provided, generate a full 2-year mock set.
    if (!Array.isArray(trades) || trades.length === 0) {
      return generateMockTrades({ days: DAYS, count: 900, seed: 42 });
    }

    // If trades ARE provided but don't go back 2 years, pad with older mock trades.
    const oldest = Math.min(...trades.map((t) => new Date(t.ts).getTime()).filter(Number.isFinite));

    if (!Number.isFinite(oldest) || oldest <= start) {
      return trades;
    }

    // Generate older trades and merge (avoid ID collisions)
    const pad = generateMockTrades({ days: DAYS, count: 900, seed: 1337 })
      .filter((t) => new Date(t.ts).getTime() < oldest);

    const seen = new Set(trades.map((t) => t.id));
    const merged = [...trades, ...pad.filter((t) => !seen.has(t.id))];

    // Newest first
    merged.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
    return merged;
  }, [trades]);
  const [q, setQ] = useState("");
  const [side, setSide] = useState("ALL");
  const [sortKey, setSortKey] = useState("ts");
  const [sortDir, setSortDir] = useState("desc");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return effectiveTrades.filter((t) => {
      const matchesQuery =
        !query ||
        t.symbol.toLowerCase().includes(query) ||
        t.side.toLowerCase().includes(query) ||
        t.id.toLowerCase().includes(query);

      const matchesSide = side === "ALL" ? true : t.side === side;
      return matchesQuery && matchesSide;
    });
  }, [effectiveTrades, q, side]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      const dir = sortDir === "asc" ? 1 : -1;

      if (sortKey === "ts") return dir * (new Date(av).getTime() - new Date(bv).getTime());
      if (typeof av === "number" && typeof bv === "number") return dir * (av - bv);
      return dir * String(av).localeCompare(String(bv));
    });
    return copy;
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = clamp(page, 1, totalPages);
  const pageRows = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  useEffect(() => setPage(1), [q, side]);

  function toggleSort(key) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sortIndicator = (key) => (key !== sortKey ? "" : sortDir === "asc" ? " ▲" : " ▼");

  return (
    <Card
      title="Trade history"
      right={
        <div className="filters">
          <input
            className="input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search symbol, side, id…"
          />
          <select className="select" value={side} onChange={(e) => setSide(e.target.value)}>
            <option value="ALL">All</option>
            <option value="BUY">Buy</option>
            <option value="SELL">Sell</option>
          </select>
        </div>
      }
    >
      <div className="tableWrap" role="region" aria-label="Trade history table">
        <table className="table">
          <thead>
            <tr>
              <th className="click" onClick={() => toggleSort("ts")}>
                Date{sortIndicator("ts")}
              </th>
              <th className="click" onClick={() => toggleSort("symbol")}>
                Symbol{sortIndicator("symbol")}
              </th>
              <th className="click" onClick={() => toggleSort("side")}>
                Side{sortIndicator("side")}
              </th>
              <th className="right click" onClick={() => toggleSort("quantity")}>
                Qty{sortIndicator("quantity")}
              </th>
              <th className="right click" onClick={() => toggleSort("price")}>
                Price{sortIndicator("price")}
              </th>
              <th className="right click" onClick={() => toggleSort("feeUsd")}>
                Fee{sortIndicator("feeUsd")}
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((t) => (
              <tr key={t.id}>
                <td>{fmtDate(t.ts)}</td>
                <td>
                  <span className="assetSymbol">{t.symbol}</span>
                </td>
                <td>
                  <span className={`badge ${t.side === "BUY" ? "pos" : "neg"}`}>{t.side}</span>
                </td>
                <td className="right">{t.quantity}</td>
                <td className="right">{fmtUsd(t.price)}</td>
                <td className="right">{fmtUsd(t.feeUsd)}</td>
              </tr>
            ))}

            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted" style={{ padding: 14 }}>
                  No results.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>

        <div className="pager">
          <button
            className="btn"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Prev
          </button>
          <div className="muted">
            Page <b>{currentPage}</b> / {totalPages}
          </div>
          <button
            className="btn"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      </div>
    </Card>
  );
}
