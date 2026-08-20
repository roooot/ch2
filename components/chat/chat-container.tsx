"use client";

import { useCallback, useMemo, useState } from "react";
import { useChat, type Message } from "@ai-sdk/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ConversationSidebar } from "@/components/sidebar/conversation-sidebar";
import { EmptyState } from "@/components/chat/empty-state";
import { MessageList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/chat-input";
import { ThemeToggle } from "@/components/theme-toggle";
import { parseAnnotations } from "@/lib/utils/annotations";
import { toast } from "sonner";
import { Rocket } from "lucide-react";
import type { DisplayMessage } from "@/components/chat/message-bubble";

/**
 * کامپوننت اصلی رابط چت - قلب تجربه کاربری Liara Copilot
 * از useChat (Vercel AI SDK) برای مدیریت استریم پاسخ استفاده می‌شود.
 */
export function ChatContainer() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [isClearingMemory, setIsClearingMemory] = useState(false);

  const { messages, input, setInput, append, isLoading, setMessages, stop } = useChat({
    api: "/api/chat",
    body: { conversationId },
    onError: () => {
      toast.error("متاسفانه ارتباط با سرور با خطا مواجه شد. دوباره تلاش کنید.");
    },
    onFinish: (message) => {
      setSidebarRefreshKey((k) => k + 1);
      const parsed = parseAnnotations(message.annotations as unknown[]);
      if (parsed.conversationId) {
        setConversationId((currentId) =>
          currentId === parsed.conversationId ? currentId : parsed.conversationId!
        );
      }
    },
  });

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isLoading) return;
      append({ role: "user", content: text }, { body: { conversationId } });
      setInput("");
    },
    [append, conversationId, isLoading, setInput]
  );

  async function loadConversation(id: string) {
    try {
      const res = await fetch(`/api/conversations/${id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const loaded: Message[] = data.messages.map(
        (m: {
          id: string;
          role: string;
          content: string;
          thinkingSteps: unknown;
          citations: unknown;
          suggestedActions: unknown;
        }) => ({
          id: m.id,
          role: m.role as Message["role"],
          content: m.content,
          annotations: [
            { type: "thinking_steps", steps: m.thinkingSteps ?? [] },
            { type: "citations", citations: m.citations ?? [] },
            { type: "suggested_actions", actions: m.suggestedActions ?? [] },
            { type: "message_id", id: m.id },
          ],
        })
      );
      setMessages(loaded);
      setConversationId(id);
    } catch {
      toast.error("بازیابی گفتگو با خطا مواجه شد.");
    }
  }

  function handleNewChat() {
    stop();
    setMessages([]);
    setConversationId(null);
  }

  async function handleClearMemory() {
    if (isClearingMemory) return;
    setIsClearingMemory(true);
    try {
      const response = await fetch("/api/memory", { method: "DELETE" });
      if (!response.ok) throw new Error();
      toast.success("حافظهٔ بین‌گفت‌وگویی پاک شد؛ پیام‌های قبلی گفتگوها حذف نشده‌اند.");
    } catch {
      toast.error("پاک‌سازی حافظه با خطا مواجه شد.");
    } finally {
      setIsClearingMemory(false);
    }
  }

  const displayMessages: DisplayMessage[] = useMemo(
    () =>
      messages.map((m, idx) => {
        const parsed = parseAnnotations(m.annotations as unknown[]);
        const isLastAssistant = idx === messages.length - 1 && m.role === "assistant";
        return {
          id: m.id,
          role: m.role as DisplayMessage["role"],
          content: m.content,
          thinkingSteps: parsed.thinkingSteps,
          citations: parsed.citations,
          suggestedActions: parsed.suggestedActions,
          dbMessageId: parsed.dbMessageId,
          isStreaming: isLastAssistant && isLoading,
        };
      }),
    [messages, isLoading]
  );

  return (
    <div className="flex h-screen w-full overflow-hidden">
      <ConversationSidebar
        activeConversationId={conversationId}
        onSelect={loadConversation}
        onNewChat={handleNewChat}
        onClearMemory={handleClearMemory}
        isClearingMemory={isClearingMemory}
        refreshKey={sidebarRefreshKey}
      />

      <div className="flex flex-1 flex-col min-w-0">
        <header className="flex items-center justify-between border-b px-4 py-2.5 md:hidden">
          <div className="flex items-center gap-2">
            <Rocket className="h-4 w-4 text-primary" />
            <span className="font-bold text-sm">Liara Copilot</span>
          </div>
          <ThemeToggle />
        </header>

        <ScrollArea className="flex-1 scrollbar-thin">
          <div className="mx-auto max-w-3xl px-4 py-4 min-h-full flex flex-col">
            {displayMessages.length === 0 ? (
              <EmptyState onSelect={sendMessage} />
            ) : (
              <MessageList messages={displayMessages} onSelectSuggestion={sendMessage} />
            )}
          </div>
        </ScrollArea>

        <div className="border-t bg-background/95 backdrop-blur px-4 py-3">
          <div className="mx-auto max-w-3xl">
            <ChatInput
              value={input}
              onChange={setInput}
              onSubmit={() => sendMessage(input)}
              isLoading={isLoading}
            />
            <p className="text-[11px] text-muted-foreground text-center mt-2">
              Liara Copilot ممکن است در پاسخ‌ها اشتباه کند؛ اطلاعات مهم را از مستندات رسمی نیز بررسی کنید.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
