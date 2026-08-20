"use client";

import ReactMarkdown from "react-markdown";
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
        <p className={cn("mb-1 text-xs font-medium text-muted-foreground", isUser && "text-left")}>
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
            <div className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
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
