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

const DOCS_BASE_URL = "https://docs.liara.ir/docs";

function computeHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function inferCategory(path: string): string {
  const segments = path.split("/").filter((s) => s && s !== "docs");
  return segments.length > 1 ? segments[0] : "عمومی";
}

function buildDocUrl(path: string): string {
  const cleanPath = path.replace(/^docs\//, "").replace(/\.mdx?$/, "");
  return `${DOCS_BASE_URL}/${cleanPath}`;
}

export interface IngestStats {
  totalFiles: number;
  updated: number;
  skippedUnchanged: number;
  failed: number;
  totalChunks: number;
}

export async function ingestFromGitHub(options?: { clean?: boolean }): Promise<IngestStats> {
  const repo = process.env.DOCS_GITHUB_REPO || "liara-cloud/docs";
  const branch = process.env.DOCS_GITHUB_BRANCH || "main";

  const stats: IngestStats = {
    totalFiles: 0,
    updated: 0,
    skippedUnchanged: 0,
    failed: 0,
    totalChunks: 0,
  };

  const files = await listMarkdownFiles(repo, branch);
  stats.totalFiles = files.length;
  const currentSourceUrls = files.map((file) => buildDocUrl(file.path));

  if (options?.clean) {
    logger.info("ingest_clean_start", {
      message: "اسناد با موفقیت جایگزین می‌شوند و فایل‌های حذف‌شده فقط پس از تکمیل پاک خواهند شد.",
    });
  }

  for (const file of files) {
    try {
      const raw = await fetchRawContent(file.url);
      const parsed = matter(raw);
      const title = (parsed.data?.title as string) || deriveTitle(parsed.content, file.path);
      const sourceUrl = buildDocUrl(file.path);
      const category = (parsed.data?.category as string) || inferCategory(file.path);
      const contentHash = computeHash(`${title}\u0000${category}\u0000${parsed.content}`);

      const existing = await prisma.document.findUnique({ where: { sourceUrl } });

      if (!options?.clean && existing && existing.contentHash === contentHash) {
        stats.skippedUnchanged += 1;
        continue;
      }

      const textChunks = chunkText(parsed.content, 350, 50).filter(Boolean);
      if (textChunks.length === 0) {
        throw new Error("Document has no indexable content.");
      }
      const embeddings = await generateEmbeddings(textChunks);
      assertEmbeddingsReady(embeddings, textChunks.length, file.path);

      // دادهٔ قبلی تا زمانی که نسخهٔ جدید کامل و embeddingها معتبر نشده‌اند باقی می‌ماند.
      await prisma.$transaction(async (tx) => {
        const document = await tx.document.upsert({
          where: { sourceUrl },
          update: {
            title,
            category,
            contentHash,
            rawContent: parsed.content,
            sourcePath: file.path,
          },
          create: {
            sourceUrl,
            sourcePath: file.path,
            title,
            category,
            contentHash,
            rawContent: parsed.content,
          },
        });

        await tx.chunk.deleteMany({ where: { documentId: document.id } });
        await tx.chunk.createMany({
          data: textChunks.map((content, idx) => ({
            documentId: document.id,
            content,
            chunkIndex: idx,
            tokenCount: estimateTokenCount(content),
            embedding: embeddings[idx] as unknown as Prisma.InputJsonValue,
            embeddingDim: embeddings[idx].length,
          })),
        });
      });

      stats.totalChunks += textChunks.length;
      stats.updated += 1;

      logger.info("document_ingested", { path: file.path, chunks: textChunks.length });
    } catch (error) {
      stats.failed += 1;
      logger.error("document_ingest_failed", {
        path: file.path,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // در حالت clean فقط وقتی همهٔ اسناد موفق بوده‌اند، فایل‌هایی که دیگر در منبع وجود ندارند حذف می‌شوند.
  if (options?.clean) {
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
