import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Sparkline with hover tooltip (pure SVG + overlay)
 */
export default function Sparkline({
  data,
  width = 260,
  height = 90,
  formatValue = (v) => String(v),
  formatLabel = (t) => new Date(t).toLocaleString(),
  formatTooltipLabel,
  className,
}) {
  const padding = 6;
  const wrapRef = useRef(null);
  const [hover, setHover] = useState(null);
  const tooltipLabel = formatTooltipLabel || formatLabel;

  // Generate 2 years (~730 days) of mock daily data using a random walk
  function generateMockData() {
    const days = 730;
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    let price = 20000; // starting mock price
    const out = [];

    for (let i = days; i >= 0; i--) {
      // random walk movement
      const change = (Math.random() - 0.5) * 800;
      price = Math.max(1000, price + change);

      out.push({
        t: now - i * dayMs,
        v: Number(price.toFixed(2)),
      });
    }

    return out;
  }

  const useTweenNumber = (target, duration = 420) => {
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
      const t = setTimeout(() => setCls(""), 320);
      prev.current = value;
      return () => clearTimeout(t);
    }, [value]);

    return cls;
  };

  const animatedTooltipValue = useTweenNumber(hover?.v ?? 0, 420);
  const tooltipFlash = useFlashClass(hover?.v ?? 0);

  const chartData = (data && data.length > 0) ? data : generateMockData();
  const gridCount = 5;
  const lastV = chartData?.length ? chartData[chartData.length - 1].v : null;

  const { pathD, min, max } = useMemo(() => {
    if (!chartData || chartData.length === 0) return { pathD: "", min: 0, max: 0 };

    const vals = chartData.map((d) => d.v);
    const minV = Math.min(...vals);
    const maxV = Math.max(...vals);

    const toX = (i) => padding + (i / (chartData.length - 1)) * (width - padding * 2);
    const toY = (v) => {
      if (maxV === minV) return height / 2;
      const pct = (v - minV) / (maxV - minV);
      return height - padding - pct * (height - padding * 2);
    };

    const d = chartData
      .map((pt, i) => {
        const x = toX(i);
        const y = toY(pt.v);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

    return { pathD: d, min: minV, max: maxV };
  }, [chartData, width, height]);

  const toX = (i) => padding + (i / (chartData.length - 1)) * (width - padding * 2);
  const toY = (v) => {
    if (max === min) return height / 2;
    const pct = (v - min) / (max - min);
    return height - padding - pct * (height - padding * 2);
  };

  function handleMove(e) {
    if (!wrapRef.current || !chartData || chartData.length === 0) return;

    const rect = wrapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clampedX = Math.max(padding, Math.min(width - padding, x));
    const pct = (clampedX - padding) / (width - padding * 2);
    const i = Math.round(pct * (chartData.length - 1));

    const pt = chartData[i];
    const cx = toX(i);
    const cy = toY(pt.v);

    const tooltipW = 170;
    const tooltipH = 54;
    const left = Math.min(width - tooltipW - 6, Math.max(6, cx - tooltipW / 2));
    const top = Math.min(height - tooltipH - 6, Math.max(6, cy - tooltipH - 10));

    setHover({ i, x: cx, y: cy, t: pt.t, v: pt.v, left, top });
  }

  return (
    <div
      ref={wrapRef}
      className={className}
      style={{ position: "relative", width, height }}
      onMouseMove={handleMove}
      onMouseLeave={() => setHover(null)}
    >
      <svg width={width} height={height} style={{ display: "block" }}>
        {/* Gridlines */}
        {Array.from({ length: gridCount }).map((_, idx) => {
          const t = idx / (gridCount - 1);
          const y = padding + (height - padding * 2) * t;
          return (
            <line
              key={idx}
              x1={padding}
              x2={width - padding}
              y1={y}
              y2={y}
              stroke="currentColor"
              opacity={idx === 0 || idx === gridCount - 1 ? 0.10 : 0.06}
            />
          );
        })}
        {pathD ? <path d={pathD} fill="none" stroke="currentColor" strokeWidth="2" /> : null}

        {/* Current price guide line */}
        {Number.isFinite(lastV) ? (
          <line
            x1={padding}
            x2={width - padding}
            y1={toY(lastV)}
            y2={toY(lastV)}
            stroke="currentColor"
            opacity={0.14}
            strokeDasharray="4 6"
          />
        ) : null}

        {hover && (
          <>
            <line
              x1={hover.x}
              x2={hover.x}
              y1={padding}
              y2={height - padding}
              stroke="currentColor"
              opacity="0.25"
            />
            <circle cx={hover.x} cy={hover.y} r="3.5" fill="currentColor" />
          </>
        )}
      </svg>

      {hover && (
        <div
          style={{
            position: "absolute",
            left: hover.left,
            top: hover.top,
            width: 170,
            padding: "8px 10px",
            borderRadius: 12,
            border: "1px solid var(--border)",
            background: "rgba(17,17,20,0.92)",
            backdropFilter: "blur(6px)",
            pointerEvents: "none",
          }}
        >
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>{tooltipLabel(hover.t)}</div>
          <div className={tooltipFlash} style={{ fontSize: 14, fontWeight: 800 }}>
            {formatValue(animatedTooltipValue)}
          </div>
        </div>
      )}
    </div>
  );
}