import { prisma } from "@/lib/db/prisma";
import { cosineSimilarity, normalizeScores, parseEmbedding } from "@/lib/utils/vector";
import { generateEmbedding } from "@/lib/rag/embedding";
import { logger } from "@/lib/utils/logger";
import type { RetrievedChunk } from "@/types";

/**
 * Hybrid Retrieval: ترکیب جستجوی برداری (Embedding) و جستجوی متنی (Full-Text Search)
 *
 * مرحله ۱: جستجوی برداری - محاسبه Cosine Similarity بین embedding سوال و همه chunk ها
 *   (چون از MySQL بدون pgvector استفاده می‌کنیم، این مرحله در Node.js انجام می‌شود)
 * مرحله ۲: جستجوی متنی - استفاده از FULLTEXT index داخلی MySQL برای تطابق کلیدواژه‌ای دقیق
 * مرحله ۳: ترکیب امتیازها با وزن‌دهی (weighted hybrid score)
 *
 * برای مقیاس‌پذیری بیشتر در آینده (میلیون‌ها chunk)، می‌توان این بخش را
 * به یک وکتور دیتابیس اختصاصی (مثل Qdrant/Weaviate) یا pgvector منتقل کرد،
 * اما طبق الزامات پروژه، فعلاً همه‌چیز در MySQL نگه داشته می‌شود.
 */

const VECTOR_WEIGHT = 0.65;
const TEXT_WEIGHT = 0.35;
const CANDIDATE_LIMIT = 200; // تعداد بهترین بردارها که برای ادغام با Full-Text نگه می‌داریم
const VECTOR_PAGE_SIZE = 250;

export async function hybridSearch(
  query: string,
  topK = 8
): Promise<RetrievedChunk[]> {
  const [queryEmbedding, textResults] = await Promise.all([
    generateEmbedding(query),
    fullTextSearch(query, CANDIDATE_LIMIT),
  ]);

  // اگر embedding موجود نبود (به دلیل خرابی سرویس AI)، فقط بر اساس فول‌تکست ادامه بده
  if (queryEmbedding.length === 0) {
    logger.warn("hybrid_search_vector_unavailable_fallback_to_text");
    return textResults
      .sort((a, b) => b.textScore - a.textScore)
      .slice(0, topK)
      .map((r) => ({ ...r, vectorScore: 0, hybridScore: r.textScore }));
  }

  // همهٔ بردارها صفحه‌به‌صفحه بررسی می‌شوند تا اسناد قدیمی صرفاً به‌دلیل createdAt
  // از retrieval کنار گذاشته نشوند. فقط 200 نتیجهٔ برتر در حافظه نگه داشته می‌شود.
  const vectorScored = await findTopVectorCandidates(queryEmbedding, CANDIDATE_LIMIT);

  const normalizedVectorScores = normalizeScores(vectorScored.map((c) => c.vectorScore));

  const combinedMap = new Map<string, RetrievedChunk>();

  vectorScored.forEach((chunk, idx) => {
    combinedMap.set(chunk.chunkId, {
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      title: chunk.title,
      url: chunk.url,
      content: chunk.content,
      vectorScore: normalizedVectorScores[idx] ?? 0,
      textScore: 0,
      hybridScore: 0,
    });
  });

  if (textResults.length > 0) {
    const normalizedTextScores = normalizeScores(textResults.map((r) => r.textScore));
    textResults.forEach((result, idx) => {
      const existing = combinedMap.get(result.chunkId);
      const textScore = normalizedTextScores[idx] ?? 0;
      if (existing) {
        existing.textScore = textScore;
      } else {
        combinedMap.set(result.chunkId, {
          ...result,
          vectorScore: 0,
          textScore,
          hybridScore: 0,
        });
      }
    });
  }

  const results = Array.from(combinedMap.values()).map((r) => ({
    ...r,
    hybridScore: r.vectorScore * VECTOR_WEIGHT + r.textScore * TEXT_WEIGHT,
  }));

  results.sort((a, b) => b.hybridScore - a.hybridScore);

  return results.slice(0, topK);
}

async function findTopVectorCandidates(
  queryEmbedding: number[],
  limit: number
): Promise<Array<Omit<RetrievedChunk, "textScore" | "hybridScore">>> {
  const topCandidates: Array<Omit<RetrievedChunk, "textScore" | "hybridScore">> = [];
  let cursor: string | undefined;

  do {
    const page = await prisma.chunk.findMany({
      take: VECTOR_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      select: {
        id: true,
        documentId: true,
        content: true,
        embedding: true,
        document: { select: { title: true, sourceUrl: true } },
      },
    });

    for (const chunk of page) {
      const embedding = parseEmbedding(chunk.embedding);
      // embeddingهایی که با مدل/بُعد دیگری ساخته شده‌اند نباید امتیاز ساختگی بگیرند.
      if (embedding.length !== queryEmbedding.length || embedding.length === 0) continue;

      topCandidates.push({
        chunkId: chunk.id,
        documentId: chunk.documentId,
        title: chunk.document.title,
        url: chunk.document.sourceUrl,
        content: chunk.content,
        vectorScore: cosineSimilarity(queryEmbedding, embedding),
      });
    }

    topCandidates.sort((a, b) => b.vectorScore - a.vectorScore);
    if (topCandidates.length > limit) topCandidates.length = limit;

    cursor = page.at(-1)?.id;
    if (page.length < VECTOR_PAGE_SIZE) break;
  } while (cursor);

  return topCandidates;
}

/** جستجوی متنی با استفاده از FULLTEXT index داخلی MySQL (MATCH ... AGAINST) */
async function fullTextSearch(
  query: string,
  limit: number
): Promise<Array<Omit<RetrievedChunk, "vectorScore" | "hybridScore">>> {
  try {
    // پاک‌سازی کوئری برای جلوگیری از خطای BOOLEAN MODE syntax
    const sanitized = query.replace(/[+\-<>()~*"@]/g, " ").trim();
    if (!sanitized) return [];

    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; documentId: string; content: string; title: string; sourceUrl: string; score: number }>
    >(
      `SELECT c.id as id, c.documentId as documentId, c.content as content,
              d.title as title, d.sourceUrl as sourceUrl,
              MATCH(c.content) AGAINST(? IN NATURAL LANGUAGE MODE) as score
       FROM chunks c
       JOIN documents d ON d.id = c.documentId
       WHERE MATCH(c.content) AGAINST(? IN NATURAL LANGUAGE MODE)
       ORDER BY score DESC
       LIMIT ?`,
      sanitized,
      sanitized,
      limit
    );

    return rows.map((row) => ({
      chunkId: row.id,
      documentId: row.documentId,
      title: row.title,
      url: row.sourceUrl,
      content: row.content,
      textScore: row.score,
    }));
  } catch (error) {
    // اگر FULLTEXT پشتیبانی نشد یا خطایی رخ داد، به‌جای شکست کامل، آرایه خالی برگردان
    logger.warn("fulltext_search_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  }
}
