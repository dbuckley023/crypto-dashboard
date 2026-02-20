export const SYMBOLS = ["BTC", "ETH", "SOL", "USDC"];

export const MOCK_WALLETS = [
  {
    id: "w1",
    name: "Coinbase",
    holdings: [
      { symbol: "BTC", quantity: 0.42, avgCost: 52000 },
      { symbol: "ETH", quantity: 6.1, avgCost: 2900 },
      { symbol: "USDC", quantity: 2500, avgCost: 1 },
    ],
  },
  {
    id: "w2",
    name: "Ledger",
    holdings: [
      { symbol: "SOL", quantity: 85, avgCost: 55 },
      { symbol: "ETH", quantity: 1.9, avgCost: 3100 },
    ],
  },
];

// --- 2‑year mock trade history ---
function mulberry32(seed) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generateMockTrades({ days = 730, count = 900, seed = 42 } = {}) {
  const rand = mulberry32(seed);
  const now = Date.now();
  const start = now - days * 24 * 60 * 60 * 1000;

  const symbols = ["BTC", "ETH", "SOL", "USDC"];
  const sides = ["BUY", "SELL"];

  const basePrices = {
    BTC: 63000,
    ETH: 3400,
    SOL: 82,
    USDC: 1,
  };

  const trades = Array.from({ length: count }, (_, idx) => {
    const symbol = symbols[Math.floor(rand() * symbols.length)];
    const side = sides[Math.floor(rand() * sides.length)];

    const ts = start + rand() * (now - start);

    const base = basePrices[symbol];
    const noise = (rand() - 0.5) * base * 0.15; // ±7.5%
    const price = Math.max(0.01, base + noise);

    const quantity =
      symbol === "BTC"
        ? rand() * 0.08 + 0.004
        : symbol === "ETH"
          ? rand() * 1.2 + 0.03
          : symbol === "SOL"
            ? rand() * 25 + 0.5
            : rand() * 2500 + 25;

    const feeUsd = price * quantity * (0.0015 + rand() * 0.002);

    return {
      id: `t_${idx}_${Math.floor(rand() * 1e9).toString(16)}`,
      ts: new Date(ts).toISOString(),
      symbol,
      side,
      quantity: Number(quantity.toFixed(4)),
      price: Number(price.toFixed(symbol === "USDC" ? 4 : 2)),
      feeUsd: Number(feeUsd.toFixed(2)),
    };
  });

  trades.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  return trades;
}

export const MOCK_TRADES = generateMockTrades();

export const INITIAL_PRICES = {
  BTC: 63000,
  ETH: 3400,
  SOL: 82,
  USDC: 1,
};
