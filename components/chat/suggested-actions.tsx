"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SuggestedAction } from "@/types";

/**
 * دکمه‌های «قدم‌های بعدی» پیشنهادی
 * با کلیک، پیام از پیش‌نوشته‌شده به‌عنوان پیام بعدی کاربر ارسال می‌شود.
 */
export function SuggestedActions({
  actions,
  onSelect,
  disabled,
}: {
  actions: SuggestedAction[];
  onSelect: (prompt: string) => void;
  disabled?: boolean;
}) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={() => onSelect(action.prompt)}
          className="text-xs h-8"
        >
          {action.label}
          <ArrowLeft className="h-3 w-3" />
        </Button>
      ))}
    </div>
  );
}
