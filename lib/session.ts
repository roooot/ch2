import "server-only";
import { cookies } from "next/headers";
import { v4 as uuid } from "uuid";

export const SESSION_COOKIE = "lc_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

/**
 * نشست ناشناس را فقط در یک کوکی httpOnly نگه می‌داریم. هیچ اطلاعات حساس
 * (از جمله کلید API کاربر) داخل کوکی قرار نمی‌گیرد.
 */
export async function getOrCreateAnonymousSessionId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(SESSION_COOKIE)?.value;
  if (existing) return existing;

  const sessionId = uuid();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  return sessionId;
}

export async function getAnonymousSessionId(): Promise<string | undefined> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value;
}
