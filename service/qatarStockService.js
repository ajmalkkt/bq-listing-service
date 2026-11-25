import YahooFinance from "yahoo-finance2";

export const QATAR_STOCK_SYMBOLS = [
  "QNBK",
  "IQCD",
  "CBQK",
  "MARK",
  "ORDS",
  "QIBK",
  "QFLS",
  "VFQS",
];

const yahooFinance = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map();

export async function getQatarStockQuotes(symbols = QATAR_STOCK_SYMBOLS) {
  const yahooSymbols = symbols
    .map((symbol) => symbol.trim().toUpperCase())
    .filter(Boolean)
    .map((symbol) => symbol.endsWith(".QA") ? symbol : `${symbol}.QA`);
  const cacheKey = [...yahooSymbols].sort().join(",");
  const now = Date.now();
  const cachedQuotes = cache.get(cacheKey);
  if (cachedQuotes && now < cachedQuotes.expiresAt) return cachedQuotes.data;

  const quotes = await yahooFinance.quote(yahooSymbols);
  const quoteArray = Array.isArray(quotes) ? quotes : [quotes];
  const items = quoteArray
    .filter((quote) => quote && Number.isFinite(Number(quote.regularMarketPrice)))
    .map((quote) => ({
      symbol: String(quote.symbol).replace(/\.QA$/i, ""),
      name: String(quote.shortName || quote.longName || quote.symbol),
      price: Number(quote.regularMarketPrice),
      change: Number(Number(quote.regularMarketChange ?? 0).toFixed(3)),
      percentChange: Number(Number(quote.regularMarketChangePercent ?? 0).toFixed(2)),
      currency: String(quote.currency || "QAR"),
      timestamp: new Date().toISOString(),
    }));

  cache.set(cacheKey, { expiresAt: now + CACHE_TTL_MS, data: items });
  return items;
}
