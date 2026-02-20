import React, { useEffect, useRef, useState } from "react";
import Card from "./Card";
import { fmtUsd, round2 } from "../lib/utils";

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

export default function WalletBalances({ wallets, prices, prevPrices, onSelectWallet, selectedWalletId }) {
  return (
    <Card title="Wallet balances" right={<span className="muted">Mock</span>}>
      <div className="walletGrid">
        {wallets.map((w) => {
          const valueNow = w.holdings.reduce(
            (sum, h) => sum + h.quantity * (prices[h.symbol] ?? 0),
            0
          );

          const valuePrev = w.holdings.reduce((sum, h) => {
            const prevPx = prevPrices?.[h.symbol] ?? prices[h.symbol] ?? 0;
            return sum + h.quantity * prevPx;
          }, 0);

          const walletTone = valueNow > valuePrev ? "pos" : valueNow < valuePrev ? "neg" : "";

          return (
            <button
              key={w.id}
              className={`walletCard ${w.id === selectedWalletId ? "selected" : ""}`}
              onClick={() => onSelectWallet(w.id)}
            >
              <div className="walletName">{w.name}</div>
              {(() => {
                const anim = useTweenNumber(valueNow, 520);
                const flash = useFlashClass(valueNow);
                return <div className={`walletValue ${walletTone} ${flash}`}>{fmtUsd(anim)}</div>;
              })()}

              <div className="walletHoldings">
                {w.holdings.map((h) => {
                  const px = prices[h.symbol] ?? 0;
                  const prevPx = prevPrices?.[h.symbol] ?? px;
                  const tone = px > prevPx ? "pos" : px < prevPx ? "neg" : "";

                  return (
                    <span key={h.symbol} className="pill">
                      <span
                        className="assetIcon"
                        style={{
                          "--icon":
                            ({
                              BTC: "var(--btc)",
                              ETH: "var(--eth)",
                              SOL: "var(--sol)",
                              USDC: "var(--usdc)",
                            }[h.symbol] || "var(--glow-a)")
                        }}
                      >
                        {h.symbol}
                      </span>
                      <span className={`pillNum ${tone}`}>{round2(h.quantity)}</span>
                    </span>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}