import { prisma } from "@/lib/db/prisma";
import { simpleHash } from "@/lib/utils/tokens";
import { logger } from "@/lib/utils/logger";
import type { Prisma } from "@prisma/client";
import type { Citation } from "@/types";

/**
 * Query Cache - کش پرسش‌های تکراری
 *
 * برای سوالات پرتکرار (FAQ) که پاسخ آن‌ها معمولاً ثابت است،
 * به‌جای فراخوانی مجدد مدل قوی، پاسخ کش‌شده برگردانده می‌شود.
 * TTL پیش‌فرض: ۲۴ ساعت
 */

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export interface CachedResponse {
  response: string;
  citations: Citation[];
}

/** نرمال‌سازی سوال برای افزایش نرخ Cache Hit (حذف علائم نگارشی اضافه و کوچک‌سازی) */
function normalizeQuery(query: string): string {
  return query
    .trim()
    .toLowerCase()
    .replace(/[؟?!.,،؛;]/g, "")
    .replace(/\s+/g, " ");
}

export async function getCachedResponse(query: string): Promise<CachedResponse | null> {
  try {
    const queryHash = simpleHash(normalizeQuery(query));
    const cached = await prisma.queryCache.findUnique({ where: { queryHash } });

    if (!cached) return null;
    if (cached.expiresAt < new Date()) {
      // منقضی شده - حذف async بدون بلاک کردن پاسخ
      prisma.queryCache.delete({ where: { id: cached.id } }).catch(() => {});
      return null;
    }

    // افزایش شمارنده hit به صورت fire-and-forget
    prisma.queryCache
      .update({ where: { id: cached.id }, data: { hitCount: { increment: 1 } } })
      .catch(() => {});

    logger.info("query_cache_hit", { queryHash });

    return {
      response: cached.response,
      citations: (cached.citations as unknown as Citation[]) || [],
    };
  } catch (error) {
    logger.error("query_cache_read_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

export async function setCachedResponse(
  query: string,
  response: string,
  citations: Citation[]
): Promise<void> {
  try {
    const queryHash = simpleHash(normalizeQuery(query));
    const expiresAt = new Date(Date.now() + CACHE_TTL_MS);

    await prisma.queryCache.upsert({
      where: { queryHash },
      update: {
        response,
        citations: citations as unknown as Prisma.InputJsonValue,
        expiresAt,
        hitCount: { increment: 1 },
      },
      create: {
        queryHash,
        query,
        response,
        citations: citations as unknown as Prisma.InputJsonValue,
        expiresAt,
      },
    });
  } catch (error) {
    logger.error("query_cache_write_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/** پاکسازی رکوردهای منقضی‌شده کش (برای اجرای دوره‌ای یا cron) */
export async function purgeExpiredCache(): Promise<number> {
  const result = await prisma.queryCache.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
