"use client";

import { useRef } from "react";
import { Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

export function ChatInput({
  value,
  onChange,
  onSubmit,
  isLoading,
  isNewConversation,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  isNewConversation: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (value.trim() && !isLoading) onSubmit();
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 200 * 1024) {
      toast.error("حجم فایل باید کمتر از ۲۰۰ کیلوبایت باشد.");
      event.target.value = "";
      return;
    }

    const text = await file.text();
    const isJson = file.name.endsWith(".json");
    const wrapped = `این فایل ${isJson ? "liara.json" : "لاگ خطا"} من است، لطفاً بررسی کن:\n\`\`\`${
      isJson ? "json" : ""
    }\n${text.slice(0, 6000)}\n\`\`\``;

    onChange(wrapped);
    event.target.value = "";
  };

  return (
    <Field className="relative isolate">
      <div
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute -inset-x-4 -inset-y-5 z-0 rounded-[1.75rem] bg-primary/15 blur-3xl opacity-0 transition-opacity duration-500 motion-reduce:transition-none dark:bg-primary/20",
          isNewConversation && "opacity-100"
        )}
      />
      <FieldLabel htmlFor="chat-message" className="relative z-10 sr-only">
        پیام شما برای Liara Copilot
      </FieldLabel>
      <InputGroup className="relative z-10 h-auto rounded-lg bg-card shadow-sm">
        <InputGroupTextarea
          id="chat-message"
          dir="auto"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="سؤال خود را دربارهٔ لیارا بپرسید…"
          rows={1}
          disabled={isLoading}
          className="min-h-20 max-h-44 text-start text-sm leading-6 [unicode-bidi:plaintext]"
        />
        <InputGroupAddon align="block-end" className="justify-between border-t border-border">
          <div className="flex items-center gap-1">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,.log,.txt"
              className="sr-only"
              onChange={handleFileSelect}
            />
            <InputGroupButton
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => fileInputRef.current?.click()}
              aria-label="پیوست فایل liara.json یا لاگ خطا"
              title="پیوست فایل"
              disabled={isLoading}
            >
              <Paperclip data-icon="inline-start" />
            </InputGroupButton>
            <span className="hidden text-[11px] text-muted-foreground sm:inline">Enter برای ارسال · Shift + Enter برای خط جدید</span>
          </div>
          <InputGroupButton
            type="button"
            variant="default"
            size="icon-sm"
            onClick={onSubmit}
            disabled={!value.trim() || isLoading}
            aria-label="ارسال پیام"
            title="ارسال پیام"
          >
            {isLoading ? <Spinner aria-label="در حال ارسال" /> : <Send data-icon="inline-start" />}
          </InputGroupButton>
        </InputGroupAddon>
      </InputGroup>
    </Field>
  );
}
