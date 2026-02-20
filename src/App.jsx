import React, { useEffect, useMemo, useRef, useState } from "react";

import LiveDot from "./components/LiveDot";
import Card from "./components/Card";
import WalletBalances from "./components/WalletBalances";
import HoldingsTable from "./components/HoldingsTable";
import PricePanel from "./components/PricePanel";
import PerformancePanel from "./components/PerformancePanel";
import AllocationList from "./components/AllocationList";
import TradeHistoryTable from "./components/TradeHistoryTable";

import { MOCK_TRADES, MOCK_WALLETS, INITIAL_PRICES } from "./data/mockData";
import { useMockLivePrices } from "./hooks/useMockLivePrices";
import { computePortfolio } from "./lib/metrics";
import { fmtUsd } from "./lib/utils";
import { MOCK_SERIES } from "./lib/mockSeries";

function useTweenNumber(target, duration = 620) {
  const [val, setVal] = useState(() => (Number.isFinite(target) ? target : 0));
  const rafRef = useRef(null);
  const fromRef = useRef(Number.isFinite(target) ? target : 0);

  useEffect(() => {
    const to = Number.isFinite(target) ? target : 0;
    const from = Number.isFinite(fromRef.current) ? fromRef.current : 0;
    const start = performance.now();

    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const next = from + (to - from) * e;
      setVal(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = to;
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return val;
}

function useFlashClass(value) {
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
}

export default function App() {
  const [range, setRange] = useState("1D");
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "classic");

  useEffect(() => {
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  // chartTarget can be { type: "asset", symbol: "BTC" } OR { type: "wallet", walletId: "w1" }
  const [chartTarget, setChartTarget] = useState({ type: "asset", symbol: "BTC" });

  const { prices, status, lastTickAt, prevPrices } = useMockLivePrices(INITIAL_PRICES);
  const portfolio = useMemo(() => computePortfolio(MOCK_WALLETS, prices), [prices]);
  const animTotal = useTweenNumber(portfolio.totalValueUsd, 620);
  const totalFlash = useFlashClass(portfolio.totalValueUsd);

  const selectedWallet =
    chartTarget.type === "wallet"
      ? MOCK_WALLETS.find((w) => w.id === chartTarget.walletId) || null
      : null;

  const dominantWalletSymbol = useMemo(() => {
    if (!selectedWallet) return null;
    const sorted = [...selectedWallet.holdings].sort((a, b) => {
      const av = (a.quantity || 0) * (prices?.[a.symbol] || 0);
      const bv = (b.quantity || 0) * (prices?.[b.symbol] || 0);
      return bv - av;
    });
    return sorted[0]?.symbol || null;
  }, [selectedWallet, prices]);

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbarInner">
          <div>
            <div className="muted">Crypto portfolio dashboard</div>
            <div className={`h1 ${totalFlash}`}>{fmtUsd(animTotal)}</div>
            <div className="muted">Updated {new Date(lastTickAt).toLocaleTimeString()}</div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div className="seg" aria-label="Theme">
              <button
                className={`segBtn ${theme === "classic" ? "active" : ""}`}
                onClick={() => setTheme("classic")}
              >
                Classic
              </button>
              <button
                className={`segBtn ${theme === "neon" ? "active" : ""}`}
                onClick={() => setTheme("neon")}
              >
                Neon
              </button>
            </div>
            <LiveDot status={status} />
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="col colLeft">
          <WalletBalances
            wallets={MOCK_WALLETS}
            prices={prices}
            prevPrices={prevPrices}
            selectedWalletId={chartTarget?.type === "wallet" ? chartTarget.walletId : null}
            onSelectWallet={(walletId) => setChartTarget({ type: "wallet", walletId })}
          />

          <HoldingsTable
            holdings={portfolio.holdings}
            prices={prices}
            prevPrices={prevPrices}
            onSelectSymbol={(symbol) => setChartTarget({ type: "asset", symbol })}
          />
        </section>

        <section className="col colMid">
          <PricePanel
            chartTarget={chartTarget}
            wallet={selectedWallet}
            walletAccentSymbol={dominantWalletSymbol}
            prices={prices}
            series={MOCK_SERIES}
            range={range}
            setRange={setRange}
          />
          <TradeHistoryTable trades={MOCK_TRADES} />
        </section>

        <section className="col colRight">
          <PerformancePanel portfolio={portfolio} />
          <AllocationList allocation={portfolio.allocation} />
          <Card title="Demo notes" delay={220} right={<span className="muted">Frontend focus</span>}>
            <ul className="list">
              <li>Click a wallet to chart wallet value over time.</li>
              <li>Click a holding to chart that asset.</li>
              <li>Wallet balances update automatically as prices update.</li>
            </ul>
          </Card>
        </section>
      </main>

      <footer className="footer footerBar">
        <div className="footerLeft">
          <span className="muted">Built by</span>
          <span className="footerName">David Buckley</span>
          <span className="muted">•</span>
          <span className="muted">React</span>
          <span className="muted">•</span>
          <span className="muted">Vite</span>
          <span className="muted">•</span>
          <span className="muted">Live mock price engine</span>
          <span className="muted">•</span>
          <span className="muted">Mock data only — no real trading or financial advice.</span>
        </div>

        <div className="footerLinks">
          <a
            className="footerLink"
            href="https://crypto-dashboard-three-eta.vercel.app/"
            target="_blank"
            rel="noreferrer"
          >
            Live Demo
          </a>
          <span className="muted">•</span>
          <a
            className="footerLink"
            href="https://github.com/dbuckley023/crypto-dashboard"
            target="_blank"
            rel="noreferrer"
          >
            Source Code
          </a>
        </div>
      </footer>
    </div>
  );
}