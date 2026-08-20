import { hybridSearch } from "@/lib/rag/hybrid-search";
import { rerankChunks } from "@/lib/rag/rerank";
import { sanitizeRetrievedContent } from "@/lib/security/prompt-injection";
import { truncateToTokenLimit } from "@/lib/utils/tokens";
import type { Citation, RetrievedChunk } from "@/types";

/**
 * Orchestrator اصلی RAG:
 * 1. Hybrid Search (Vector + Full-Text)
 * 2. Rerank با مدل ارزان
 * 3. محدودسازی Context برای کنترل هزینه توکن
 */

const MAX_CONTEXT_TOKENS = 3000; // سقف کل context بازیابی‌شده که به مدل قوی داده می‌شود
const RETRIEVE_CANDIDATES = 12;
const FINAL_TOP_K = 5;

export interface RetrievalResult {
  chunks: RetrievedChunk[];
  citations: Citation[];
  contextText: string;
}

export async function retrieveContext(query: string): Promise<RetrievalResult> {
  const candidates = await hybridSearch(query, RETRIEVE_CANDIDATES);

  if (candidates.length === 0) {
    return { chunks: [], citations: [], contextText: "" };
  }

  const reranked = await rerankChunks(query, candidates, FINAL_TOP_K);

  const contextText = truncateToTokenLimit(
    reranked
      .map(
        (c, i) =>
          `[منبع ${i + 1}] عنوان: ${c.title}\n${sanitizeRetrievedContent(c.content)}`
      )
      .join("\n\n---\n\n"),
    MAX_CONTEXT_TOKENS
  );

  const citations: Citation[] = reranked.map((c) => ({
    documentId: c.documentId,
    chunkId: c.chunkId,
    title: c.title,
    url: c.url,
    snippet: c.content.slice(0, 220).trim() + (c.content.length > 220 ? "…" : ""),
    score: Math.round((c.rerankScore ?? c.hybridScore * 10) * 10) / 10,
  }));

  return { chunks: reranked, citations, contextText };
}

/** تشخیص اینکه آیا نتایج بازیابی‌شده کیفیت کافی برای پاسخ‌گویی مطمئن دارند */
export function isRetrievalConfident(result: RetrievalResult): boolean {
  if (result.chunks.length === 0) return false;
  const topScore = result.chunks[0].rerankScore ?? result.chunks[0].hybridScore * 10;
  return topScore >= 3;
}
