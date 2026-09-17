"use client";

import { useState } from "react";
import { Message } from "@/types/chat";
import ChatMessageList from "@/components/ChatMessageList";
import ChatInput from "@/components/ChatInput";

export type { Message };

// NOTE: Phase 02 Mock Response. This is NOT an LLM response and involves no API calls.
const MOCK_ASSISTANT_RESPONSE =
  "Thanks! I can help you estimate your storage needs.";

const INITIAL_MESSAGES: Message[] = [
  {
    id: "msg-welcome",
    role: "assistant",
    content: "Hi! How can I help you with storage?",
  },
];

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES);
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isSending) return;

    setIsSending(true);

    const userMessage: Message = {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "user",
      content: trimmed,
    };

    const mockAssistantMessage: Message = {
      id: `assistant-${Date.now() + 1}-${Math.random().toString(36).slice(2, 7)}`,
      role: "assistant",
      content: MOCK_ASSISTANT_RESPONSE,
    };

    setMessages((prev) => [...prev, userMessage, mockAssistantMessage]);
    setIsSending(false);
  };

  return (
    <div className="flex flex-col h-full max-w-3xl w-full mx-auto bg-white sm:rounded-2xl sm:shadow-xs sm:border sm:border-slate-200/80 overflow-hidden">
      <ChatMessageList messages={messages} />
      <ChatInput onSendMessage={handleSendMessage} disabled={isSending} />
    </div>
  );
}
