import React, { useEffect, useRef, useState } from "react";
import Card from "./Card";
import { fmtPct, fmtUsd, round2 } from "../lib/utils";

const useTweenNumber = (target, duration = 520) => {
  const [val, setVal] = useState(() => (Number.isFinite(target) ? target : 0));
  const rafRef = useRef(null);
  const fromRef = useRef(val);

  useEffect(() => {
    const to = Number.isFinite(target) ? target : 0;
    const from = Number.isFinite(fromRef.current) ? fromRef.current : 0;
    const start = performance.now();
    cancelAnimationFrame(rafRef.current);

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      const next = from + (to - from) * e;
      setVal(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return val;
};

const useFlashClass = (value) => {
  const [cls, setCls] = useState("");
  const prev = useRef(value);

  useEffect(() => {
    if (!Number.isFinite(value) || !Number.isFinite(prev.current)) {
      prev.current = value;
      return;
    }
    if (value === prev.current) return;

    setCls(value > prev.current ? "flashPos" : "flashNeg");
    const t = setTimeout(() => setCls(""), 380);
    prev.current = value;
    return () => clearTimeout(t);
  }, [value]);

  return cls;
};

function HoldingsRow({ r, onSelectSymbol }) {
  const priceTone = r.delta > 0 ? "pos" : r.delta < 0 ? "neg" : "";
  const pnlTone = r.pnl > 0 ? "pos" : r.pnl < 0 ? "neg" : "";

  const iconMap = {
    BTC: "var(--btc)",
    ETH: "var(--eth)",
    SOL: "var(--sol)",
    USDC: "var(--usdc)",
  };
  const iconColor = iconMap[r.symbol] || "var(--glow-a)";

  const animPx = useTweenNumber(r.px, 520);
  const animValue = useTweenNumber(r.value, 520);
  const animPnl = useTweenNumber(r.pnl, 520);
  const animPnlPct = useTweenNumber(r.pnlPct, 520);

  const flashPx = useFlashClass(r.px);
  const flashValue = useFlashClass(r.value);
  const flashPnl = useFlashClass(r.pnl);
  const flashPnlPct = useFlashClass(r.pnlPct);

  return (
    <tr className="rowHover" onClick={() => onSelectSymbol(r.symbol)}>
      <td>
        <div className="assetCell">
          <span className="assetIcon" style={{ "--icon": iconColor }}>
            {r.symbol}
          </span>
          <span className="assetSymbol">{r.symbol}</span>
          <span className={`badge ${priceTone}`}>{fmtPct(r.delta)}</span>
        </div>
      </td>
      <td className="right">{round2(r.quantity)}</td>
      <td className={`right ${priceTone} ${flashPx}`}>{fmtUsd(animPx)}</td>
      <td className={`right ${flashValue}`}>{fmtUsd(animValue)}</td>
      <td className={`right ${pnlTone} ${flashPnl}`}>
        {fmtUsd(animPnl)}
        <div className={`muted ${flashPnlPct}`}>{fmtPct(animPnlPct)}</div>
      </td>
    </tr>
  );
}

export default function HoldingsTable({ holdings, prices, prevPrices, onSelectSymbol }) {
  const rows = holdings.map((h) => {
    const px = prices[h.symbol] ?? 0;
    const prev = prevPrices?.[h.symbol] ?? px;
    const value = h.quantity * px;
    const cost = h.quantity * h.avgCost;
    const pnl = value - cost;
    const pnlPct = cost > 0 ? pnl / cost : 0;
    const delta = prev > 0 ? (px - prev) / prev : 0;
    return { ...h, px, value, pnl, pnlPct, delta };
  });

  return (
    <Card title="Holdings">
      <div className="tableWrap" role="region" aria-label="Holdings table">
        <table className="table">
          <thead>
            <tr>
              <th>Asset</th>
              <th className="right">Qty</th>
              <th className="right">Price</th>
              <th className="right">Value</th>
              <th className="right">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <HoldingsRow key={r.symbol} r={r} onSelectSymbol={onSelectSymbol} />
            ))}
          </tbody>
        </table>

        <div className="muted" style={{ marginTop: 8 }}>
          Tip: click a row to load that asset in the chart.
        </div>
      </div>
    </Card>
  );
}
