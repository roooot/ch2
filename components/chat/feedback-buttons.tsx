"use client";

import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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
      <Button
        type="button"
        onClick={() => submit("UP")}
        disabled={loading}
        variant="ghost"
        size="icon"
        className={cn(
          "size-8",
          rating === "UP" && "bg-primary/10 text-primary"
        )}
        aria-label="پاسخ مفید بود"
      >
        <ThumbsUp data-icon="inline-start" />
      </Button>
      <Button
        type="button"
        onClick={() => submit("DOWN")}
        disabled={loading}
        variant="ghost"
        size="icon"
        className={cn(
          "size-8",
          rating === "DOWN" && "bg-destructive/10 text-destructive"
        )}
        aria-label="پاسخ مفید نبود"
      >
        <ThumbsDown data-icon="inline-start" />
      </Button>
    </div>
  );
}
