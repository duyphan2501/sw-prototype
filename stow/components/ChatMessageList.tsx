"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/types/chat";

interface ChatMessageListProps {
  messages: Message[];
}

export default function ChatMessageList({ messages }: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasUserMessages = messages.some((m) => m.role === "user");

  return (
    <div
      id="chat-messages"
      className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4"
    >
      {/* Empty-state hint if no user message has been sent yet */}
      {!hasUserMessages && (
        <div className="p-3 mb-2 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-500">
          Storage assistant ready. Type your storage items below to start.
        </div>
      )}

      {messages.map((message) => {
        const isUser = message.role === "user";
        return (
          <div
            key={message.id}
            className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
          >
            <div className="text-xs font-medium text-slate-400 mb-1 px-1">
              {isUser ? "You" : "Assistant"}
            </div>
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-4 py-3 text-sm sm:text-base leading-relaxed break-words whitespace-pre-wrap ${
                isUser
                  ? "bg-blue-600 text-white rounded-tr-xs shadow-xs"
                  : "bg-slate-100 text-slate-800 rounded-tl-xs border border-slate-200/60"
              }`}
            >
              {message.content}
            </div>
          </div>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
}
