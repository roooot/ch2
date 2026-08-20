import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { clearUserMemory } from "@/lib/memory/user-memory";
import { logger } from "@/lib/utils/logger";

const SESSION_COOKIE = "lc_session";

/** حافظهٔ بین‌گفت‌وگویی را نگه می‌دارد، نه پیام‌های ذخیره‌شدهٔ گفتگوها. */
export async function DELETE() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return NextResponse.json({ success: true });
  }

  try {
    await clearUserMemory(sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("user_memory_clear_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "پاک‌سازی حافظه با خطا مواجه شد." }, { status: 500 });
  }
}
