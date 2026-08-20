"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/**
 * دکمه‌های فیدبک 👍/👎 روی هر پاسخ ایجنت
 */
export function FeedbackButtons({ messageId }: { messageId?: string }) {
  const [rating, setRating] = useState<"UP" | "DOWN" | null>(null);
  const [loading, setLoading] = useState(false);

  if (!messageId) return null;

  async function submit(next: "UP" | "DOWN") {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, rating: next }),
      });
      if (!res.ok) throw new Error();
      setRating(next);
      toast.success(next === "UP" ? "ممنون از بازخورد مثبت شما 🙏" : "بازخورد شما ثبت شد، سعی می‌کنیم بهتر شویم.");
    } catch {
      toast.error("ثبت بازخورد با خطا مواجه شد.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-1 mt-2">
      <button
        type="button"
        onClick={() => submit("UP")}
        disabled={loading}
        className={cn(
          "p-1.5 rounded-md hover:bg-emerald-500/10 transition-colors",
          rating === "UP" && "text-emerald-500 bg-emerald-500/10"
        )}
        aria-label="پاسخ مفید بود"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => submit("DOWN")}
        disabled={loading}
        className={cn(
          "p-1.5 rounded-md hover:bg-red-500/10 transition-colors",
          rating === "DOWN" && "text-red-500 bg-red-500/10"
        )}
        aria-label="پاسخ مفید نبود"
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
