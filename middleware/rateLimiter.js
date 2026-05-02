import rateLimit from "express-rate-limit";

// Limit how often the bulk processing API can be called
export const bulkRateLimiter = rateLimit({
  windowMs: Number(process.env.BULK_RATE_LIMIT_WINDOW_MS), // ⏱️ 15 minutes
  max: Number(process.env.BULK_RATE_LIMIT_MAX_REQUESTS),//  10, // ❌ Max 10 requests per window per IP
  message: {
    success: false,
    message: "Too many bulk upload attempts. Please try again later.",
  },
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,  // Disable X-RateLimit headers
});
