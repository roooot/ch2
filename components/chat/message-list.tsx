"use client";

import { useEffect, useRef } from "react";
import { MessageBubble, type DisplayMessage } from "@/components/chat/message-bubble";

export function MessageList({
  messages,
  onSelectSuggestion,
}: {
  messages: DisplayMessage[];
  onSelectSuggestion: (prompt: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="flex flex-col divide-y divide-border/50">
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} onSelectSuggestion={onSelectSuggestion} />
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
