"use client";

import { Children, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { ThinkingSteps } from "@/components/chat/thinking-steps";
import { CitationGrid } from "@/components/chat/citation-card";
import { SuggestedActions } from "@/components/chat/suggested-actions";
import { FeedbackButtons } from "@/components/chat/feedback-buttons";
import { cn } from "@/lib/utils";
import type { Citation, SuggestedAction, ThinkingStep } from "@/types";

// مواردی که در متن فارسی باید به‌عنوان یک واحد LTR خوانده شوند. این کار از جابه‌جایی
// نقطه، اسلش و پرانتز در URLها، مسیرها و متغیرهای محیطی جلوگیری می‌کند.
const LTR_UNIT_PATTERN =
  /(\b(?:https?|wss?):\/\/[^\s<>"'`\]\[{}،؛]+|\bwww\.[^\s<>"'`\]\[{}،؛]+|\b(?:[a-z0-9-]+\.)+(?:com|ir|io|dev|app|net|org|cloud|run)(?::\d+)?(?:\/[\w@.+~%:=/-]*)?|(?:^|\s)(?:~?\/[\w@.+~%:=/-]+)|\b(?:npm|pnpm|yarn|npx|node|git|docker|liara|curl)(?:\s+(?:--?[\w-]+|[\w@./:=~-]+)){1,4}|\b[A-Z][A-Z0-9_]{2,}\b)/giu;

function BidiText({ children }: { children: string }) {
  const parts = children.split(LTR_UNIT_PATTERN);

  return (
    <>
      {parts.map((part, index) =>
        index % 2 === 1 ? <IsolatedLtrUnit key={`${part}-${index}`} value={part} /> : part
      )}
    </>
  );
}

function IsolatedLtrUnit({ value }: { value: string }) {
  const leadingWhitespace = value.match(/^\s+/)?.[0] ?? "";
  const unit = value.slice(leadingWhitespace.length);

  return (
    <>
      {leadingWhitespace}
      <bdi dir="ltr" className="bidi-ltr-unit">
        {unit}
      </bdi>
    </>
  );
}

function BidiChildren({ children }: { children: ReactNode }) {
  return (
    <>
      {Children.map(children, (child) => (typeof child === "string" ? <BidiText>{child}</BidiText> : child))}
    </>
  );
}

const markdownComponents: Components = {
  p: ({ node, children, className, ...props }) => {
    void node;
    return (
      <p {...props} dir="rtl" className={cn("bidi-prose-line", className)}>
        <BidiChildren>{children}</BidiChildren>
      </p>
    );
  },
  li: ({ node, children, className, ...props }) => {
    void node;
    return (
      <li {...props} dir="rtl" className={cn("bidi-prose-line", className)}>
        <BidiChildren>{children}</BidiChildren>
      </li>
    );
  },
  blockquote: ({ node, children, className, ...props }) => {
    void node;
    return (
      <blockquote {...props} dir="rtl" className={cn("bidi-prose-line", className)}>
        <BidiChildren>{children}</BidiChildren>
      </blockquote>
    );
  },
  a: ({ node, children, className, ...props }) => {
    void node;
    return (
      <a {...props} dir="ltr" className={cn("bidi-ltr-unit", className)}>
        {children}
      </a>
    );
  },
  code: ({ node, children, className, ...props }) => {
    void node;
    return (
      <code {...props} dir="ltr" className={cn("bidi-ltr-unit", className)}>
        {children}
      </code>
    );
  },
  pre: ({ node, children, className, ...props }) => {
    void node;
    return (
      <pre {...props} dir="ltr" className={className}>
        {children}
      </pre>
    );
  },
  td: ({ node, children, className, ...props }) => {
    void node;
    return (
      <td {...props} dir="rtl" className={cn("bidi-prose-line", className)}>
        <BidiChildren>{children}</BidiChildren>
      </td>
    );
  },
  th: ({ node, children, className, ...props }) => {
    void node;
    return (
      <th {...props} dir="rtl" className={cn("bidi-prose-line", className)}>
        <BidiChildren>{children}</BidiChildren>
      </th>
    );
  },
};

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinkingSteps?: ThinkingStep[];
  citations?: Citation[];
  suggestedActions?: SuggestedAction[];
  dbMessageId?: string;
  isStreaming?: boolean;
}

export function MessageBubble({
  message,
  onSelectSuggestion,
}: {
  message: DisplayMessage;
  onSelectSuggestion: (prompt: string) => void;
}) {
  const isUser = message.role === "user";

  return (
    <article className={cn("flex items-start gap-3 py-5", isUser ? "flex-row-reverse" : "flex-row")}>
      <Avatar className={cn("size-8 shrink-0", isUser ? "bg-primary" : "bg-secondary")}>
        <AvatarFallback className={cn(isUser ? "bg-primary text-primary-foreground" : "bg-secondary")}>
          {isUser ? <User /> : <Bot />}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex-1 min-w-0", isUser && "flex flex-col items-end")}>
        <p className={cn("mb-1 text-xs font-medium text-muted-foreground", isUser && "text-end")}>
          {isUser ? "شما" : "Liara Copilot"}
        </p>
        <div
          className={cn(
            "max-w-[97%] px-4 py-3 text-sm leading-7 sm:max-w-[88%]",
            isUser
              ? "rounded-md bg-primary text-primary-foreground"
              : "border-s-2 border-primary/60 bg-card text-card-foreground shadow-sm"
          )}
        >
          {!isUser && <ThinkingSteps steps={message.thinkingSteps ?? []} />}

          {message.content ? (
            <div className="prose-chat" dir="rtl">
              <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
                {message.content}
              </ReactMarkdown>
            </div>
          ) : message.isStreaming ? (
            <div className="flex items-center gap-2 py-1 text-muted-foreground">
              <Spinner aria-label="در حال آماده‌سازی پاسخ" />
              <span>در حال آماده‌سازی پاسخ…</span>
            </div>
          ) : null}
        </div>

        {!isUser && (message.citations?.length ?? 0) > 0 && (
          <div className="w-full max-w-[95%] sm:max-w-[85%]">
            <CitationGrid citations={message.citations ?? []} />
          </div>
        )}

        {!isUser && (message.suggestedActions?.length ?? 0) > 0 && (
          <div className="w-full max-w-[95%] sm:max-w-[85%]">
            <SuggestedActions actions={message.suggestedActions ?? []} onSelect={onSelectSuggestion} />
          </div>
        )}

        {!isUser && !message.isStreaming && message.content && (
          <FeedbackButtons messageId={message.dbMessageId} />
        )}
      </div>
    </article>
  );
}
