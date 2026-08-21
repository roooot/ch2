import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { LiaraApiError } from "@/lib/liara/api";
import {
  deleteLiaraConnection,
  getLiaraConnectionStatus,
  validateAndSaveLiaraConnection,
} from "@/lib/liara/connection";
import { getOrCreateAnonymousSessionId } from "@/lib/session";
import { PayloadTooLargeError, readJsonBodyWithLimit } from "@/lib/security/request-body";
import { checkRateLimit, getClientIdentifier } from "@/lib/security/rate-limit";
import { logger } from "@/lib/utils/logger";

export const runtime = "nodejs";

const connectionRequestSchema = z.object({
  apiKey: z.string().trim().min(10).max(4096),
  teamId: z.string().trim().min(3).max(191),
});

const MAX_CONNECTION_REQUEST_BYTES = 16 * 1024;

/** وضعیت اتصال موقت همان نشست ناشناس؛ کلید هرگز به کلاینت برگردانده نمی‌شود. */
export async function GET() {
  try {
    const sessionId = await getOrCreateAnonymousSessionId();
    return NextResponse.json(await getLiaraConnectionStatus(sessionId));
  } catch (error) {
    logger.error("liara_connection_status_failed", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "دریافت وضعیت اتصال با خطا مواجه شد." }, { status: 500 });
  }
}

/**
 * اعتبارسنجی read-only با API رسمی لیارا، سپس ذخیرهٔ رمزنگاری‌شده و زمان‌دار.
 * هیچ عملیات تغییر‌دهنده‌ای روی منابع کاربر انجام نمی‌شود.
 */
export async function POST(request: NextRequest) {
  const sessionId = await getOrCreateAnonymousSessionId();
  const rateLimit = checkRateLimit(`liara-connection:${getClientIdentifier(request.headers, sessionId)}`);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "تعداد تلاش برای اتصال بیش از حد مجاز است. کمی بعد دوباره تلاش کنید." },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rateLimit.retryAfterMs ?? 60_000) / 1_000)) } }
    );
  }

  let body: z.infer<typeof connectionRequestSchema>;
  try {
    const parsed = connectionRequestSchema.safeParse(
      await readJsonBodyWithLimit(request, MAX_CONNECTION_REQUEST_BYTES)
    );
    if (!parsed.success) {
      return NextResponse.json({ error: "کلید API یا شناسهٔ تیم نامعتبر است." }, { status: 400 });
    }
    body = parsed.data;
  } catch (error) {
    if (error instanceof PayloadTooLargeError) {
      return NextResponse.json({ error: "حجم درخواست بیش از حد مجاز است." }, { status: 413 });
    }
    return NextResponse.json({ error: "درخواست اتصال نامعتبر است." }, { status: 400 });
  }

  try {
    const result = await validateAndSaveLiaraConnection({ sessionId, ...body });
    return NextResponse.json({ ...result.status, projectCount: result.projects.length });
  } catch (error) {
    if (error instanceof LiaraApiError) {
      const status = error.status === 401 || error.status === 403 ? 400 : 502;
      const message = status === 400
        ? "کلید API یا شناسهٔ تیم معتبر نیست، یا اجازهٔ دسترسی به آن تیم را ندارد."
        : "اتصال به API لیارا با خطا مواجه شد. دوباره تلاش کنید.";
      return NextResponse.json({ error: message }, { status });
    }

    logger.error("liara_connection_create_failed", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json(
      { error: "ذخیرهٔ امن اتصال ممکن نشد. تنظیمات سرور را بررسی کنید." },
      { status: 503 }
    );
  }
}

/** قطع اتصال و حذف فوری token رمزنگاری‌شده از دیتابیس. */
export async function DELETE() {
  try {
    const sessionId = await getOrCreateAnonymousSessionId();
    await deleteLiaraConnection(sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("liara_connection_delete_failed", {
      error: error instanceof Error ? error.name : "unknown",
    });
    return NextResponse.json({ error: "قطع اتصال با خطا مواجه شد." }, { status: 500 });
  }
}
