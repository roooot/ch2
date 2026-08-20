import crypto from "node:crypto";
import matter from "gray-matter";
import { prisma } from "@/lib/db/prisma";
import { listMarkdownFiles, fetchRawContent } from "@/lib/ingestion/github-loader";
import { generateEmbeddings } from "@/lib/rag/embedding";
import { chunkText, estimateTokenCount } from "@/lib/utils/tokens";
import { logger } from "@/lib/utils/logger";
import type { Prisma } from "@prisma/client";

/**
 * پایپلاین Ingestion مستندات لیارا
 *
 * مراحل:
 * 1. دریافت لیست فایل‌های markdown از ریپوی گیت‌هاب liara-cloud/docs
 * 2. برای هر فایل: استخراج frontmatter، محاسبه hash محتوا
 * 3. اگر محتوا نسبت به قبل تغییر نکرده: رد شدن (بهینه‌سازی هزینه Embedding)
 * 4. Chunking متن + تولید Embedding به‌صورت batch
 * 5. ذخیره Document و Chunk ها در MySQL
 */

const DOCS_BASE_URL = "https://docs.liara.ir";
const LLM_DOCS_PREFIX = "public/llms/";
const MAX_EMBEDDING_BATCH_CHUNKS = 128;

function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function inferCategory(path: string): string {
  const segments = path
    .replace(LLM_DOCS_PREFIX, "")
    .split("/")
    .filter(Boolean);
  return segments.length > 1 ? segments[0] : "عمومی";
}

function buildDocUrl(path: string, rawContent = ""): string {
  const originalLink = rawContent.match(/^Original link:\s*(https?:\/\/\S+)\s*$/im)?.[1];
  if (originalLink) return originalLink.replace(/\/+$/, "");

  const cleanPath = path
    .replace(LLM_DOCS_PREFIX, "")
    .replace(/\.mdx?$/, "");
  return `${DOCS_BASE_URL}/${cleanPath}`;
}

function stripOriginalLink(content: string): string {
  return content.replace(/^Original link:\s*https?:\/\/\S+\s*\r?\n+/i, "").trim();
}

export interface IngestStats {
  totalFiles: number;
  processed: number;
  updated: number;
  skippedUnchanged: number;
  failed: number;
  totalChunks: number;
  nextCursor?: string;
  completed: boolean;
}

export interface IngestOptions {
  clean?: boolean;
  /** آخرین مسیر پردازش‌شده؛ برای اجرای ایمن و مرحله‌ای در production. */
  cursor?: string;
  /** در حالت CLI نبود این مقدار یعنی همهٔ فایل‌ها پردازش شوند. */
  limit?: number;
}

interface PreparedDocument {
  path: string;
  sourceUrl: string;
  title: string;
  category: string;
  contentHash: string;
  content: string;
  chunks: string[];
}

export async function ingestFromGitHub(options?: IngestOptions): Promise<IngestStats> {
  const repo = process.env.DOCS_GITHUB_REPO || "liara-cloud/docs";
  const branch = process.env.DOCS_GITHUB_BRANCH || "master";

  const files = await listMarkdownFiles(repo, branch);
  const cursor = options?.cursor;
  const cursorIndex = cursor
    ? files.findIndex((file) => file.path === cursor)
    : -1;
  const startIndex = cursorIndex >= 0
    ? cursorIndex + 1
    : cursor
      ? files.findIndex((file) => file.path > cursor)
      : 0;
  const safeStartIndex = startIndex < 0 ? files.length : startIndex;
  const selectedFiles = options?.limit
    ? files.slice(safeStartIndex, safeStartIndex + options.limit)
    : files.slice(safeStartIndex);
  const completed = safeStartIndex + selectedFiles.length >= files.length;

  const stats: IngestStats = {
    totalFiles: files.length,
    processed: selectedFiles.length,
    updated: 0,
    skippedUnchanged: 0,
    failed: 0,
    totalChunks: 0,
    nextCursor: selectedFiles.at(-1)?.path,
    completed,
  };
  const currentSourceUrls = files.map((file) => buildDocUrl(file.path));

  if (options?.clean) {
    logger.info("ingest_clean_start", {
      message: "اسناد با موفقیت جایگزین می‌شوند و فایل‌های حذف‌شده فقط پس از تکمیل پاک خواهند شد.",
    });
  }

  const pendingDocuments: PreparedDocument[] = [];

  for (const file of selectedFiles) {
    try {
      const raw = await fetchRawContent(file.url);
      const parsed = matter(raw);
      const content = stripOriginalLink(parsed.content);
      const title = (parsed.data?.title as string) || deriveTitle(content, file.path);
      const sourceUrl = buildDocUrl(file.path, raw);
      const category = (parsed.data?.category as string) || inferCategory(file.path);
      const contentHash = computeHash(`${title}\u0000${category}\u0000${content}`);

      const existing = await prisma.document.findUnique({ where: { sourceUrl } });

      if (!options?.clean && existing && existing.contentHash === contentHash) {
        stats.skippedUnchanged += 1;
        continue;
      }

      const textChunks = chunkText(content, 350, 50).filter(Boolean);
      if (textChunks.length === 0) {
        throw new Error("Document has no indexable content.");
      }
      pendingDocuments.push({
        path: file.path,
        sourceUrl,
        title,
        category,
        contentHash,
        content,
        chunks: textChunks,
      });
    } catch (error) {
      stats.failed += 1;
      logger.error("document_ingest_failed", {
        path: file.path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // مدل embedding ورودی‌های متعدد را در یک درخواست پشتیبانی می‌کند. chunkهای چند
  // صفحه را با هم می‌فرستیم تا ورود اولیهٔ corpus هزاران درخواست شبکه‌ای نسازد.
  const embeddingBatches: PreparedDocument[][] = [];
  let currentBatch: PreparedDocument[] = [];
  let currentChunkCount = 0;

  for (const document of pendingDocuments) {
    if (
      currentBatch.length > 0 &&
      currentChunkCount + document.chunks.length > MAX_EMBEDDING_BATCH_CHUNKS
    ) {
      embeddingBatches.push(currentBatch);
      currentBatch = [];
      currentChunkCount = 0;
    }
    currentBatch.push(document);
    currentChunkCount += document.chunks.length;
  }
  if (currentBatch.length > 0) embeddingBatches.push(currentBatch);

  for (const documents of embeddingBatches) {
    const texts = documents.flatMap((document) => document.chunks);
    const embeddings = await generateEmbeddings(texts);
    assertEmbeddingsReady(embeddings, texts.length, documents.map((document) => document.path).join(", "));

    let embeddingOffset = 0;
    for (const documentInput of documents) {
      const documentEmbeddings = embeddings.slice(
        embeddingOffset,
        embeddingOffset + documentInput.chunks.length
      );
      embeddingOffset += documentInput.chunks.length;

      try {
        // دادهٔ قبلی تا زمانی که نسخهٔ جدید کامل و embeddingها معتبر نشده‌اند باقی می‌ماند.
        await prisma.$transaction(async (tx) => {
          const document = await tx.document.upsert({
            where: { sourceUrl: documentInput.sourceUrl },
            update: {
              title: documentInput.title,
              category: documentInput.category,
              contentHash: documentInput.contentHash,
              rawContent: documentInput.content,
              sourcePath: documentInput.path,
            },
            create: {
              sourceUrl: documentInput.sourceUrl,
              sourcePath: documentInput.path,
              title: documentInput.title,
              category: documentInput.category,
              contentHash: documentInput.contentHash,
              rawContent: documentInput.content,
            },
          });

          await tx.chunk.deleteMany({ where: { documentId: document.id } });
          await tx.chunk.createMany({
            data: documentInput.chunks.map((content, index) => ({
              documentId: document.id,
              content,
              chunkIndex: index,
              tokenCount: estimateTokenCount(content),
              embedding: documentEmbeddings[index] as unknown as Prisma.InputJsonValue,
              embeddingDim: documentEmbeddings[index].length,
            })),
          });
        });

        stats.totalChunks += documentInput.chunks.length;
        stats.updated += 1;
        logger.info("document_ingested", { path: documentInput.path, chunks: documentInput.chunks.length });
      } catch (error) {
        stats.failed += 1;
        logger.error("document_ingest_failed", {
          path: documentInput.path,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  // در حالت clean فقط پس از کامل‌شدن corpus و وقتی هیچ سندی خطا نداشته باشد،
  // فایل‌های حذف‌شده از منبع را پاک می‌کنیم. اجرای batch نباید دادهٔ قدیمی را حذف کند.
  if (options?.clean && completed) {
    if (stats.failed > 0) {
      logger.warn("ingest_clean_stale_documents_preserved", { failed: stats.failed });
    } else {
      const removed = await prisma.document.deleteMany({
        where: { sourceUrl: { notIn: currentSourceUrls } },
      });
      logger.info("ingest_clean_stale_documents_removed", { count: removed.count });
    }
  }

  logger.info("ingest_completed", stats as unknown as Record<string, unknown>);
  return stats;
}

function assertEmbeddingsReady(embeddings: number[][], expectedCount: number, path: string): void {
  if (embeddings.length !== expectedCount || embeddings.some((embedding) => embedding.length === 0)) {
    throw new Error(`Embedding generation failed for ${path}.`);
  }

  const dimension = embeddings[0]?.length;
  if (!dimension || embeddings.some((embedding) => embedding.length !== dimension)) {
    throw new Error(`Embedding dimensions are inconsistent for ${path}.`);
  }
}

function deriveTitle(content: string, fallbackPath: string): string {
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  return fallbackPath.split("/").pop()?.replace(/\.mdx?$/, "") || "بدون عنوان";
}
