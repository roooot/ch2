import { logger } from "@/lib/utils/logger";

/**
 * لودر مستندات از ریپوی گیت‌هاب لیارا (github.com/liara-cloud/docs)
 * از GitHub REST API برای گرفتن لیست فایل‌ها و راو محتوا استفاده می‌شود (نیاز به توکن ندارد
 * تا محدودیت نرخ پایین‌تری داشته باشد، اما در صورت وجود GITHUB_TOKEN استفاده می‌شود).
 */

export interface RemoteDocFile {
  path: string;
  url: string;
}

const GITHUB_API = "https://api.github.com";
const LLM_DOCS_PREFIX = "public/llms/";
const FILE_LIST_CACHE_TTL_MS = 5 * 60 * 1000;
const fileListCache = new Map<
  string,
  { expiresAt: number; files: RemoteDocFile[] }
>();

function authHeaders(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** دریافت لیست کامل فایل‌های markdown/mdx از یک ریپوی گیت‌هاب */
export async function listMarkdownFiles(
  repo: string,
  branch: string,
): Promise<RemoteDocFile[]> {
  const cacheKey = `${repo}:${branch}`;
  const cached = fileListCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.files;
  }

  const url = `${GITHUB_API}/repos/${repo}/git/trees/${branch}?recursive=1`;
  const res = await fetch(url, { headers: authHeaders() });

  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status}): ${await res.text()}`);
  }

  const data = (await res.json()) as {
    tree: Array<{ path: string; type: string }>;
  };

  // مخزن رسمی دو نسخه از هر صفحه دارد: صفحهٔ سایت و نسخهٔ پاک‌سازی‌شدهٔ
  // مخصوص مدل‌های زبانی. فقط نسخهٔ دوم را وارد می‌کنیم تا هم JSX/Import به
  // context نرسد و هم هر صفحه دوبار در نتایج ظاهر نشود.
  const mdFiles = data.tree.filter(
    (item) =>
      item.type === "blob" &&
      item.path.startsWith(LLM_DOCS_PREFIX) &&
      /\.md$/i.test(item.path),
  );

  logger.info("github_docs_listed", { count: mdFiles.length, repo, branch });

  const files = mdFiles
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((f) => ({
      path: f.path,
      url: `https://raw.githubusercontent.com/${repo}/${branch}/${f.path}`,
    }));
  fileListCache.set(cacheKey, {
    files,
    expiresAt: Date.now() + FILE_LIST_CACHE_TTL_MS,
  });
  return files;
}

/** دریافت محتوای خام یک فایل markdown */
export async function fetchRawContent(url: string): Promise<string> {
  const res = await fetch(url, { headers: authHeaders() });
  if (!res.ok) {
    throw new Error(`Failed to fetch raw content from ${url}: ${res.status}`);
  }
  return res.text();
}
