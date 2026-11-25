import {
  getQatarEventList,
  getQatarNewsList,
  getQatarStockTicker,
} from "../service/qatarFeedsService.js";

function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : "Unexpected feed error";
  return message
    .replace(/([?&]api_key=)[^&\s]+/gi, "$1[redacted]")
    .replace(/([?&]apikey=)[^&\s]+/gi, "$1[redacted]")
    .replace(/(Bearer\s+)\S+/gi, "$1[redacted]");
}

function handleFeedError(res, feedName, error) {
  const status = Number.isInteger(error?.statusCode) ? error.statusCode : 502;
  const providerCode = Number.isInteger(error?.providerCode)
    ? `PROVIDER_${error.providerCode}`
    : undefined;
  const code = error?.code ?? providerCode;
  console.error(`[QatarFeeds] ${feedName} failed: ${safeErrorMessage(error)}`);
  if (Number.isFinite(error?.retryAfterMs)) {
    res.set("Retry-After", String(Math.ceil(error.retryAfterMs / 1000)));
  }
  return res.status(status).json({
    error: `${feedName} feed is temporarily unavailable.`,
    ...(code ? { code } : {}),
  });
}

export async function getStocks(req, res) {
  try {
    return res.status(200).json(await getQatarStockTicker());
  } catch (error) {
    return handleFeedError(res, "Qatar stock", error);
  }
}

export async function getNews(req, res) {
  try {
    return res.status(200).json(await getQatarNewsList(req.query.language, req.query.limit));
  } catch (error) {
    return handleFeedError(res, "Qatar news", error);
  }
}

export async function getEvents(req, res) {
  try {
    return res.status(200).json(await getQatarEventList(req.query.q));
  } catch (error) {
    return handleFeedError(res, "Qatar events", error);
  }
}
