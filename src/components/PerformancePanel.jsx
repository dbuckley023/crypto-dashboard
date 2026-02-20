import React from "react";
import Card from "./Card";
import Stat from "./Stat";
import { fmtPct, fmtUsd } from "../lib/utils";

export default function PerformancePanel({ portfolio }) {
  const pnlTone = portfolio.pnlUsd > 0 ? "pos" : portfolio.pnlUsd < 0 ? "neg" : "";

  return (
    <Card title="Performance metrics">
      <div className="statsGrid">
        <Stat label="Total Value" value={fmtUsd(portfolio.totalValueUsd)} />
        <Stat label="Cost Basis" value={fmtUsd(portfolio.totalCostUsd)} />
        <Stat
          label="Total P&L"
          value={fmtUsd(portfolio.pnlUsd)}
          sub={fmtPct(portfolio.pnlPct)}
          tone={pnlTone}
        />
        <Stat label="Assets" value={`${portfolio.holdings.length}`} />
      </div>

      <div className="muted" style={{ marginTop: 10 }}>
        (Mock-only) P&L is computed from avg cost vs live price.
      </div>
    </Card>
  );
}
