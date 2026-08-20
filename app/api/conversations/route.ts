import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

/**
 * لیست گفتگوهای کاربر بر اساس sessionId (کوکی ناشناس)
 * برای نمایش سایدبار تاریخچه گفتگوها
 */

const SESSION_COOKIE = "lc_session";

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  if (!sessionId) {
    return NextResponse.json({ conversations: [] });
  }

  const conversations = await prisma.conversation.findMany({
    where: { sessionId },
    orderBy: { updatedAt: "desc" },
    select: { id: true, title: true, updatedAt: true },
    take: 50,
  });

  return NextResponse.json({ conversations });
}

export async function DELETE(req: NextRequest) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!sessionId || !id) {
    return NextResponse.json({ error: "درخواست نامعتبر است." }, { status: 400 });
  }

  await prisma.conversation.deleteMany({ where: { id, sessionId } });

  return NextResponse.json({ success: true });
}
