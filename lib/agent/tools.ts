import { tool } from "ai";
import { z } from "zod";
import { retrieveContext } from "@/lib/rag/retrieval";
import { analyzeErrorLog, analyzeLiariaJson, isLikelyLog } from "@/lib/agent/config-analyzer";
import { getLiaraAppLogs, listLiaraProjects } from "@/lib/liara/api";
import { getActiveLiaraConnection } from "@/lib/liara/connection";
import type { Citation } from "@/types";

/**
 * تعریف ابزارهای ایجنت (Vercel AI SDK Tools)
 * این ابزارها به مدل قوی اجازه می‌دهند در طول تولید پاسخ (با maxSteps > 1)
 * به‌صورت خودمختار جستجوی بیشتر در مستندات انجام دهد یا فایل پیکربندی را تحلیل کند.
 *
 * `onCitationsCollected` برای جمع‌آوری منابعی است که در طول اجرای ابزارها پیدا می‌شوند
 * تا در پایان به پیام نهایی (برای نمایش Citation Card) ضمیمه شوند.
 */

export function createAgentTools(onCitationsCollected: (citations: Citation[]) => void, sessionId?: string) {
  const searchLiariaDocs = tool({
    description:
      "جستجوی معنایی و متنی در مستندات رسمی لیارا برای یافتن اطلاعات دقیق درباره یک موضوع خاص. در صورتی که context اولیه کافی نبود از این ابزار استفاده کن.",
    parameters: z.object({
      query: z.string().describe("عبارت جستجو به فارسی یا انگلیسی، متمرکز بر یک موضوع مشخص"),
    }),
    execute: async ({ query }) => {
      const result = await retrieveContext(query);
      onCitationsCollected(result.citations);
      if (result.citations.length === 0) {
        return "هیچ سند مرتبطی برای این جستجو پیدا نشد.";
      }
      return result.contextText;
    },
  });

  const analyzeLiariaConfig = tool({
    description:
      "تحلیل محتوای فایل liara.json یا یک خط/بلاک لاگ خطا برای یافتن مشکلات پیکربندی یا علت خرابی دیپلوی.",
    parameters: z.object({
      content: z.string().describe("محتوای کامل فایل liara.json یا متن لاگ خطا"),
    }),
    execute: async ({ content }) => {
      const result = isLikelyLog(content) ? analyzeErrorLog(content) : analyzeLiariaJson(content);
      return JSON.stringify(result, null, 2);
    },
  });

  const getConnectedLiaraApps = tool({
    description:
      "فقط وقتی کاربر صریحاً درباره اپلیکیشن‌ها، وضعیت پنل، deployment یا منابع حساب متصل خودش پرسید، فهرست فقط‌خواندنی اپلیکیشن‌های همان تیم را دریافت کن. هرگز برای تغییر، restart، deploy یا حذف چیزی استفاده نکن.",
    parameters: z.object({}),
    execute: async () => {
      if (!sessionId) return "کاربر هیچ حساب لیارایی را برای این نشست متصل نکرده است.";
      const connection = await getActiveLiaraConnection(sessionId);
      if (!connection) return "اتصال موقت حساب لیارا فعال نیست یا منقضی شده است.";

      try {
        const projects = await listLiaraProjects(connection.apiKey, connection.teamId);
        return JSON.stringify({
          note: "داده فقط‌خواندنی است. هیچ عملیاتی روی حساب کاربر انجام نشده است.",
          teamId: connection.teamId,
          projects,
        });
      } catch {
        return "دریافت اطلاعات اپلیکیشن‌های حساب متصل با خطا مواجه شد.";
      }
    },
  });

  const getConnectedLiaraAppLogs = tool({
    description:
      "فقط وقتی کاربر صریحاً خواست لاگ خطا یا وضعیت یک اپلیکیشن از حساب متصلش بررسی شود، لاگ فقط‌خواندنی همان اپ را دریافت کن. نام اپ باید از گفتهٔ کاربر یا ابزار فهرست اپ‌ها مشخص باشد. داده‌های حساس پیش از بازگشت ماسک می‌شوند و این ابزار هیچ تغییری اعمال نمی‌کند.",
    parameters: z.object({
      appName: z.string().trim().min(1).max(120).regex(/^[a-zA-Z0-9][a-zA-Z0-9.-]*$/),
      hours: z.number().int().min(1).max(24).default(6),
    }),
    execute: async ({ appName, hours }) => {
      if (!sessionId) return "کاربر هیچ حساب لیارایی را برای این نشست متصل نکرده است.";
      const connection = await getActiveLiaraConnection(sessionId);
      if (!connection) return "اتصال موقت حساب لیارا فعال نیست یا منقضی شده است.";

      try {
        const since = Math.floor(Date.now() / 1000) - hours * 60 * 60;
        const logs = await getLiaraAppLogs(connection.apiKey, connection.teamId, appName, since);
        return JSON.stringify({
          note: "لاگ‌ها فقط‌خواندنی‌اند و مقادیر حساس در آن‌ها ماسک شده‌اند.",
          appName,
          hours,
          logs,
        });
      } catch {
        return "دریافت لاگ اپلیکیشن از حساب متصل با خطا مواجه شد.";
      }
    },
  });

  return { searchLiariaDocs, analyzeLiariaConfig, getConnectedLiaraApps, getConnectedLiaraAppLogs };
}
