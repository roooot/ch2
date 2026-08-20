"use client";

import { useRef } from "react";
import { Send, Paperclip, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * ورودی چت + دکمه پیوست فایل (برای آپلود liara.json یا لاگ خطا)
 */
export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !isLoading) onSubmit();
    }
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      toast.error("حجم فایل باید کمتر از 200KB باشد.");
      return;
    }

    const text = await file.text();
    const isJson = file.name.endsWith(".json");
    const wrapped = `این فایل ${isJson ? "liara.json" : "لاگ خطا"} من است، لطفاً بررسی کن:\n\`\`\`${
      isJson ? "json" : ""
    }\n${text.slice(0, 6000)}\n\`\`\``;

    onChange(wrapped);
    e.target.value = "";
  }

  return (
    <div className="flex items-end gap-2 rounded-2xl border bg-background p-2 shadow-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.log,.txt"
        className="hidden"
        onChange={handleFileSelect}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="shrink-0"
        onClick={() => fileInputRef.current?.click()}
        aria-label="پیوست فایل liara.json یا لاگ خطا"
      >
        <Paperclip className="h-4 w-4" />
      </Button>

      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="سوال خود را درباره لیارا بپرسید... (Enter برای ارسال، Shift+Enter برای خط جدید)"
        rows={1}
        className="max-h-40 flex-1 resize-none border-0 shadow-none focus-visible:ring-0 bg-transparent"
      />

      <Button
        type="button"
        size="icon"
        className="shrink-0 rounded-full"
        disabled={!value.trim() || isLoading}
        onClick={onSubmit}
        aria-label="ارسال پیام"
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 -scale-x-100" />}
      </Button>
    </div>
  );
}
