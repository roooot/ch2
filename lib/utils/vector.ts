/**
 * توابع محاسباتی برداری (Vector Math)
 * چون امبدینگ‌ها به‌صورت JSON در MySQL ذخیره می‌شوند (بدون pgvector)،
 * محاسبه شباهت کسینوسی به صورت کامل در Node.js انجام می‌شود.
 */

/**
 * محاسبه Cosine Similarity بین دو بردار
 * خروجی بین -1 تا 1 (هرچه به 1 نزدیک‌تر، شباهت بیشتر)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * نرمال‌سازی نمرات به بازه 0 تا 1 (Min-Max Normalization)
 * برای ترکیب امتیاز وکتور و امتیاز فول‌تکست در Hybrid Search
 */
export function normalizeScores(scores: number[]): number[] {
  if (scores.length === 0) return [];
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min;
  if (range === 0) return scores.map(() => 1);
  return scores.map((s) => (s - min) / range);
}

/** پارس کردن embedding ذخیره‌شده به‌صورت JSON در دیتابیس */
export function parseEmbedding(raw: unknown): number[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}
