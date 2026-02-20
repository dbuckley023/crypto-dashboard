import React from "react";
import Card from "./Card";
import { fmtPct, fmtUsd } from "../lib/utils";

export default function AllocationList({ allocation }) {
  return (
    <Card title="Allocation">
      <div className="allocList">
        {allocation.map((a) => (
          <div key={a.symbol} className="allocRow">
            <div className="allocLeft">
              <div className="assetSymbol">{a.symbol}</div>
              <div className="muted">{fmtUsd(a.valueUsd)}</div>
            </div>
            <div className="allocRight">
              <div className="bar">
                <div className="barFill" style={{ width: `${(a.pct * 100).toFixed(1)}%` }} />
              </div>
              <div className="muted right" style={{ minWidth: 58 }}>
                {fmtPct(a.pct)}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
