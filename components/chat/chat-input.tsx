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
import { redactSensitiveData } from "@/lib/security/sensitive-data";

const MAX_CHAT_MESSAGE_CHARACTERS = 4_000;
const MAX_ATTACHMENT_BYTES = 200 * 1024;
const ALLOWED_ATTACHMENT_EXTENSIONS = new Set(["json", "log", "txt"]);
const ALLOWED_ATTACHMENT_TYPES = new Set(["", "application/json", "text/plain", "application/octet-stream"]);

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

    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_ATTACHMENT_EXTENSIONS.has(extension)) {
      toast.error("فقط فایل‌های JSON، LOG و TXT قابل بررسی هستند.");
      event.target.value = "";
      return;
    }

    if (!ALLOWED_ATTACHMENT_TYPES.has(file.type)) {
      toast.error("نوع فایل انتخاب‌شده معتبر نیست.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error("حجم فایل باید کمتر از ۲۰۰ کیلوبایت باشد.");
      event.target.value = "";
      return;
    }

    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (!isPlainText(text) || (extension === "json" && !isValidJson(text))) {
        toast.error(extension === "json" ? "فایل JSON معتبر نیست." : "فایل باید یک متن UTF-8 معتبر باشد.");
        return;
      }

      const isJson = extension === "json";
      const prefix = `این فایل ${isJson ? "liara.json" : "لاگ خطا"} من است، لطفاً بررسی کن:\n\`\`\`${
        isJson ? "json" : ""
      }\n`;
      const suffix = "\n\`\`\`";
      const maxContentLength = MAX_CHAT_MESSAGE_CHARACTERS - prefix.length - suffix.length;
      const content = redactSensitiveData(text.slice(0, Math.max(0, maxContentLength)));
      const wrapped = `${prefix}${content}${suffix}`;

      if (content !== text.slice(0, Math.max(0, maxContentLength))) {
        toast.message("مقادیر حساس احتمالی پیش از ارسال ماسک شدند.");
      }
      onChange(wrapped);
    } catch {
      toast.error("خواندن فایل ممکن نشد. دوباره تلاش کنید.");
    } finally {
      event.target.value = "";
    }
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
          maxLength={MAX_CHAT_MESSAGE_CHARACTERS}
          rows={1}
          disabled={isLoading}
          className="min-h-20 max-h-44 text-start text-sm leading-6 placeholder:text-right [unicode-bidi:plaintext]"
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

function isPlainText(value: string): boolean {
  // متن‌های واقعی ممکن است tab/newline داشته باشند؛ کنترل‌کاراکترهای دیگر
  // معمولاً نشانهٔ یک فایل باینری با پسوند جعلی هستند.
  return !/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value);
}

function isValidJson(value: string): boolean {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}
