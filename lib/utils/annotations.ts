import type { Citation, IntentType, SuggestedAction, ThinkingStep } from "@/types";

/**
 * پارس کردن Message Annotations ارسال‌شده از سرور (Vercel AI SDK Data Stream)
 * سرور طی استریم، annotation های JSON را به پیام دستیار اضافه می‌کند
 * (نوع‌های: thinking_steps, intent, citations, suggested_actions, message_id, conversation_id)
 */

export interface ParsedAnnotations {
  thinkingSteps: ThinkingStep[];
  intent?: IntentType;
  citations: Citation[];
  suggestedActions: SuggestedAction[];
  dbMessageId?: string;
  conversationId?: string;
}

export function parseAnnotations(annotations: unknown[] | undefined): ParsedAnnotations {
  const result: ParsedAnnotations = {
    thinkingSteps: [],
    citations: [],
    suggestedActions: [],
  };

  if (!annotations) return result;

  for (const raw of annotations) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, unknown>;

    switch (item.type) {
      case "thinking_steps":
        if (Array.isArray(item.steps)) {
          result.thinkingSteps = item.steps as ThinkingStep[];
        }
        break;
      case "intent":
        result.intent = item.intent as IntentType;
        break;
      case "citations":
        if (Array.isArray(item.citations)) {
          result.citations = item.citations as Citation[];
        }
        break;
      case "suggested_actions":
        if (Array.isArray(item.actions)) {
          result.suggestedActions = item.actions as SuggestedAction[];
        }
        break;
      case "message_id":
        result.dbMessageId = item.id as string;
        break;
      case "conversation_id":
        result.conversationId = item.id as string;
        break;
    }
  }

  return result;
}
