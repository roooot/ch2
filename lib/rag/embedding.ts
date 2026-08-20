import { embed, embedMany } from "ai";
import { embeddingModel } from "@/lib/ai/models";
import { withCircuitBreaker } from "@/lib/security/circuit-breaker";
import { logger } from "@/lib/utils/logger";

/**
 * سرویس تولید Embedding
 * از Vercel AI SDK برای فراخوانی مدل embedding استفاده می‌شود.
 */

export async function generateEmbedding(text: string): Promise<number[]> {
  return withCircuitBreaker(
    async () => {
      const { embedding } = await embed({
        model: embeddingModel,
        value: text.slice(0, 8000),
      });
      return embedding;
    },
    () => {
      logger.warn("embedding_fallback_empty_vector");
      return [];
    }
  );
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  return withCircuitBreaker(
    async () => {
      const { embeddings } = await embedMany({
        model: embeddingModel,
        values: texts.map((t) => t.slice(0, 8000)),
      });
      return embeddings;
    },
    () => {
      logger.warn("embedding_batch_fallback_empty_vectors");
      return texts.map(() => []);
    }
  );
}
