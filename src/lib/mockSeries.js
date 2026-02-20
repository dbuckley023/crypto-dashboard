import { INITIAL_PRICES } from "../data/mockData";

function makeSeries(basePrice, points) {
  const series = [];
  let p = basePrice;

  for (let i = 0; i < points; i++) {
    const vol = 0.01;
    const drift = (Math.random() - 0.5) * vol;
    p = Math.max(0.01, p * (1 + drift));
    series.push({ t: Date.now() - (points - i) * 60_000, v: p });
  }

  return series;
}

export const MOCK_SERIES = {
  "1D": {
    BTC: makeSeries(INITIAL_PRICES.BTC, 96),
    ETH: makeSeries(INITIAL_PRICES.ETH, 96),
    SOL: makeSeries(INITIAL_PRICES.SOL, 96),
    USDC: makeSeries(INITIAL_PRICES.USDC, 96),
  },
  "1W": {
    BTC: makeSeries(INITIAL_PRICES.BTC, 7 * 48),
    ETH: makeSeries(INITIAL_PRICES.ETH, 7 * 48),
    SOL: makeSeries(INITIAL_PRICES.SOL, 7 * 48),
    USDC: makeSeries(INITIAL_PRICES.USDC, 7 * 48),
  },
  "1M": {
    BTC: makeSeries(INITIAL_PRICES.BTC, 30 * 24),
    ETH: makeSeries(INITIAL_PRICES.ETH, 30 * 24),
    SOL: makeSeries(INITIAL_PRICES.SOL, 30 * 24),
    USDC: makeSeries(INITIAL_PRICES.USDC, 30 * 24),
  },
  "1Y": {
    BTC: makeSeries(INITIAL_PRICES.BTC, 365),
    ETH: makeSeries(INITIAL_PRICES.ETH, 365),
    SOL: makeSeries(INITIAL_PRICES.SOL, 365),
    USDC: makeSeries(INITIAL_PRICES.USDC, 365),
  },
};
