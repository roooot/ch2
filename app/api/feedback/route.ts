import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { logger } from "@/lib/utils/logger";

/**
 * API فیدبک کاربر روی پاسخ‌های ایجنت (👍/👎)
 * برای تحلیل کیفیت پاسخ‌ها و شناسایی نقاط ضعف پایگاه دانش استفاده می‌شود.
 */

const feedbackSchema = z.object({
  messageId: z.string().cuid(),
  rating: z.enum(["UP", "DOWN"]),
  comment: z.string().max(1000).optional(),
});

const SESSION_COOKIE = "lc_session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = feedbackSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "ورودی نامعتبر است." }, { status: 400 });
    }

    const { messageId, rating, comment } = parsed.data;

    const cookieStore = await cookies();
    const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
    if (!sessionId) {
      return NextResponse.json({ error: "نشست کاربر یافت نشد." }, { status: 401 });
    }

    // تنها صاحب گفت‌وگو می‌تواند روی پاسخ دستیار همان گفت‌وگو feedback ثبت کند.
    const message = await prisma.message.findFirst({
      where: {
        id: messageId,
        role: "ASSISTANT",
        conversation: { sessionId },
      },
      select: { id: true },
    });

    if (!message) {
      return NextResponse.json({ error: "پاسخ موردنظر یافت نشد." }, { status: 404 });
    }

    const feedback = await prisma.feedback.upsert({
      where: { messageId: message.id },
      update: { rating, comment },
      create: { messageId, rating, comment },
    });

    logger.info("feedback_submitted", { messageId, rating });

    return NextResponse.json({ success: true, feedback });
  } catch (error) {
    logger.error("feedback_submit_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "ثبت فیدبک با خطا مواجه شد." }, { status: 500 });
  }
}
