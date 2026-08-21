const REDACTED = "[REDACTED]";

/**
 * داده‌ای که از کاربر یا API خارجی به مدل می‌رسد، ممکن است ناخواسته شامل
 * credential باشد. این تابع محافظ نهاییِ سمت سرور است؛ UI فقط یک لایه
 * کمکی محسوب می‌شود و قابل دورزدن است.
 */
export function redactSensitiveData(input: string): string {
  return input
    // Authorization header, including the common "Bearer <token>" format.
    .replace(/(authorization\s*[:=]\s*bearer\s+)([^\s'"`]+)/gi, `$1${REDACTED}`)
    // Key-value pairs commonly present in logs, dotenv files, and JSON.
    .replace(
      /(\b(?:api[_-]?key|access[_-]?token|access[_-]?key|token|secret|password|passwd|database[_-]?url)\b\s*[:=]\s*["']?)([^\s'"`,}]+)/gi,
      `$1${REDACTED}`
    )
    // Database URLs can otherwise expose user names and passwords in one value.
    .replace(
      /\b(mysql|postgres(?:ql)?|mongodb(?:\+srv)?|redis):\/\/[^\s'"`]+/gi,
      (_match, scheme: string) => `${scheme}://${REDACTED}`
    )
    // Common API-token prefixes.
    .replace(/\b(?:sk|aa)-[A-Za-z0-9_-]{16,}\b/g, REDACTED)
    .replace(/\b(?:ghp|github_pat)_[A-Za-z0-9_]{16,}\b/g, REDACTED)
    // JWTs (Liara API tokens use this format).
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, REDACTED);
}

/**
 * Recursive allow-by-default sanitization for structured, read-only API
 * responses. Environment-variable values and credential-like fields are
 * never allowed through to the model.
 */
export function sanitizeExternalData(value: unknown, depth = 0): unknown {
  if (depth > 8) return "[TRUNCATED]";

  if (typeof value === "string") return redactSensitiveData(value);
  if (typeof value !== "object" || value === null) return value;

  if (Array.isArray(value)) {
    return value.slice(0, 100).map((item) => sanitizeExternalData(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (/(?:api[_-]?key|access[_-]?key|access[_-]?token|token|secret|password|passwd|authorization|credential|database[_-]?url)/i.test(key)) {
      result[key] = REDACTED;
      continue;
    }

    // An environment map is useful only by its variable names, never values.
    if (/^(?:env|environment|environmentvariables|variables)$/i.test(key) && nested && typeof nested === "object") {
      result[key] = { names: Object.keys(nested as Record<string, unknown>).slice(0, 100) };
      continue;
    }

    result[key] = sanitizeExternalData(nested, depth + 1);
  }
  return result;
}
