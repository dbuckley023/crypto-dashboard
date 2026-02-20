import { useEffect, useRef, useState } from "react";

const IDS = {
  BTC: "bitcoin",
  ETH: "ethereum",
  SOL: "solana",
  USDC: "usd-coin",
};

export function useLivePricesCoingecko(symbols) {
  const [prices, setPrices] = useState({});
  const [status, setStatus] = useState("connecting");
  const [lastTickAt, setLastTickAt] = useState(Date.now());
  const prevRef = useRef({});

  useEffect(() => {
    let alive = true;

    async function poll() {
      try {
        setStatus("connected");

        const ids = symbols.map((s) => IDS[s]).filter(Boolean).join(",");
        const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;

        const res = await fetch(url);
        const json = await res.json();

        const next = {};
        for (const sym of symbols) {
          const id = IDS[sym];
          next[sym] = json?.[id]?.usd ?? next[sym];
        }

        if (!alive) return;
        prevRef.current = prices;
        setPrices(next);
        setLastTickAt(Date.now());
      } catch (e) {
        if (!alive) return;
        setStatus("disconnected");
      }
    }

    poll();
    const id = setInterval(poll, 12_000); // poll every 12s (safer for rate limits)

    return () => {
      alive = false;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.join(",")]);

  return { prices, prevPrices: prevRef.current, status, lastTickAt };
}