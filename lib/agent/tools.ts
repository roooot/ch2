import { tool } from "ai";
import { z } from "zod";
import { retrieveContext } from "@/lib/rag/retrieval";
import { analyzeErrorLog, analyzeLiariaJson, isLikelyLog } from "@/lib/agent/config-analyzer";
import type { Citation } from "@/types";

/**
 * تعریف ابزارهای ایجنت (Vercel AI SDK Tools)
 * این ابزارها به مدل قوی اجازه می‌دهند در طول تولید پاسخ (با maxSteps > 1)
 * به‌صورت خودمختار جستجوی بیشتر در مستندات انجام دهد یا فایل پیکربندی را تحلیل کند.
 *
 * `onCitationsCollected` برای جمع‌آوری منابعی است که در طول اجرای ابزارها پیدا می‌شوند
 * تا در پایان به پیام نهایی (برای نمایش Citation Card) ضمیمه شوند.
 */

export function createAgentTools(onCitationsCollected: (citations: Citation[]) => void) {
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

  return { searchLiariaDocs, analyzeLiariaConfig };
}
