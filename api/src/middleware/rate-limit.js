import { ApiError } from "../lib/api-error.js";

export function rateLimit({ windowMs, maxRequests, key = (request) => request.ip }) {
  const buckets = new Map();

  return (request, _response, next) => {
    const now = Date.now();
    const keyValue = key(request);
    let bucket = buckets.get(keyValue);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(keyValue, bucket);
    }

    bucket.count += 1;
    if (bucket.count > maxRequests) {
      return next(new ApiError(429, "RATE_LIMITED", "Too many requests. Wait briefly and try again."));
    }

    if (buckets.size > 5000) {
      for (const [entryKey, entry] of buckets) {
        if (entry.resetAt <= now) buckets.delete(entryKey);
      }
    }

    next();
  };
}
