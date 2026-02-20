import React from "react";

export default function Stat({ label, value, sub, tone }) {
  return (
    <div className={`stat ${tone || ""}`.trim()}>
      <div className="statLabel">{label}</div>
      <div className="statValue">{value}</div>
      {sub ? <div className="statSub">{sub}</div> : null}
    </div>
  );
}
