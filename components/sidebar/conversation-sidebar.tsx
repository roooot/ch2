"use client";

import { useEffect, useState } from "react";
import { MessageSquarePlus, MessageSquare, Trash2, Rocket, Brain } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import type { ConversationSummary } from "@/types";

/**
 * سایدبار تاریخچه گفتگوها
 */
export function ConversationSidebar({
  activeConversationId,
  onSelect,
  onNewChat,
  onClearMemory,
  isClearingMemory,
  refreshKey,
}: {
  activeConversationId: string | null;
  onSelect: (id: string) => void;
  onNewChat: () => void;
  onClearMemory: () => void;
  isClearingMemory: boolean;
  refreshKey: number;
}) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/conversations")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setConversations(data.conversations ?? []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setConversations((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/conversations?id=${id}`, { method: "DELETE" }).catch(() => {});
    if (activeConversationId === id) onNewChat();
  }

  return (
    <aside className="hidden md:flex w-64 flex-col border-l bg-muted/30 h-full">
      <div className="p-3 flex items-center gap-2 border-b">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Rocket className="h-4 w-4 text-primary" />
        </div>
        <span className="font-bold text-sm">Liara Copilot</span>
      </div>

      <div className="p-3">
        <Button onClick={onNewChat} className="w-full justify-start gap-2" variant="secondary">
          <MessageSquarePlus className="h-4 w-4" />
          گفتگوی جدید
        </Button>
      </div>

      <Separator />

      <ScrollArea className="flex-1 scrollbar-thin">
        <div className="p-2 space-y-1">
          {loading && <p className="text-xs text-muted-foreground p-3">در حال بارگذاری...</p>}
          {!loading && conversations.length === 0 && (
            <p className="text-xs text-muted-foreground p-3">هنوز گفتگویی ثبت نشده است.</p>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={cn(
                "group w-full flex items-center gap-2 rounded-lg px-3 py-2 text-right text-sm transition-colors hover:bg-accent",
                activeConversationId === conv.id && "bg-accent"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="flex-1 truncate">{conv.title || "گفتگوی بدون عنوان"}</span>
              <span
                onClick={(e) => handleDelete(conv.id, e)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
            </button>
          ))}
        </div>
      </ScrollArea>

      <Separator />
      <div className="p-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-start gap-2 text-xs"
          onClick={onClearMemory}
          disabled={isClearingMemory}
        >
          <Brain className="h-3.5 w-3.5" />
          {isClearingMemory ? "در حال پاک‌سازی حافظه..." : "پاک‌کردن حافظهٔ بین‌گفت‌وگویی"}
        </Button>
      </div>
      <div className="p-3 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">تم ظاهری</span>
        <ThemeToggle />
      </div>
    </aside>
  );
}
