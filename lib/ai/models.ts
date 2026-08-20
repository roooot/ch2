import { createOpenAI } from "@ai-sdk/openai";

/**
 * پیکربندی مدل‌های AI - استراتژی دو سطحی برای بهینه‌سازی هزینه
 *
 * - مدل ارزان (cheap): Intent Classification، Rerank، خلاصه‌سازی کوچک
 * - مدل قوی (strong): تولید پاسخ نهایی RAG با کیفیت بالا
 * - مدل embedding: تولید بردار برای Retrieval
 *
 * با تنظیم OPENAI_BASE_URL می‌توان از هر سرویس سازگار با OpenAI API استفاده کرد.
 */

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL || undefined,
});

export const MODEL_NAMES = {
  cheap: process.env.MODEL_CHEAP || "gpt-4o-mini",
  strong: process.env.MODEL_STRONG || "gpt-4o",
  embedding: process.env.MODEL_EMBEDDING || "text-embedding-3-small",
};

/** مدل ارزان - برای طبقه‌بندی Intent و Rerank */
export const cheapModel = openai(MODEL_NAMES.cheap);

/** مدل قوی - برای تولید پاسخ نهایی */
export const strongModel = openai(MODEL_NAMES.strong);

/** مدل Embedding */
export const embeddingModel = openai.embedding(MODEL_NAMES.embedding);

export { openai };
