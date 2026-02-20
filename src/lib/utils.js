export function fmtUsd(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "$0.00";
  return num.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

export function fmtPct(n) {
  const num = Number(n);
  if (!Number.isFinite(num)) return "0.00%";
  return `${(num * 100).toFixed(2)}%`;
}

export function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function round2(n) {
  return Math.round(n * 100) / 100;
}
