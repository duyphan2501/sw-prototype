import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { POST } from "../app/api/chat/route";
import { callLLM } from "../lib/llm";
import { Message } from "../types/chat";

describe("Chat API & LLM Integration", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  describe("Validation", () => {
    it("returns 400 when request body has no messages", async () => {
      const req = new Request("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.error).toContain("messages array is required");
    });

    it("returns 400 when messages array is empty", async () => {
      const req = new Request("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      });

      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("API Key requirement", () => {
    it("returns 500 if no API key is configured in environment", async () => {
      delete process.env.GEMINI_API_KEY;
      delete process.env.OPENAI_API_KEY;

      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello" },
      ];

      const req = new Request("http://localhost:3000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      const res = await POST(req);
      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error).toContain("LLM API key not configured");
    });
  });

  describe("callLLM with Gemini", () => {
    it("successfully calls Gemini endpoint and returns content", async () => {
      process.env.GEMINI_API_KEY = "test-gemini-key";

      const mockResponse = {
        candidates: [
          {
            content: {
              parts: [{ text: "Hello! How can I assist with your storage?" }],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello" },
      ];

      const result = await callLLM(messages);
      expect(result).toBe("Hello! How can I assist with your storage?");
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("generativelanguage.googleapis.com"),
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });

  describe("callLLM with OpenAI", () => {
    it("successfully calls OpenAI endpoint when OPENAI_API_KEY is configured", async () => {
      delete process.env.GEMINI_API_KEY;
      process.env.OPENAI_API_KEY = "test-openai-key";

      const mockResponse = {
        choices: [
          {
            message: {
              content: "I can help you store your sofa.",
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as unknown as Response);

      const messages: Message[] = [
        { id: "1", role: "user", content: "I have a sofa" },
      ];

      const result = await callLLM(messages);
      expect(result).toBe("I can help you store your sofa.");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/chat/completions",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer test-openai-key",
          }),
        })
      );
    });
  });

  describe("Cancellation & AbortSignal", () => {
    it("passes AbortSignal to underlying fetch", async () => {
      process.env.GEMINI_API_KEY = "test-gemini-key";

      const controller = new AbortController();

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "response" }] } }],
        }),
      } as unknown as Response);

      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello" },
      ];

      await callLLM(messages, controller.signal);

      expect(global.fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          signal: controller.signal,
        })
      );
    });

    it("handles aborted request in route handler cleanly without 500", async () => {
      process.env.GEMINI_API_KEY = "test-gemini-key";

      const controller = new AbortController();
      controller.abort();

      const messages: Message[] = [
        { id: "1", role: "user", content: "Hello" },
      ];

      const req = new Request("http://localhost:3000/api/chat", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages }),
      });

      const res = await POST(req);
      expect(res.status).toBe(499);
    });
  });
});
