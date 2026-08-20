/**
 * لاگر ساخت‌یافته (Structured Logger)
 * خروجی JSON برای سازگاری با سیستم‌های Log Aggregation (مثل لاگ‌های لیارا)
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogContext {
  [key: string]: unknown;
}

function baseLog(level: LogLevel, message: string, context?: LogContext) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  const line = JSON.stringify(entry);

  switch (level) {
    case "error":
      console.error(line);
      break;
    case "warn":
      console.warn(line);
      break;
    default:
      console.log(line);
  }
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    if (process.env.NODE_ENV !== "production") baseLog("debug", message, context);
  },
  info: (message: string, context?: LogContext) => baseLog("info", message, context),
  warn: (message: string, context?: LogContext) => baseLog("warn", message, context),
  error: (message: string, context?: LogContext) => baseLog("error", message, context),
};
