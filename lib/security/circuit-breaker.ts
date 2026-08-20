import { logger } from "@/lib/utils/logger";

/**
 * Circuit Breaker برای سرویس AI
 *
 * حالت‌ها:
 * - CLOSED: عملکرد عادی، درخواست‌ها عبور می‌کنند
 * - OPEN: تعداد خطاهای متوالی از حد آستانه گذشته، درخواست‌ها فوراً رد می‌شوند (fail-fast)
 * - HALF_OPEN: بعد از یک بازه زمانی، یک درخواست آزمایشی اجازه عبور دارد
 */

type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetTimeoutMs = 30_000
  ) {}

  canRequest(): boolean {
    if (this.state === "CLOSED") return true;

    if (this.state === "OPEN") {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed > this.resetTimeoutMs) {
        this.state = "HALF_OPEN";
        logger.info("circuit_breaker_half_open");
        return true;
      }
      return false;
    }

    // HALF_OPEN: فقط یک درخواست آزمایشی اجازه عبور دارد
    return true;
  }

  onSuccess(): void {
    if (this.state !== "CLOSED") {
      logger.info("circuit_breaker_closed_after_recovery");
    }
    this.state = "CLOSED";
    this.failureCount = 0;
  }

  onFailure(): void {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.state === "HALF_OPEN") {
      this.state = "OPEN";
      logger.warn("circuit_breaker_reopened");
      return;
    }

    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
      logger.error("circuit_breaker_opened", { failureCount: this.failureCount });
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

// یک نمونه سراسری برای فراخوانی‌های مدل AI (پاسخ‌گویی و امبدینگ)
export const aiCircuitBreaker = new CircuitBreaker(5, 30_000);

/** اجرای یک تابع async با محافظت Circuit Breaker */
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  fallback: () => T | Promise<T>
): Promise<T> {
  if (!aiCircuitBreaker.canRequest()) {
    logger.warn("circuit_breaker_blocked_request", { state: aiCircuitBreaker.getState() });
    return fallback();
  }

  try {
    const result = await fn();
    aiCircuitBreaker.onSuccess();
    return result;
  } catch (error) {
    aiCircuitBreaker.onFailure();
    logger.error("ai_service_call_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return fallback();
  }
}
