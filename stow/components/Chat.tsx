"use client";

import { useState, useRef, useEffect } from "react";
import { Message } from "@/types/chat";
import { InventoryItem, PendingClarification } from "@/types/inventory";
import { INITIAL_CANONICAL_INVENTORY } from "@/lib/inventory";
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
  const [canonicalInventory, setCanonicalInventory] = useState<InventoryItem[]>(
    INITIAL_CANONICAL_INVENTORY
  );
  const [inventoryInitialized, setInventoryInitialized] =
    useState<boolean>(false);
  const [pendingClarification, setPendingClarification] =
    useState<PendingClarification | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const currentRequestIdRef = useRef<number>(0);

  // Clean up any pending request when component unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const handleCancelResponse = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setError(null);
  };

  const handleSendMessage = async (content: string) => {
    const trimmed = content.trim();
    if (!trimmed || isGenerating) return;

    // Abort any lingering request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    const requestId = ++currentRequestIdRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;

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
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: newMessages,
          currentInventory: canonicalInventory,
          inventoryInitialized,
          pendingClarification,
        }),
      });

      // Race protection: discard if superseded by a newer request or cancelled
      if (requestId !== currentRequestIdRef.current) {
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to get response from assistant");
      }

      const data = await response.json();

      // Double check race condition before updating state
      if (requestId !== currentRequestIdRef.current) {
        return;
      }

      // Update canonical inventory only upon verified completed response
      if (data.updatedInventory && Array.isArray(data.updatedInventory)) {
        setCanonicalInventory(data.updatedInventory);
      }

      if (typeof data.inventoryInitialized === "boolean") {
        setInventoryInitialized(data.inventoryInitialized);
      }

      if (data.pendingClarification !== undefined) {
        setPendingClarification(data.pendingClarification);
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role: "assistant",
        content: data.content,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: unknown) {
      // Race protection: ignore obsolete requests
      if (requestId !== currentRequestIdRef.current) {
        return;
      }

      const isAbort =
        (err instanceof Error && err.name === "AbortError") ||
        controller.signal.aborted;

      if (isAbort) {
        // User cancellation is not an application error: do not display error banner
        return;
      }

      console.error("Chat error:", err);
      setError("Sorry, something went wrong. Please try again.");
    } finally {
      if (requestId === currentRequestIdRef.current) {
        setIsGenerating(false);
        abortControllerRef.current = null;
      }
    }
  };

  return (
    <div className="flex flex-col h-full max-w-3xl w-full mx-auto bg-white sm:rounded-2xl sm:shadow-xs sm:border sm:border-slate-200/80 overflow-hidden">
      <ChatMessageList
        messages={messages}
        isGenerating={isGenerating}
        error={error}
      />
      <ChatInput
        onSendMessage={handleSendMessage}
        disabled={isGenerating}
        isGenerating={isGenerating}
        onCancel={handleCancelResponse}
      />
    </div>
  );
}
