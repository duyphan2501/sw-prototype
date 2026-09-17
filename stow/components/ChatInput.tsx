"use client";

import { useState, useRef, useEffect } from "react";

interface ChatInputProps {
  onSendMessage: (content: string) => void;
  disabled?: boolean;
  isGenerating?: boolean;
  onCancel?: () => void;
}

export default function ChatInput({
  onSendMessage,
  disabled = false,
  isGenerating = false,
  onCancel,
}: ChatInputProps) {
  const [input, setInput] = useState("");
  // 1. Tạo một ref để tham chiếu tới thẻ textarea
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 2. Theo dõi biến input để tự động thay đổi chiều cao
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      // Đặt lại về auto để tính toán chuẩn khi xóa chữ hoặc khi input bị reset về ""
      textarea.style.height = "auto";
      // Đặt chiều cao mới dựa trên nội dung, giới hạn tối đa tùy ý (ví dụ: tối đa 200px)
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || disabled || isGenerating) return;

    onSendMessage(trimmed);
    setInput(""); // Khung sẽ tự động co nhỏ lại về ban đầu nhờ useEffect ở trên
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const isInputDisabled = disabled || isGenerating;

  return (
    <div className="p-3 sm:p-4 bg-white border-t border-slate-100">
      <form
        onSubmit={handleSubmit}
        className="flex items-end gap-2 bg-slate-50 rounded-2xl border border-slate-200/90 p-1.5 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all"
      >
        <textarea
          ref={textareaRef}
          id="chat-input"
          rows={1} // Đặt số dòng ban đầu là 1
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type your message..."
          disabled={isInputDisabled}
          // Thay đổi các class Tailwind quan trọng dưới đây
          className="flex-1 bg-transparent px-3 py-2 resize-none overflow-y-auto text-sm sm:text-base text-slate-800 placeholder-slate-400 focus:outline-hidden disabled:opacity-50 max-h-[200px]"
        />
        {isGenerating ? (
          <button
            id="chat-cancel-btn"
            type="button"
            onClick={onCancel}
            className="mb-0.5 px-4 py-2 bg-slate-200 hover:bg-rose-100 hover:text-rose-700 active:bg-rose-200 text-slate-700 text-sm font-medium rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Cancel
          </button>
        ) : (
          <button
            id="chat-send-btn"
            type="submit"
            disabled={isInputDisabled || !input.trim()}
            className="mb-0.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Send
          </button>
        )}
      </form>
    </div>
  );
}
