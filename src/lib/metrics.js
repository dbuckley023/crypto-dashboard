export function computeHoldings(wallets) {
  const map = new Map();

  for (const w of wallets) {
    for (const h of w.holdings) {
      const cur = map.get(h.symbol) || { symbol: h.symbol, quantity: 0, costUsd: 0 };
      cur.quantity += h.quantity;
      cur.costUsd += h.quantity * h.avgCost;
      map.set(h.symbol, cur);
    }
  }

  return Array.from(map.values()).map((x) => ({
    symbol: x.symbol,
    quantity: x.quantity,
    avgCost: x.quantity > 0 ? x.costUsd / x.quantity : 0,
  }));
}

export function computePortfolio(wallets, prices) {
  const holdings = computeHoldings(wallets);

  let totalValueUsd = 0;
  let totalCostUsd = 0;

  for (const h of holdings) {
    const px = prices[h.symbol] ?? 0;
    totalValueUsd += h.quantity * px;
    totalCostUsd += h.quantity * h.avgCost;
  }

  const pnlUsd = totalValueUsd - totalCostUsd;
  const pnlPct = totalCostUsd > 0 ? pnlUsd / totalCostUsd : 0;

  const allocation = holdings
    .map((h) => {
      const valueUsd = h.quantity * (prices[h.symbol] ?? 0);
      return { symbol: h.symbol, valueUsd, pct: totalValueUsd > 0 ? valueUsd / totalValueUsd : 0 };
    })
    .sort((a, b) => b.valueUsd - a.valueUsd);

  return { totalValueUsd, totalCostUsd, pnlUsd, pnlPct, holdings, allocation };
}
