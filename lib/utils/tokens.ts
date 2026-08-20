/**
 * تخمین تعداد توکن‌ها بدون نیاز به کتابخانه سنگین tokenizer
 * تخمین تقریبی: هر ۴ کاراکتر انگلیسی ~ ۱ توکن، برای فارسی حدود ۲-۳ کاراکتر ~ ۱ توکن
 * این تابع صرفاً برای محدودسازی Context استفاده می‌شود، نه محاسبه دقیق هزینه.
 */
export function estimateTokenCount(text: string): number {
  if (!text) return 0;
  // نسبت تجربی برای متن ترکیبی فارسی/انگلیسی/کد
  const charsPerToken = 3.2;
  return Math.ceil(text.length / charsPerToken);
}

/**
 * بریدن متن تا سقف مشخصی از توکن‌های تخمینی
 */
export function truncateToTokenLimit(text: string, maxTokens: number): string {
  const estimated = estimateTokenCount(text);
  if (estimated <= maxTokens) return text;
  const ratio = maxTokens / estimated;
  const cutIndex = Math.floor(text.length * ratio);
  return text.slice(0, cutIndex) + "…";
}

/**
 * تقسیم متن به قطعات (Chunks) با همپوشانی (Overlap)
 * برای حفظ context بین چانک‌ها
 */
export function chunkText(
  text: string,
  maxTokensPerChunk = 350,
  overlapTokens = 50
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];

  // تخمین تعداد کلمه به‌ازای هر توکن (~0.75 توکن به ازای هر کلمه در فارسی/انگلیسی مخلوط)
  const wordsPerChunk = Math.floor(maxTokensPerChunk * 0.75);
  const overlapWords = Math.floor(overlapTokens * 0.75);

  if (words.length <= wordsPerChunk) {
    return [text.trim()];
  }

  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + wordsPerChunk, words.length);
    const chunk = words.slice(start, end).join(" ");
    if (chunk.trim().length > 0) chunks.push(chunk.trim());
    if (end === words.length) break;
    start = end - overlapWords;
  }

  return chunks;
}

/** تولید هش پایدار و مقاوم در برابر collision برای کلیدهای کش */
export function simpleHash(input: string): string {
  const normalized = input.trim().toLowerCase().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
import { createHash } from "node:crypto";
