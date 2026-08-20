import { generateObject } from "ai";
import { z } from "zod";
import { cheapModel } from "@/lib/ai/models";
import { INTENT_CLASSIFIER_SYSTEM_PROMPT } from "@/lib/agent/prompts";
import { withCircuitBreaker } from "@/lib/security/circuit-breaker";
import { logger } from "@/lib/utils/logger";
import type { IntentType } from "@/types";

/**
 * تشخیص Intent با مدل ارزان (Two-Tier Model Strategy)
 * این مرحله سریع و کم‌هزینه است و مسیر بعدی State Machine را تعیین می‌کند.
 */

const intentSchema = z.object({
  intent: z.enum([
    "faq",
    "troubleshoot",
    "config_analysis",
    "guided_tour",
    "clarify_needed",
    "chitchat",
  ]),
  confidence: z.number().min(0).max(1),
  topic: z.string().describe("موضوع کلی سوال به فارسی، مثل «دیپلوی Next.js» یا «اتصال دیتابیس MySQL»"),
  reasoning: z.string().describe("دلیل کوتاه انتخاب این intent"),
});

export interface IntentClassificationResult {
  intent: IntentType;
  confidence: number;
  topic: string;
  reasoning: string;
}

const FALLBACK_RESULT: IntentClassificationResult = {
  intent: "faq",
  confidence: 0.3,
  topic: "نامشخص",
  reasoning: "fallback به دلیل خطای سرویس طبقه‌بندی",
};

export async function classifyIntent(
  userMessage: string,
  recentHistory: string[]
): Promise<IntentClassificationResult> {
  // میانبر ارزان: تشخیص سریع محتوای config/log بدون فراخوانی مدل
  if (looksLikeConfigOrLog(userMessage)) {
    return {
      intent: "config_analysis",
      confidence: 0.9,
      topic: "تحلیل پیکربندی یا لاگ",
      reasoning: "شناسایی الگوی JSON یا لاگ خطا در پیام کاربر",
    };
  }

  // میانبر ارزان: پیام بسیار کوتاه/کلی -> نیاز به clarify
  if (userMessage.trim().split(/\s+/).length <= 2 && !isGreeting(userMessage)) {
    return {
      intent: "clarify_needed",
      confidence: 0.7,
      topic: userMessage,
      reasoning: "پیام کاربر بسیار کوتاه و مبهم است",
    };
  }

  return withCircuitBreaker(
    async () => {
      const { object } = await generateObject({
        model: cheapModel,
        schema: intentSchema,
        system: INTENT_CLASSIFIER_SYSTEM_PROMPT,
        prompt: [
          recentHistory.length > 0 ? `تاریخچه اخیر گفتگو:\n${recentHistory.join("\n")}` : "",
          `پیام فعلی کاربر: ${userMessage}`,
        ]
          .filter(Boolean)
          .join("\n\n"),
      });
      return object as IntentClassificationResult;
    },
    () => {
      logger.warn("intent_classification_fallback");
      return FALLBACK_RESULT;
    }
  );
}

function looksLikeConfigOrLog(text: string): boolean {
  const hasJsonBrace = /\{[\s\S]*"(platform|app|port|build|disks)"[\s\S]*\}/.test(text);
  const hasErrorLog = /(error|exception|traceback|stack trace|failed to|econnrefused|enoent)/i.test(
    text
  );
  const hasPersianErrorWords = /(خطا|ارور|فیل شد|کرش کرد)/i.test(text);
  return hasJsonBrace || (hasErrorLog && text.length > 40) || (hasPersianErrorWords && text.length > 40);
}

function isGreeting(text: string): boolean {
  return /^(سلام|درود|hi|hello|hey)/i.test(text.trim());
}
