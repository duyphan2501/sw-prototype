"use client";

import { useEffect, useRef } from "react";
import { Message } from "@/types/chat";

interface ChatMessageListProps {
  messages: Message[];
  isGenerating?: boolean;
  error?: string | null;
}

export default function ChatMessageList({
  messages,
  isGenerating = false,
  error = null,
}: ChatMessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages, thinking state, or errors change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating, error]);

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

      {/* AI is thinking... state */}
      {isGenerating && (
        <div
          id="ai-thinking-state"
          className="flex flex-col items-start animate-fade-in"
        >
          <div className="text-xs font-medium text-slate-400 mb-1 px-1">
            Assistant
          </div>
          <div className="max-w-[85%] sm:max-w-[75%] rounded-2xl rounded-tl-xs px-4 py-3 text-sm sm:text-base bg-slate-100 text-slate-500 border border-slate-200/60 italic flex items-center gap-2">
            <span>AI is thinking...</span>
            <span className="inline-flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse delay-150" />
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse delay-300" />
            </span>
          </div>
        </div>
      )}

      {/* User-facing error message */}
      {error && (
        <div
          id="chat-error-message"
          className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm text-center"
        >
          {error}
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}
