import type { LiariaConfigAnalysisResult, LiariaConfigIssue } from "@/types";

/**
 * تحلیل‌گر قانون‌محور (Rule-Based) فایل liara.json و لاگ خطا
 *
 * این تحلیل قطعی (Deterministic) است و سپس نتیجه آن به مدل زبانی داده می‌شود
 * تا به زبان طبیعی و کاربرپسند برای کاربر توضیح دهد.
 */

const VALID_PLATFORMS = [
  "next",
  "nextjs",
  "node",
  "docker",
  "static",
  "php",
  "laravel",
  "django",
  "flask",
  "python",
  "wordpress",
  "angular",
  "react",
  "vue",
  "netcore",
  "netmvc",
  "adonis",
];

/** استخراج اولین بلاک JSON از یک متن آزاد (مثل پیام چت) */
export function extractJsonBlock(text: string): string | null {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) return codeBlockMatch[1].trim();

  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0].trim();

  return null;
}

export function isLikelyLog(text: string): boolean {
  return /(error|exception|traceback|at\s+\w+\(|econnrefused|enoent|npm err|fatal)/i.test(text);
}

export function analyzeLiariaJson(rawContent: string): LiariaConfigAnalysisResult {
  const issues: LiariaConfigIssue[] = [];
  let parsed: Record<string, unknown> | null = null;

  try {
    parsed = JSON.parse(rawContent);
  } catch {
    return {
      valid: false,
      issues: [
        {
          severity: "error",
          message: "فایل liara.json فرمت JSON معتبری ندارد و قابل parse نیست.",
          suggestion:
            "بررسی کنید که کاما (,) اضافه یا کم نداشته باشید و همه رشته‌ها با دابل‌کوتیشن (\") نوشته شده باشند.",
        },
      ],
      summary: "فایل JSON نامعتبر است.",
    };
  }

  if (!parsed || typeof parsed !== "object") {
    return {
      valid: false,
      issues: [{ severity: "error", message: "محتوای فایل یک object معتبر نیست." }],
      summary: "ساختار فایل نادرست است.",
    };
  }

  const platform = parsed["platform"] as string | undefined;

  if (!platform) {
    issues.push({
      severity: "error",
      field: "platform",
      message: "فیلد اجباری «platform» در فایل وجود ندارد.",
      suggestion: 'مثال: "platform": "nextjs"',
    });
  } else if (!VALID_PLATFORMS.includes(platform.toLowerCase())) {
    issues.push({
      severity: "warning",
      field: "platform",
      message: `مقدار platform یعنی "${platform}" در لیست پلتفرم‌های شناخته‌شده لیارا نیست.`,
      suggestion: `مقادیر معتبر رایج: ${VALID_PLATFORMS.slice(0, 8).join(", ")}`,
    });
  }

  if (!parsed["app"]) {
    issues.push({
      severity: "warning",
      field: "app",
      message: "فیلد «app» (نام اپلیکیشن در پنل لیارا) مشخص نشده است.",
      suggestion: 'اضافه کنید: "app": "نام-اپ-شما"',
    });
  }

  const port = parsed["port"];
  if (port !== undefined && (typeof port !== "number" || port <= 0 || port > 65535)) {
    issues.push({
      severity: "error",
      field: "port",
      message: "مقدار «port» باید یک عدد معتبر بین 1 تا 65535 باشد.",
    });
  }

  // بررسی خاص پلتفرم Next.js
  if (platform && /next/i.test(platform)) {
    const nextjsConfig = parsed["nextjs"] as Record<string, unknown> | undefined;
    if (nextjsConfig?.["runtime"] && !["nodejs18", "nodejs20"].includes(String(nextjsConfig["runtime"]))) {
      issues.push({
        severity: "warning",
        field: "nextjs.runtime",
        message: `مقدار runtime یعنی "${nextjsConfig["runtime"]}" ممکن است پشتیبانی نشود.`,
        suggestion: "مقادیر معتبر: nodejs18 یا nodejs20",
      });
    }
  }

  // بررسی build.location
  const build = parsed["build"] as Record<string, unknown> | undefined;
  if (build?.["location"] && !["iran", "germany"].includes(String(build["location"]))) {
    issues.push({
      severity: "info",
      field: "build.location",
      message: `مقدار build.location یعنی "${build["location"]}" غیرمعمول است.`,
    });
  }

  const hasErrors = issues.some((i) => i.severity === "error");

  return {
    valid: !hasErrors,
    platform,
    issues,
    summary: hasErrors
      ? `فایل liara.json دارای ${issues.filter((i) => i.severity === "error").length} خطای بحرانی است.`
      : issues.length > 0
        ? `فایل liara.json معتبر است اما ${issues.length} نکته/هشدار برای بهینه‌سازی وجود دارد.`
        : "فایل liara.json کاملاً معتبر و بدون مشکل است.",
  };
}

/**
 * تحلیل خطوط لاگ خطا با تطبیق الگوهای رایج مشکلات دیپلوی روی لیارا
 */
export function analyzeErrorLog(logText: string): LiariaConfigAnalysisResult {
  const issues: LiariaConfigIssue[] = [];

  const patterns: Array<{ regex: RegExp; issue: LiariaConfigIssue }> = [
    {
      regex: /ECONNREFUSED/i,
      issue: {
        severity: "error",
        message: "اتصال به یک سرویس (مثل دیتابیس یا Redis) رد شده است (ECONNREFUSED).",
        suggestion:
          "بررسی کنید Environment Variable آدرس دیتابیس (DATABASE_URL) درست تنظیم شده و سرویس دیتابیس روی پنل لیارا در حال اجراست.",
      },
    },
    {
      regex: /ENOTFOUND/i,
      issue: {
        severity: "error",
        message: "آدرس هاست پیدا نشد (ENOTFOUND) - معمولاً به دلیل هاست اشتباه در Connection String.",
        suggestion: "مقدار Host را از پنل لیارا (بخش دیتابیس) دوباره کپی کنید.",
      },
    },
    {
      regex: /EADDRINUSE/i,
      issue: {
        severity: "error",
        message: "پورت مورد نظر از قبل در حال استفاده است (EADDRINUSE).",
        suggestion: "مطمئن شوید اپلیکیشن روی پورتی که در liara.json تعریف کرده‌اید Listen می‌کند (معمولاً PORT از env).",
      },
    },
    {
      regex: /out of memory|oom/i,
      issue: {
        severity: "error",
        message: "اپلیکیشن به دلیل کمبود حافظه (Out of Memory) متوقف شده است.",
        suggestion: "پلن منابع (RAM) اپ خود را در پنل لیارا افزایش دهید یا نشتی حافظه در کد را بررسی کنید.",
      },
    },
    {
      regex: /module not found|cannot find module/i,
      issue: {
        severity: "error",
        message: "یک ماژول/پکیج پیدا نشده است.",
        suggestion: "بررسی کنید پکیج در package.json و dependencies (نه devDependencies) باشد و lock file به‌روز باشد.",
      },
    },
    {
      regex: /prisma.*migrate|P1001|P1010/i,
      issue: {
        severity: "error",
        message: "خطای اتصال یا مایگریشن Prisma به دیتابیس MySQL.",
        suggestion: "بررسی کنید DATABASE_URL صحیح است و دستور migrate deploy در مرحله build/start اجرا شده باشد.",
      },
    },
  ];

  for (const p of patterns) {
    if (p.regex.test(logText)) {
      issues.push(p.issue);
    }
  }

  if (issues.length === 0) {
    issues.push({
      severity: "info",
      message: "الگوی شناخته‌شده‌ای در این لاگ پیدا نشد؛ لطفاً متن کامل خطا را ارسال کنید.",
    });
  }

  return {
    valid: issues.every((i) => i.severity !== "error"),
    issues,
    summary: `${issues.filter((i) => i.severity === "error").length} خطای بحرانی در لاگ شناسایی شد.`,
  };
}
