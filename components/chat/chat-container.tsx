"use client";

import { useCallback, useMemo, useState } from "react";
import { useChat, type Message } from "@ai-sdk/react";
import { Command, Plus, Rocket } from "lucide-react";
import { toast } from "sonner";
import { ConversationSidebar } from "@/components/sidebar/conversation-sidebar";
import { ChatInput } from "@/components/chat/chat-input";
import { EmptyState } from "@/components/chat/empty-state";
import { MessageList } from "@/components/chat/message-list";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { parseAnnotations } from "@/lib/utils/annotations";
import type { DisplayMessage } from "@/components/chat/message-bubble";

/** فضای اصلی گفتگو و حافظهٔ محلی کاربر. */
export function ChatContainer() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [sidebarRefreshKey, setSidebarRefreshKey] = useState(0);
  const [isClearingMemory, setIsClearingMemory] = useState(false);

  const { messages, input, setInput, append, isLoading, setMessages, stop } = useChat({
    api: "/api/chat",
    // اولین پیام نباید conversationId: null را به اعتبارسنجی API بفرستد.
    body: conversationId ? { conversationId } : undefined,
    onError: () => toast.error("متاسفانه ارتباط با سرور با خطا مواجه شد. دوباره تلاش کنید."),
    onFinish: (message) => {
      setSidebarRefreshKey((key) => key + 1);
      const parsed = parseAnnotations(message.annotations as unknown[]);
      if (parsed.conversationId) {
        setConversationId((currentId) => currentId ?? parsed.conversationId ?? null);
      }
    },
  });

  const sendMessage = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content || isLoading) return;

      // در شروع چت، فیلد conversationId عمداً به‌طور کامل حذف می‌شود.
      const options = conversationId ? { body: { conversationId } } : undefined;
      void append({ role: "user", content }, options);
      setInput("");
    },
    [append, conversationId, isLoading, setInput]
  );

  const loadConversation = useCallback(
    async (id: string) => {
      if (id === conversationId) return;
      try {
        const response = await fetch(`/api/conversations/${id}`);
        if (!response.ok) throw new Error("Could not load conversation");
        const data = await response.json();
        const loaded: Message[] = data.messages.map(
          (message: {
            id: string;
            role: string;
            content: string;
            thinkingSteps: unknown;
            citations: unknown;
            suggestedActions: unknown;
          }) => ({
            id: message.id,
            role: message.role as Message["role"],
            content: message.content,
            annotations: [
              { type: "thinking_steps", steps: message.thinkingSteps ?? [] },
              { type: "citations", citations: message.citations ?? [] },
              { type: "suggested_actions", actions: message.suggestedActions ?? [] },
              { type: "message_id", id: message.id },
            ],
          })
        );
        setMessages(loaded);
        setConversationId(id);
      } catch {
        toast.error("بازیابی گفتگو با خطا مواجه شد.");
      }
    },
    [conversationId, setMessages]
  );

  const handleNewChat = useCallback(() => {
    stop();
    setMessages([]);
    setConversationId(null);
    setInput("");
  }, [setInput, setMessages, stop]);

  const handleClearMemory = useCallback(async () => {
    if (isClearingMemory) return;
    setIsClearingMemory(true);
    try {
      const response = await fetch("/api/memory", { method: "DELETE" });
      if (!response.ok) throw new Error("Could not clear memory");
      toast.success("حافظهٔ بین‌گفت‌وگویی پاک شد؛ پیام‌های قبلی حذف نشده‌اند.");
    } catch {
      toast.error("پاک‌سازی حافظه با خطا مواجه شد.");
    } finally {
      setIsClearingMemory(false);
    }
  }, [isClearingMemory]);

  const displayMessages: DisplayMessage[] = useMemo(
    () =>
      messages.map((message, index) => {
        const parsed = parseAnnotations(message.annotations as unknown[]);
        return {
          id: message.id,
          role: message.role as DisplayMessage["role"],
          content: message.content,
          thinkingSteps: parsed.thinkingSteps,
          citations: parsed.citations,
          suggestedActions: parsed.suggestedActions,
          dbMessageId: parsed.dbMessageId,
          isStreaming: index === messages.length - 1 && message.role === "assistant" && isLoading,
        };
      }),
    [isLoading, messages]
  );

  return (
    <SidebarProvider
      dir="rtl"
      defaultOpen
      style={
        {
          "--sidebar-width": "18rem",
          "--sidebar-width-mobile": "20rem",
        } as React.CSSProperties
      }
    >
      <ConversationSidebar
        activeConversationId={conversationId}
        isClearingMemory={isClearingMemory}
        onClearMemory={handleClearMemory}
        onNewChat={handleNewChat}
        onQuickPrompt={sendMessage}
        onSelect={loadConversation}
        refreshKey={sidebarRefreshKey}
      />

      <SidebarInset className="h-dvh min-w-0 overflow-hidden bg-background">
        <header className="flex min-h-14 shrink-0 items-center justify-between border-b border-border/80 bg-background px-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <SidebarTrigger aria-label="باز و بسته‌کردن تاریخچه" className="size-9" />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-9 md:hidden"
              onClick={handleNewChat}
              aria-label="گفتگوی جدید"
            >
              <Plus data-icon="inline-start" />
            </Button>
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground md:hidden">
                <Rocket aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-tight">Liara Copilot</p>
                <p className="hidden text-xs text-muted-foreground sm:block">همراه مستندات لیارا</p>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            <Badge variant="outline" className="hidden gap-1.5 border-border text-xs font-normal md:inline-flex">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
              سرویس آماده
            </Badge>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="hidden text-muted-foreground md:inline-flex"
              onClick={() => window.dispatchEvent(new Event("liara:open-command"))}
            >
              <Command data-icon="inline-start" />
              فرمان‌ها
              <kbd className="ms-1 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-normal">Ctrl K</kbd>
            </Button>
            <ThemeToggle />
          </div>
        </header>

        <ScrollArea className="min-h-0 flex-1">
          <main className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-3 py-5 sm:px-6 sm:py-8 lg:px-10" aria-live="polite">
            {displayMessages.length === 0 ? (
              <EmptyState onSelect={sendMessage} />
            ) : (
              <MessageList messages={displayMessages} onSelectSuggestion={sendMessage} />
            )}
          </main>
        </ScrollArea>

        <footer className="shrink-0 border-t border-border/80 bg-background px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
          <div className="mx-auto w-full max-w-5xl">
            <ChatInput
              isLoading={isLoading}
              isNewConversation={displayMessages.length === 0}
              onChange={setInput}
              onSubmit={() => sendMessage(input)}
              value={input}
            />
            <p className="mt-2 text-center text-[11px] leading-5 text-muted-foreground">
              پاسخ‌های مهم را با مستندات رسمی لیارا تطبیق دهید.
            </p>
          </div>
        </footer>
      </SidebarInset>
    </SidebarProvider>
  );
}
