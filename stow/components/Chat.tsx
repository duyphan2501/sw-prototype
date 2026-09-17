"use client";

import { useState, useRef, useEffect } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// NOTE: Phase 01 Mock Response. This is NOT an LLM response and involves no API calls.
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
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: trimmed,
    };

    // Append user message followed by static mock assistant response
    const mockAssistantMessage: Message = {
      id: `assistant-${Date.now() + 1}`,
      role: "assistant",
      content: MOCK_ASSISTANT_RESPONSE,
    };

    setMessages((prev) => [...prev, userMessage, mockAssistantMessage]);
    setInput("");
  };

  const hasUserMessages = messages.some((m) => m.role === "user");

  return (
    <div className="flex flex-col h-full max-w-3xl w-full mx-auto bg-white sm:rounded-2xl sm:shadow-xs sm:border sm:border-slate-200/80 overflow-hidden">
      {/* Scrollable Conversation Area */}
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

      {/* Input Area */}
      <div className="p-3 sm:p-4 bg-white border-t border-slate-100">
        <form
          onSubmit={handleSubmit}
          className="flex items-center gap-2 bg-slate-50 rounded-2xl border border-slate-200/90 p-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all"
        >
          <input
            id="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 bg-transparent px-3 py-2 text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:outline-hidden"
          />
          <button
            id="chat-send-btn"
            type="submit"
            disabled={!input.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
