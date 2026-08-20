import { prisma } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";
import { createInitialAgentState } from "@/types";
import type { AgentState } from "@/types";

/**
 * مدیریت State Machine ایجنت
 * وضعیت هر گفتگو (فاز فعلی، حافظه موضوعی، وضعیت troubleshoot/tour) در ستون
 * agentState (JSON) روی مدل Conversation در دیتابیس ذخیره می‌شود
 * تا Context بین پیام‌های مختلف یک گفتگو حفظ شود.
 */

export async function loadAgentState(conversationId: string): Promise<AgentState> {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { agentState: true },
  });

  if (!conversation?.agentState) return createInitialAgentState();

  try {
    return conversation.agentState as unknown as AgentState;
  } catch {
    return createInitialAgentState();
  }
}

export async function saveAgentState(conversationId: string, state: AgentState): Promise<void> {
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { agentState: state as unknown as Prisma.InputJsonValue },
  });
}

/** افزودن موضوع جدید به حافظه موضوعی گفتگو (برای حفظ Context) با محدودیت طول */
export function pushTopicMemory(state: AgentState, topic: string): AgentState {
  const memory = [...state.topicMemory.filter((t) => t !== topic), topic].slice(-8);
  return { ...state, topicMemory: memory };
}
