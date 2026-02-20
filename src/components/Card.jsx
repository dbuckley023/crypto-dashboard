import React from "react";

export default function Card({ title, children, right, accent, delay = 0, className = "" }) {
  return (
    <div
      className={`card luxeEnter ${className}`}
      style={{ "--accent": accent || undefined, animationDelay: `${delay}ms` }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        const mx = ((e.clientX - r.left) / r.width) * 100;
        const my = ((e.clientY - r.top) / r.height) * 100;
        e.currentTarget.style.setProperty("--mx", `${mx}%`);
        e.currentTarget.style.setProperty("--my", `${my}%`);
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.removeProperty("--mx");
        e.currentTarget.style.removeProperty("--my");
      }}
    >
      <div className="cardHeader">
        <div>
          <div className="cardTitle">{title}</div>
        </div>
        <div>{right}</div>
      </div>
      <div className="cardBody">{children}</div>
    </div>
  );
}
