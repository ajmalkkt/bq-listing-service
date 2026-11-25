import NodeCache from "node-cache";
import { getQatarStockQuotes, QATAR_STOCK_SYMBOLS } from "./qatarStockService.js";

const cache = new NodeCache({ stdTTL: 0, checkperiod: 120 });
const ONE_DAY_SECONDS = 24 * 60 * 60;
const STOCK_BATCH_SIZE = 5;
const STOCK_BATCH_INTERVAL_MS = 2 * 60 * 1000;
const STOCK_REFRESH_INTERVAL_MS = 2 * 60 * 60 * 1000;
const STOCK_RETRY_DELAY_MS = 15 * 60 * 1000;
const STOCK_RATE_LIMIT_RETRY_DELAY_MS = 2 * 60 * 1000;
const STOCK_CACHE_SECONDS = 3 * 60 * 60;
const STOCK_CACHE_KEY = "qatar-feed-stocks-timeseries-v4";
const STOCK_EXCHANGE = "QE";
const US_STOCK_SYMBOLS = ["AAPL", "MSFT", "NVDA", "GOOGL", "AMZN", "TSLA"];
const QATAR_STOCK_SYMBOL_SET = new Set(QATAR_STOCK_SYMBOLS);
const STOCK_SYMBOLS = [...QATAR_STOCK_SYMBOLS, ...US_STOCK_SYMBOLS];
const unsupportedStockSymbols = new Set();
let nextStockBatchIndex = 0;
let retryStockSymbols = [];
let lastStockBatchAt = 0;
let lastFullStockRefreshAt = 0;
let stockBatchInProgress = false;
let stockRetryAt = 0;
let lastStockRefreshError;

function logUnsupportedStockSymbol(symbol, error) {
  if (unsupportedStockSymbols.has(symbol)) return;
  unsupportedStockSymbols.add(symbol);
  console.warn(`[QatarFeeds] Unsupported stock symbol ${symbol}: ${safeProviderErrorMessage(error)}`);
}

function asRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}

function safeHttpUrl(value) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function safeImageUrl(...values) {
  for (const value of values) {
    const image = asRecord(value);
    const url = safeHttpUrl(
      typeof value === "string" ? value : image.url ?? image.src ?? image.link,
    );
    if (url) return url;
  }
  return undefined;
}

function requireApiKey(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    const error = new Error(`${name} is not configured`);
    error.statusCode = 503;
    error.code = `MISSING_${name}`;
    throw error;
  }
  return value;
}

async function requestJson(provider, url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(10000),
  });
  const responseText = await response.text();
  let json;
  try {
    json = JSON.parse(responseText);
  } catch {
    if (!response.ok) {
      const error = new Error(`${provider} request failed (${response.status})`);
      error.providerHttpStatus = response.status;
      if (response.status === 429) error.statusCode = 429;
      const retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));
      if (retryAfterMs !== undefined) error.retryAfterMs = retryAfterMs;
      throw error;
    }
    throw new Error(`${provider} returned invalid JSON`);
  }

  const payload = asRecord(json);
  const providerCode = payload.code === undefined || payload.code === null
    ? undefined
    : Number(payload.code);
  const hasProviderCode = Number.isFinite(providerCode);
  const providerMessage = getProviderMessage(payload);
  const retryAfterMs = parseRetryAfter(response.headers.get("Retry-After"));
  const isProviderError = payload.status === "error"
    || Boolean(payload.error)
    || (hasProviderCode && providerCode >= 400 && providerMessage);

  if (!response.ok || isProviderError) {
    const statusCode = response.status === 429 || providerCode === 429 ? 429 : undefined;
    const errorCode = hasProviderCode ? ` (${providerCode})` : "";
    const reason = providerMessage ? `: ${providerMessage}` : "";
    const message = response.ok
      ? `${provider} rejected the request${errorCode}${reason}`
      : `${provider} request failed (${response.status})${reason}`;
    const error = new Error(message);
    if (!response.ok) error.providerHttpStatus = response.status;
    if (hasProviderCode) error.providerCode = providerCode;
    if (statusCode) error.statusCode = statusCode;
    if (retryAfterMs !== undefined) error.retryAfterMs = retryAfterMs;
    throw error;
  }
  return payload;
}

function getProviderMessage(payload) {
  const providerError = asRecord(payload.error);
  const message = typeof payload.message === "string"
    ? payload.message
    : typeof payload.error === "string"
      ? payload.error
      : typeof providerError.message === "string"
        ? providerError.message
        : "";
  return message.trim().slice(0, 240);
}

function parseRetryAfter(value) {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const retryAt = Date.parse(value);
  return Number.isFinite(retryAt) ? Math.max(0, retryAt - Date.now()) : undefined;
}

async function fetchStockQuote(symbol) {
  const apiKey = requireApiKey("QATAR_TWELVE_DATA_KEY");
  const query = new URLSearchParams({
    symbol,
    interval: "1day",
    outputsize: "2",
    apikey: apiKey,
  });
  const payload = await requestJson(
    "Twelve Data",
    `https://api.twelvedata.com/time_series?${query.toString()}`,
  );
  const [item] = parseStockSeries(payload, [symbol], "USD");
  if (!item) throw new Error(`Twelve Data returned no usable series for ${symbol}`);
  return item;
}

function cached(key) {
  return cache.get(key);
}

function store(key, value, ttlSeconds) {
  cache.set(key, value, ttlSeconds);
  return value;
}

export async function getQatarStockTicker() {
  const now = Date.now();
  const cachedItems = cached(STOCK_CACHE_KEY) ?? [];
  const refreshDue = lastFullStockRefreshAt === 0
    || now - lastFullStockRefreshAt >= STOCK_REFRESH_INTERVAL_MS;

  if (refreshDue && !stockBatchInProgress) {
    if (now < stockRetryAt) {
      if (cachedItems.length === 0 && lastStockRefreshError) {
        const retryError = Object.assign(new Error(lastStockRefreshError.message), lastStockRefreshError, {
          retryAfterMs: stockRetryAt - now,
        });
        throw retryError;
      }
    } else if (now - lastStockBatchAt >= STOCK_BATCH_INTERVAL_MS) {
      const retryBatch = retryStockSymbols.length > 0;
      const batch = retryBatch
        ? retryStockSymbols.splice(0, STOCK_BATCH_SIZE)
        : STOCK_SYMBOLS.slice(nextStockBatchIndex, nextStockBatchIndex + STOCK_BATCH_SIZE);
      stockBatchInProgress = true;
      lastStockRefreshError = undefined;
      let stockErrorToThrow;

      try {
        let batchItems = [];
        const failedSymbols = [];
        let batchError;
        const qatarSymbols = batch.filter((symbol) => QATAR_STOCK_SYMBOL_SET.has(symbol));
        if (qatarSymbols.length > 0) {
          try {
            const qatarQuotes = await getQatarStockQuotes(qatarSymbols);
            batchItems.push(...qatarQuotes);
            const returnedSymbols = new Set(qatarQuotes.map((quote) => quote.symbol.toUpperCase()));
            for (const symbol of qatarSymbols) {
              if (!returnedSymbols.has(symbol)) {
                console.warn(`[QatarFeeds] Yahoo Finance returned no quote for ${symbol}`);
              }
            }
          } catch (error) {
            const yahooError = error instanceof Error ? error : new Error("Yahoo Finance quote request failed");
            failedSymbols.push(...qatarSymbols);
            batchError = yahooError;
          }
        }

        const usSymbols = batch.filter((symbol) => !QATAR_STOCK_SYMBOL_SET.has(symbol));
        for (const symbol of usSymbols) {
          try {
            batchItems.push(await fetchStockQuote(symbol));
          } catch (error) {
            const stockError = error instanceof Error ? error : new Error("Stock quote request failed");
            if (stockError.providerHttpStatus === 404 || stockError.providerCode === 404) {
              logUnsupportedStockSymbol(symbol, stockError);
              continue;
            }
            const isRateLimited = stockError.statusCode === 429 || stockError.providerCode === 429;
            failedSymbols.push(symbol);
            if (!batchError || isRateLimited) batchError = stockError;
            if (isRateLimited) {
              const nextSymbolIndex = batch.indexOf(symbol);
              failedSymbols.push(...batch.slice(nextSymbolIndex + 1));
              break;
            }
          }
        }

        const quotesBySymbol = new Map(
          (cached(STOCK_CACHE_KEY) ?? []).map((item) => [item.symbol, item]),
        );
        for (const item of batchItems) quotesBySymbol.set(item.symbol, item);

        const refreshedItems = [...quotesBySymbol.values()];
        store(STOCK_CACHE_KEY, refreshedItems, STOCK_CACHE_SECONDS);
        if (!retryBatch) nextStockBatchIndex += batch.length;

        if (failedSymbols.length > 0) {
          retryStockSymbols = [...failedSymbols, ...retryStockSymbols];
          lastStockRefreshError = batchError;
          const providerRetryAfterMs = Number(batchError?.retryAfterMs);
          const isRateLimited = batchError?.statusCode === 429 || batchError?.providerCode === 429;
          const retryDelayMs = Number.isFinite(providerRetryAfterMs)
            ? Math.max(STOCK_BATCH_INTERVAL_MS, providerRetryAfterMs)
            : isRateLimited
              ? STOCK_RATE_LIMIT_RETRY_DELAY_MS
              : STOCK_RETRY_DELAY_MS;
          stockRetryAt = Date.now() + retryDelayMs;
          if (refreshedItems.length === 0) {
            stockErrorToThrow = batchError;
            stockErrorToThrow.statusCode = stockErrorToThrow.statusCode ?? 502;
            stockErrorToThrow.retryAfterMs = retryDelayMs;
          }
          console.error(`[QatarFeeds] Stock symbols ${failedSymbols.join(",")} failed: ${safeProviderErrorMessage(batchError)}`);
        } else if (retryStockSymbols.length === 0) {
          stockRetryAt = 0;
          lastStockRefreshError = undefined;
        }

        if (nextStockBatchIndex >= STOCK_SYMBOLS.length && retryStockSymbols.length === 0) {
          nextStockBatchIndex = 0;
          lastFullStockRefreshAt = Date.now();
          const supportedCount = STOCK_SYMBOLS.length - unsupportedStockSymbols.size;
          console.info(`[QatarFeeds] Stock symbol scan complete: ${supportedCount}/${STOCK_SYMBOLS.length} supported; unsupported: ${[...unsupportedStockSymbols].join(", ") || "none"}`);
        }
      } catch (error) {
        lastStockRefreshError = error;
        const providerRetryAfterMs = Number(error?.retryAfterMs);
        const isRateLimited = error?.statusCode === 429 || error?.providerCode === 429;
        const retryDelayMs = Number.isFinite(providerRetryAfterMs)
          ? Math.max(STOCK_BATCH_INTERVAL_MS, providerRetryAfterMs)
          : isRateLimited
            ? STOCK_RATE_LIMIT_RETRY_DELAY_MS
            : STOCK_RETRY_DELAY_MS;
        stockRetryAt = Date.now() + retryDelayMs;
        if (cached(STOCK_CACHE_KEY)?.length) {
          console.error(`[QatarFeeds] Stock batch failed: ${safeProviderErrorMessage(error)}`);
        } else {
          const stockError = error instanceof Error ? error : new Error("Stock batch failed");
          stockError.statusCode = stockError.statusCode ?? 502;
          stockError.retryAfterMs = retryDelayMs;
          stockErrorToThrow = stockError;
        }
      } finally {
        lastStockBatchAt = Date.now();
        stockBatchInProgress = false;
      }
      if (stockErrorToThrow) throw stockErrorToThrow;
    }
  }

  const items = cached(STOCK_CACHE_KEY) ?? [];
  const currentTime = Date.now();
  const refreshInProgress = lastFullStockRefreshAt === 0
    || currentTime - lastFullStockRefreshAt >= STOCK_REFRESH_INTERVAL_MS;
  const nextPollMs = refreshInProgress
    ? Math.max(
      1000,
      stockRetryAt > currentTime
        ? stockRetryAt - currentTime
        : lastStockBatchAt + STOCK_BATCH_INTERVAL_MS - currentTime,
    )
    : Math.max(1000, lastFullStockRefreshAt + STOCK_REFRESH_INTERVAL_MS - currentTime);

  return { items, refreshInProgress, nextPollMs };
}

function parseStockSeries(payload, symbols, defaultCurrency = "QAR") {
  const payloadMeta = asRecord(payload.meta);
  const payloadSymbol = String(payloadMeta.symbol ?? payload.symbol ?? "")
    .split(":")[0]
    .toUpperCase();
  return symbols.flatMap((symbol) => {
    const record = asRecord(
      payload[symbol]
        ?? payload[symbol.toLowerCase()]
        ?? payload[`${symbol}:${STOCK_EXCHANGE}`]
        ?? payload[`${symbol}:DSMD`]
        ?? (payloadSymbol === symbol.toUpperCase() && Array.isArray(payload.values)
          ? payload
          : undefined),
    );
    const metadata = asRecord(record.meta);
    const values = Array.isArray(record.values) ? record.values : [];
    const latest = asRecord(values[0]);
    const previous = asRecord(values[1]);
    const price = Number(latest.close);
    if (!Number.isFinite(price)) return [];

    const previousPrice = Number(previous.close);
    const hasPreviousPrice = Number.isFinite(previousPrice) && previousPrice !== 0;
    const change = hasPreviousPrice ? price - previousPrice : 0;
    return [{
      symbol: String(metadata.symbol ?? symbol),
      name: String(metadata.name ?? metadata.symbol ?? symbol),
      price,
      change,
      percentChange: hasPreviousPrice ? (change / previousPrice) * 100 : 0,
      currency: String(metadata.currency ?? defaultCurrency),
      timestamp: String(latest.datetime ?? new Date().toISOString()),
    }];
  });
}

function safeProviderErrorMessage(error) {
  const message = error instanceof Error ? error.message : "Unexpected provider error";
  return message.replace(/([?&]apikey=)[^&\s]+/gi, "$1[redacted]");
}

export async function getQatarNewsList(language = "en", limit = 15) {
  const safeLanguage = language === "ar" ? "ar" : "en";
  const safeLimit = Math.min(20, Math.max(1, Math.floor(Number(limit) || 15)));
  const key = `qatar-feed-news-${safeLanguage}-${safeLimit}-v1`;
  const value = cached(key);
  if (value) return value;

  let currentsError;
  let currentsSucceeded = false;
  try {
    const apiKey = requireApiKey("QATAR_CURRENTS_API_KEY");
    const query = new URLSearchParams({ country: "QA", language: safeLanguage });
    const payload = await requestJson(
      "Currents",
      `https://api.currentsapi.services/v1/latest-news?${query.toString()}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    currentsSucceeded = true;
    const articles = Array.isArray(payload.news) ? payload.news.slice(0, safeLimit) : [];
    const items = articles.map((rawArticle, index) => {
      const article = asRecord(rawArticle);
      return {
        id: String(article.id ?? `${index}-${String(article.url ?? "")}`),
        title: String(article.title ?? "Untitled"),
        url: safeHttpUrl(article.url) ?? "",
        source: String(article.author ?? article.source ?? "Qatar News"),
        publishedAt: String(article.published ?? ""),
        imageUrl: safeHttpUrl(article.image),
      };
    });
    if (items.length > 0) return store(key, items, ONE_DAY_SECONDS);
  } catch (error) {
    currentsError = error;
  }

  try {
    const items = await getGdeltNewsList(safeLimit);
    if (items.length > 0 || currentsSucceeded) return store(key, items, ONE_DAY_SECONDS);
    throw new Error("GDELT returned no articles");
  } catch (fallbackError) {
    if (currentsError) {
      throw new Error(`Currents and GDELT feeds failed (${currentsError.message}; ${fallbackError.message})`);
    }
    throw fallbackError;
  }
}

export async function getQatarEventList(queryText = "events in Qatar") {
  const normalizedQuery = String(queryText).trim().slice(0, 120) || "events in Qatar";
  const datasetId = process.env.QATAR_OPEN_DATASET_ID?.trim() ?? "";
  const key = `qatar-feed-events-${normalizedQuery.toLowerCase()}-${datasetId || "no-dataset"}-v5`;
  const value = cached(key);
  if (value) return value;

  let searchApiError;
  let searchApiSucceeded = false;
  try {
    const apiKey = requireApiKey("QATAR_SEARCHAPI_KEY");
    const query = new URLSearchParams({
      api_key: apiKey,
      engine: "google",
      q: normalizedQuery,
    });
    const payload = await requestJson(
      "SearchAPI",
      `https://www.searchapi.io/api/v1/search?${query.toString()}`,
    );
    searchApiSucceeded = true;
    const aiOverview = asRecord(payload.ai_overview);
    const eventGroups = [
      { idPrefix: "event", results: payload.events_results },
      { idPrefix: "event", results: payload.events },
      { idPrefix: "organic", results: payload.organic_results },
      { idPrefix: "ai-reference", results: aiOverview.reference_links },
      { idPrefix: "reference", results: payload.reference_links },
    ].filter(({ results }) => Array.isArray(results) && results.length > 0);
    const items = [];
    for (const { idPrefix, results } of eventGroups) {
      results.forEach((rawEvent, index) => {
        const item = mapSearchEvent(rawEvent, index, idPrefix);
        const matchingIndex = items.findIndex((existing) => {
          if (item.url && existing.url === item.url) return true;
          return item.title !== "Untitled Event"
            && existing.title.trim().toLowerCase() === item.title.trim().toLowerCase();
        });
        if (matchingIndex === -1) {
          items.push(item);
          return;
        }

        const existing = items[matchingIndex];
        items[matchingIndex] = {
          ...existing,
          url: existing.url ?? item.url,
          imageUrl: existing.imageUrl ?? item.imageUrl,
          source: existing.source ?? item.source,
          description: existing.description ?? item.description,
          dateText: existing.dateText === "Upcoming" ? item.dateText : existing.dateText,
          venue: existing.venue === "Doha, Qatar" ? item.venue : existing.venue,
        };
      });
    }
    items.sort((first, second) => Number(Boolean(second.imageUrl)) - Number(Boolean(first.imageUrl)));
    if (items.length > 0) return store(key, items, ONE_DAY_SECONDS);
  } catch (error) {
    searchApiError = error;
  }

  if (!datasetId) {
    if (searchApiSucceeded) return store(key, [], ONE_DAY_SECONDS);
    throw searchApiError;
  }

  try {
    const items = await getOpenDataEvents(datasetId);
    if (items.length > 0 || searchApiSucceeded) return store(key, items, ONE_DAY_SECONDS);
    throw new Error("Qatar Open Data returned no events");
  } catch (fallbackError) {
    if (searchApiError) {
      throw new Error(`SearchAPI and Qatar Open Data feeds failed (${searchApiError.message}; ${fallbackError.message})`);
    }
    throw fallbackError;
  }
}

async function getGdeltNewsList(limit) {
  const query = new URLSearchParams({
    query: "Qatar",
    mode: "artlist",
    maxrecords: String(limit),
    format: "json",
    sort: "DateDesc",
  });
  const payload = await requestJson(
    "GDELT",
    `https://api.gdeltproject.org/api/v2/doc/doc?${query.toString()}`,
  );
  const articles = Array.isArray(payload.articles) ? payload.articles.slice(0, limit) : [];
  return articles.map((rawArticle, index) => {
    const article = asRecord(rawArticle);
    return {
      id: `${index}-${String(article.url ?? "")}`,
      title: String(article.title ?? "Untitled"),
      url: safeHttpUrl(article.url) ?? "",
      source: String(article.domain ?? "Qatar News"),
      publishedAt: String(article.seendate ?? ""),
      imageUrl: safeHttpUrl(article.socialimage),
    };
  });
}

function mapSearchEvent(rawEvent, index, idPrefix = "event") {
  const event = asRecord(rawEvent);
  const date = asRecord(event.date);
  const venue = asRecord(event.venue);
  const addresses = Array.isArray(event.address)
    ? event.address
    : typeof event.address === "string"
      ? [event.address]
      : [];
  return {
    id: `${idPrefix}-${String(event.id ?? event.index ?? index)}`,
    title: String(event.title ?? event.name ?? "Untitled Event"),
    dateText: String(date.when
      ?? event.dateText
      ?? (typeof event.date === "string" ? event.date : undefined)
      ?? event.time
      ?? "Upcoming"),
    venue: String(venue.name
      ?? addresses[0]
      ?? (typeof event.venue === "string" ? event.venue : undefined)
      ?? "Doha, Qatar"),
    url: safeHttpUrl(event.link) ?? safeHttpUrl(event.url),
    imageUrl: safeImageUrl(
      event.thumbnail,
      event.image,
      event.image_url,
      event.imageUrl,
      ...(Array.isArray(event.images) ? event.images : []),
    ),
    source: typeof event.source === "string" ? event.source : undefined,
    description: typeof event.snippet === "string"
      ? event.snippet.slice(0, 240)
      : typeof event.description === "string"
        ? event.description.slice(0, 240)
        : undefined,
  };
}

async function getOpenDataEvents(datasetId) {
  const query = new URLSearchParams({ limit: "20" });
  const payload = await requestJson(
    "Qatar Open Data",
    `https://www.data.gov.qa/api/explore/v2.1/catalog/datasets/${encodeURIComponent(datasetId)}/records?${query.toString()}`,
  );
  const records = Array.isArray(payload.results) ? payload.results : [];
  return records.map((rawRecord, index) => {
    const record = asRecord(rawRecord);
    return {
      id: String(record.id ?? `qod-${index}`),
      title: String(record.title ?? record.event_name ?? record.name ?? "Public Event"),
      dateText: String(record.date ?? record.start_date ?? record.year ?? "Upcoming"),
      venue: String(record.venue ?? record.location ?? "Doha, Qatar"),
      url: safeHttpUrl(record.url),
      imageUrl: safeImageUrl(record.thumbnail, record.image, record.image_url, record.imageUrl),
    };
  });
}
