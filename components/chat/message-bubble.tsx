"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
    <div className={cn("flex gap-3 py-3", isUser ? "flex-row-reverse" : "flex-row")}>
      <Avatar className={cn("shrink-0", isUser ? "bg-primary" : "bg-secondary")}>
        <AvatarFallback className={cn(isUser ? "bg-primary text-primary-foreground" : "bg-secondary")}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={cn("flex-1 min-w-0", isUser && "flex flex-col items-end")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 max-w-[95%] sm:max-w-[85%]",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted"
          )}
        >
          {!isUser && <ThinkingSteps steps={message.thinkingSteps ?? []} />}

          {message.content ? (
            <div className="prose-chat">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
            </div>
          ) : message.isStreaming ? (
            <div className="flex gap-1 py-1">
              <span className="h-2 w-2 rounded-full bg-current animate-pulse-dot" />
              <span className="h-2 w-2 rounded-full bg-current animate-pulse-dot [animation-delay:0.2s]" />
              <span className="h-2 w-2 rounded-full bg-current animate-pulse-dot [animation-delay:0.4s]" />
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
    </div>
  );
}
