import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { aiCircuitBreaker } from "@/lib/security/circuit-breaker";

/**
 * Health Check endpoint - برای مانیتورینگ سلامت سرویس روی لیارا
 */
export async function GET() {
  let dbOk = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch {
    dbOk = false;
  }

  const healthy = dbOk;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      database: dbOk ? "connected" : "disconnected",
      aiCircuitBreaker: aiCircuitBreaker.getState(),
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}
