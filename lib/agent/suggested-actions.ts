import type { IntentType, SuggestedAction, Citation } from "@/types";
import { v4 as uuid } from "uuid";

/**
 * تولید قدم‌های بعدی پیشنهادی (Suggested Actions)
 * به‌جای فراخوانی مدل زبانی (که هزینه و تاخیر دارد)، این تصمیم‌گیری
 * با یک استراتژی قانون‌محور بر اساس intent و citations انجام می‌شود.
 */

export function buildSuggestedActions(
  intent: IntentType,
  topic: string,
  citations: Citation[]
): SuggestedAction[] {
  const actions: SuggestedAction[] = [];

  switch (intent) {
    case "faq":
      actions.push({
        id: uuid(),
        label: "راهنمای گام‌به‌گام بده",
        prompt: `یک تور راهنمای گام‌به‌گام برای «${topic}» به من نشان بده.`,
      });
      if (citations[0]) {
        actions.push({
          id: uuid(),
          label: "بیشتر توضیح بده",
          prompt: `درباره «${citations[0].title}» با جزئیات بیشتر توضیح بده.`,
        });
      }
      actions.push({
        id: uuid(),
        label: "مشکل مشابه دارم",
        prompt: "من با خطایی مرتبط با این موضوع مواجه شدم، کمکم کن عیب‌یابی کنم.",
      });
      break;

    case "troubleshoot":
      actions.push({
        id: uuid(),
        label: "لاگ خطا را بفرست",
        prompt: "این هم لاگ کامل خطای من: ",
      });
      actions.push({
        id: uuid(),
        label: "liara.json را بررسی کن",
        prompt: "این هم فایل liara.json من، لطفاً بررسی کن: ",
      });
      actions.push({
        id: uuid(),
        label: "مشکل حل شد ✅",
        prompt: "مشکل حل شد، ممنون!",
      });
      break;

    case "config_analysis":
      actions.push({
        id: uuid(),
        label: "چطور دیپلوی کنم؟",
        prompt: "با این تنظیمات چطور می‌توانم دیپلوی کنم؟",
      });
      actions.push({
        id: uuid(),
        label: "بهینه‌سازی بیشتر",
        prompt: "چه نکات بهینه‌سازی دیگری برای این پیکربندی پیشنهاد می‌دهی؟",
      });
      break;

    case "guided_tour":
      actions.push({
        id: uuid(),
        label: "مرحله بعد ▶️",
        prompt: "به مرحله بعد برو.",
      });
      actions.push({
        id: uuid(),
        label: "سوال دارم",
        prompt: "درباره این مرحله یک سوال دارم: ",
      });
      break;

    default:
      actions.push({
        id: uuid(),
        label: "دیپلوی یک پروژه Next.js",
        prompt: "چطور یک پروژه Next.js را روی لیارا دیپلوی کنم؟",
      });
      actions.push({
        id: uuid(),
        label: "اتصال به دیتابیس MySQL",
        prompt: "چطور به دیتابیس MySQL لیارا وصل شوم؟",
      });
  }

  return actions.slice(0, 3);
}
