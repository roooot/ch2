import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db/prisma";

/**
 * دریافت پیام‌های یک گفتگوی مشخص (برای بازکردن گفتگوی قبلی از سایدبار)
 */

const SESSION_COOKIE = "lc_session";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;

  const conversation = await prisma.conversation.findFirst({
    where: { id, sessionId: sessionId ?? "__none__" },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
        include: { feedback: true },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "گفتگو یافت نشد." }, { status: 404 });
  }

  return NextResponse.json({
    id: conversation.id,
    title: conversation.title,
    messages: conversation.messages.map((m) => ({
      id: m.id,
      role: m.role.toLowerCase(),
      content: m.content,
      intent: m.intent,
      thinkingSteps: m.thinkingSteps,
      citations: m.citations,
      suggestedActions: m.suggestedActions,
      createdAt: m.createdAt.toISOString(),
      feedback: m.feedback?.rating ?? null,
    })),
  });
}
