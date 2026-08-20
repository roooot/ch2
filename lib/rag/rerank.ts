import { generateText } from "ai";
import { cheapModel } from "@/lib/ai/models";
import { withCircuitBreaker } from "@/lib/security/circuit-breaker";
import { sanitizeRetrievedContent } from "@/lib/security/prompt-injection";
import { logger } from "@/lib/utils/logger";
import type { RetrievedChunk } from "@/types";

/**
 * Rerank با استفاده از مدل ارزان (LLM-based Reranking)
 *
 * به مدل ارزان لیست chunk های کاندید و سوال کاربر داده می‌شود و
 * از آن خواسته می‌شود امتیاز ربط (0 تا 10) به هر chunk بدهد.
 * این روش دقت بازیابی را نسبت به صرفاً Hybrid Score بالا می‌برد،
 * بدون اینکه هزینه بالایی مثل استفاده از مدل قوی داشته باشد.
 */

export async function rerankChunks(
  query: string,
  chunks: RetrievedChunk[],
  topK = 5
): Promise<RetrievedChunk[]> {
  if (chunks.length === 0) return [];
  if (chunks.length <= topK) return chunks;

  return withCircuitBreaker(
    async () => {
      const listForPrompt = chunks
        .map((c, i) => `[${i}] ${c.title}\n${sanitizeRetrievedContent(c.content).slice(0, 500)}`)
        .join("\n\n---\n\n");

      const { text } = await generateText({
        model: cheapModel,
        temperature: 0,
        prompt: [
          "شما یک سیستم Rerank هستید. برای سوال زیر، به هر قطعه متن یک امتیاز ربط از 0 تا 10 بده.",
          "فقط خروجی را به فرمت JSON آرایه‌ای از اعداد بده، مثل: [8, 3, 10, 1, ...]",
          "تعداد اعداد باید دقیقاً برابر تعداد قطعات باشد و ترتیب باید حفظ شود.",
          "",
          `سوال کاربر: ${query}`,
          "",
          "قطعات متن:",
          listForPrompt,
        ].join("\n"),
      });

      const scores = parseScoresFromText(text, chunks.length);

      const rescored = chunks.map((chunk, idx) => ({
        ...chunk,
        rerankScore: scores[idx] ?? chunk.hybridScore * 10,
      }));

      rescored.sort((a, b) => (b.rerankScore ?? 0) - (a.rerankScore ?? 0));

      return rescored.slice(0, topK);
    },
    () => {
      logger.warn("rerank_fallback_to_hybrid_score");
      return [...chunks].sort((a, b) => b.hybridScore - a.hybridScore).slice(0, topK);
    }
  );
}

function parseScoresFromText(text: string, expectedLength: number): number[] {
  try {
    const match = text.match(/\[[\s\S]*?\]/);
    if (!match) return [];
    const parsed = JSON.parse(match[0]);
    if (Array.isArray(parsed) && parsed.length === expectedLength) {
      return parsed.map((n) => Number(n) || 0);
    }
    return [];
  } catch {
    return [];
  }
}
