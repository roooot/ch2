import { logger } from "@/lib/utils/logger";

/**
 * Rate Limiting ساده مبتنی بر حافظه (Sliding Window)
 *
 * نکته مهم برای Production: در صورت اجرای چند Instance (Scale > 1)،
 * باید از Redis (با تنظیم REDIS_URL) استفاده شود تا شمارش بین instance ها مشترک باشد.
 * این پیاده‌سازی برای یک instance به‌خوبی کار می‌کند و به عنوان fallback امن است.
 */

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

// پاکسازی دوره‌ای حافظه برای جلوگیری از Memory Leak
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets.entries()) {
    if (now - bucket.windowStart > 5 * 60 * 1000) {
      buckets.delete(key);
    }
  }
}, 60 * 1000);

const MAX_REQUESTS = positiveIntegerFromEnv("RATE_LIMIT_MAX_REQUESTS", 20);
const WINDOW_MS = positiveIntegerFromEnv("RATE_LIMIT_WINDOW_MS", 60_000);

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

/**
 * بررسی محدودیت نرخ درخواست برای یک شناسه (IP یا sessionId)
 */
export function checkRateLimit(identifier: string): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(identifier);

  if (!bucket || now - bucket.windowStart > WINDOW_MS) {
    buckets.set(identifier, { count: 1, windowStart: now });
    return { allowed: true, remaining: MAX_REQUESTS - 1 };
  }

  if (bucket.count >= MAX_REQUESTS) {
    const retryAfterMs = WINDOW_MS - (now - bucket.windowStart);
    logger.warn("rate_limit_exceeded", { identifier });
    return { allowed: false, remaining: 0, retryAfterMs };
  }

  bucket.count += 1;
  return { allowed: true, remaining: MAX_REQUESTS - bucket.count };
}

/**
 * استخراج شناسهٔ rate limit از IP تزریق‌شده توسط reverse proxy مورد اعتماد.
 * sessionId عمداً فقط fallback است؛ ترکیب IP + session با حذف کوکی دور زده می‌شد.
 */
export function getClientIdentifier(headers: Headers, sessionId?: string): string {
  const realIp = headers.get("x-real-ip")?.trim();
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = realIp || forwarded;
  return ip ? `ip:${ip}` : `session:${sessionId ?? "unknown"}`;
}

function positiveIntegerFromEnv(name: string, fallback: number): number {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}
