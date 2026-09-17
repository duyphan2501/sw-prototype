"use client";

import { useState } from "react";

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
}

export default function ChatInput({
  onSendMessage,
  disabled = false,
}: ChatInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled) return;

    onSendMessage(trimmed);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="p-3 sm:p-4 bg-white border-t border-slate-100">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 bg-slate-50 rounded-2xl border border-slate-200/90 p-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all"
      >
        <textarea
          id="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={disabled}
          style={{ resize: "none" }}
          className="flex-1 bg-transparent px-3 py-2 h-full overflow-hidden text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:outline-hidden disabled:opacity-50"
        />
        <button
          id="chat-send-btn"
          type="submit"
          disabled={disabled || !input.trim()}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors cursor-pointer"
        >
          Send
        </button>
      </form>
    </div>
  );
}
