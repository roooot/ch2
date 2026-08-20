import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { ingestFromGitHub } from "@/lib/ingestion/ingest";
import { logger } from "@/lib/utils/logger";

export const maxDuration = 60;

const batchRequestSchema = z.object({
  cursor: z.string().min(1).optional(),
  // هر batch کوتاه نگه داشته می‌شود تا در محیط production timeout نشود.
  limit: z.coerce.number().int().min(1).max(12).default(8),
});

function hasValidAdminSecret(request: NextRequest): boolean {
  const expected = process.env.ADMIN_SECRET;
  const received = request.headers.get("x-admin-secret");
  if (!expected || !received) return false;

  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

function unauthorized() {
  return NextResponse.json({ error: "دسترسی ادمین نامعتبر است." }, { status: 401 });
}

/** وضعیت فقط-خواندنی index مستندات؛ برای health check پس از ingestion. */
export async function GET(request: NextRequest) {
  if (!hasValidAdminSecret(request)) return unauthorized();

  const [documents, chunks, embeddedChunks] = await Promise.all([
    prisma.document.count(),
    prisma.chunk.count(),
    prisma.chunk.count({ where: { embeddingDim: { gt: 0 } } }),
  ]);

  return NextResponse.json({ documents, chunks, embeddedChunks });
}

/**
 * یک batch از corpus رسمی Liara را وارد می‌کند. caller باید `nextCursor` را
 * تا `completed: true` در درخواست بعدی ارسال کند تا روند قابل‌ادامه و امن باشد.
 */
export async function POST(request: NextRequest) {
  if (!hasValidAdminSecret(request)) return unauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = batchRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "پارامترهای ingestion نامعتبر است." }, { status: 400 });
    }

    const result = await ingestFromGitHub(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("admin_ingest_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "ورود دسته‌ای مستندات با خطا مواجه شد؛ می‌توانید همان batch را دوباره اجرا کنید." },
      { status: 500 }
    );
  }
}
