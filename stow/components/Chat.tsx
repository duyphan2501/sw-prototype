"use client";

import { useState } from "react";
import { Message } from "@/types/chat";
import ChatMessageList from "@/components/ChatMessageList";
import ChatInput from "@/components/ChatInput";

export type { Message };

const INITIAL_MESSAGES: Message[] = [
  {
    id: "msg-welcome",
    role: "assistant",
    content: "Hi! How can I help you with storage?",
  },
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isGenerating) return;

    const userMessage: Message = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "user",
      content: trimmed,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response from assistant");
      }

      const data = await response.json();
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: "assistant",
        content: data.content,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      console.error("Chat error:", err);
      setError("Sorry, something went wrong. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl w-full mx-auto bg-white sm:rounded-2xl sm:shadow-xs sm:border sm:border-slate-200/80 overflow-hidden">
      <ChatMessageList
        messages={messages}
        isGenerating={isGenerating}
        error={error}
      />
      <ChatInput onSendMessage={handleSendMessage} disabled={isGenerating} />
    </div>
  );
}
