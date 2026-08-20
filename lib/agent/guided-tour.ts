import type { GuidedTourState } from "@/types";

/**
 * تورهای راهنمای از پیش تعریف‌شده (Guided Journeys)
 * هر تور شامل چند مرحله ثابت است که ایجنت به‌ترتیب برای کاربر توضیح می‌دهد.
 * محتوای دقیق هر مرحله توسط مدل قوی و با کمک RAG تولید می‌شود؛
 * اینجا فقط «اسکلت مراحل» تعریف شده است.
 */

export const PREDEFINED_TOURS: Record<string, string[]> = {
  "deploy-nextjs": [
    "آشنایی با ساختار پروژه Next.js و پیش‌نیازهای دیپلوی روی لیارا",
    "نصب و ورود به liara-cli",
    "ساخت فایل liara.json مناسب برای Next.js",
    "اجرای دستور liara deploy و بررسی لاگ‌ها",
    "تنظیم Environment Variables و دامنه اختصاصی",
  ],
  "connect-mysql": [
    "ساخت دیتابیس MySQL در پنل لیارا",
    "دریافت Connection String و تنظیم Environment Variable",
    "اتصال از اپلیکیشن (مثال با Prisma/Node.js)",
    "اجرای Migration و تست اتصال",
  ],
  "deploy-docker": [
    "نوشتن Dockerfile مناسب برای اپلیکیشن",
    "تنظیم فایل liara.json با platform: docker",
    "دیپلوی و بررسی لاگ‌های Build",
    "پایدارسازی و اتصال دیسک/دیتابیس در صورت نیاز",
  ],
  "custom-domain": [
    "افزودن دامنه در پنل لیارا",
    "تنظیم رکوردهای DNS (CNAME/A)",
    "فعال‌سازی SSL رایگان",
    "بررسی و تست نهایی دامنه",
  ],
};

export function detectTourKey(topic: string): string {
  const normalized = topic.toLowerCase();
  if (/next\.?js|نکست/i.test(normalized)) return "deploy-nextjs";
  if (/mysql|دیتابیس|database/i.test(normalized)) return "connect-mysql";
  if (/docker|داکر/i.test(normalized)) return "deploy-docker";
  if (/domain|دامنه|ssl/i.test(normalized)) return "custom-domain";
  return "deploy-nextjs"; // پیش‌فرض رایج‌ترین سناریو
}

export function createGuidedTourState(topic: string): GuidedTourState {
  const key = detectTourKey(topic);
  const steps = PREDEFINED_TOURS[key];
  return {
    topic: key,
    currentStepIndex: 0,
    totalSteps: steps.length,
    steps,
  };
}

export function advanceTourStep(state: GuidedTourState): GuidedTourState {
  return {
    ...state,
    currentStepIndex: Math.min(state.currentStepIndex + 1, state.totalSteps - 1),
  };
}
