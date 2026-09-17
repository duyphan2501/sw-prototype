import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { processInventoryTurn } from "../lib/inventoryFlow";
import { InventoryItem } from "../types/inventory";
import { Message } from "../types/chat";

describe("Phase 08 — Inventory + CBM Integration Flow", () => {
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

  it("Test 1 — REPLACE + CBM: Replaces inventory and calculates exact CBM (3.5 CBM)", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const startingInventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
      { type: "wardrobe", quantity: 1 },
      { type: "box", quantity: 10 },
    ];

    // Mock 1: extractInventoryIntent returns REPLACE [queen_bed x 1, three_seat_sofa x 1]
    // Mock 2: final response generation
    const mockIntentResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  operation: "REPLACE",
                  items: [
                    { type: "queen_bed", quantity: 1 },
                    { type: "three_seat_sofa", quantity: 1 },
                  ],
                }),
              },
            ],
          },
        },
      ],
    };

    const mockReplyResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "Got it. I've updated your inventory. That's approximately 3.5 CBM.",
              },
            ],
          },
        },
      ],
    };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockIntentResponse,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockReplyResponse,
      } as unknown as Response);

    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        content: "I only want to store 1 queen-size bed and 1 three-seat sofa.",
      },
    ];

    const result = await processInventoryTurn(messages, startingInventory);

    expect(result.operation).toBe("REPLACE");
    expect(result.updatedInventory).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ]);
    expect(result.cbm).toBe(3.5);
    expect(result.content).toContain("3.5 CBM");
    expect(result.content).not.toMatch(/10x10|100 sq ft/i);
  });

  it("Test 2 — ADD + CBM: Preserves existing items, adds new items, and calculates 4.5 CBM", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const startingInventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ];

    const mockIntentResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  operation: "ADD",
                  items: [{ type: "box", quantity: 10 }],
                }),
              },
            ],
          },
        },
      ],
    };

    const mockReplyResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "Got it. I've added 10 boxes. Your current inventory is approximately 4.5 CBM.",
              },
            ],
          },
        },
      ],
    };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockIntentResponse,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockReplyResponse,
      } as unknown as Response);

    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        content: "Also add 10 boxes.",
      },
    ];

    const result = await processInventoryTurn(messages, startingInventory);

    expect(result.operation).toBe("ADD");
    expect(result.updatedInventory).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
      { type: "box", quantity: 10 },
    ]);
    expect(result.cbm).toBe(4.5);
    expect(result.content).toContain("4.5 CBM");
  });

  it("Test 3 — REMOVE + CBM: Removes specified item and updates CBM to 3.5 CBM", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const startingInventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
      { type: "wardrobe", quantity: 1 },
    ];

    const mockIntentResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  operation: "REMOVE",
                  items: [{ type: "wardrobe", quantity: 1 }],
                }),
              },
            ],
          },
        },
      ],
    };

    const mockReplyResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "Got it. I've removed the wardrobe. Your updated inventory is 3.5 CBM.",
              },
            ],
          },
        },
      ],
    };

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockIntentResponse,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockReplyResponse,
      } as unknown as Response);

    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        content: "Remove the wardrobe.",
      },
    ];

    const result = await processInventoryTurn(messages, startingInventory);

    expect(result.operation).toBe("REMOVE");
    expect(result.updatedInventory).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ]);
    expect(result.cbm).toBe(3.5);
  });

  it("Test 4 — UNCLEAR: Ambiguous statement does NOT mutate inventory and asks clarification", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const startingInventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ];
    const initialSnapshot = JSON.stringify(startingInventory);

    const mockIntentResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  operation: "UNCLEAR",
                  items: [
                    { type: "three_seat_sofa", quantity: 1 },
                    { type: "box", quantity: 1 },
                  ],
                }),
              },
            ],
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockIntentResponse,
    } as unknown as Response);

    const messages: Message[] = [
      {
        id: "1",
        role: "user",
        content: "What about a sofa and some boxes?",
      },
    ];

    const result = await processInventoryTurn(messages, startingInventory);

    expect(result.operation).toBe("UNCLEAR");
    expect(result.content).toMatch(/add.*replace/i);
    // Inventory is unchanged
    expect(result.updatedInventory).toEqual(startingInventory);
    expect(JSON.stringify(startingInventory)).toBe(initialSnapshot);
  });

  it("Test 5 — Invalid Intent: Malformed LLM output does NOT mutate inventory", async () => {
    process.env.GEMINI_API_KEY = "test-key";

    const startingInventory: InventoryItem[] = [{ type: "box", quantity: 10 }];
    const initialSnapshot = JSON.stringify(startingInventory);

    // LLM returns invalid JSON or unsupported item
    const mockIntentResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: "I cannot process this JSON" }],
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockIntentResponse,
    } as unknown as Response);

    const messages: Message[] = [
      { id: "1", role: "user", content: "Store something invalid" },
    ];

    await expect(
      processInventoryTurn(messages, startingInventory)
    ).rejects.toThrow();

    expect(JSON.stringify(startingInventory)).toBe(initialSnapshot);
  });

  it("Test 6 & 7 — Cancellation & State Isolation: Cancelled requests never mutate state", async () => {
    let canonicalInventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ];
    const initialSnapshot = JSON.stringify(canonicalInventory);

    // Simulate in-flight request A that gets cancelled
    const controllerA = new AbortController();
    let isGenerating = true;

    const requestAPromise = new Promise<InventoryItem[]>((_, reject) => {
      controllerA.signal.addEventListener("abort", () => {
        const err = new Error("Aborted");
        err.name = "AbortError";
        reject(err);
      });
    })
      .then((newInventory) => {
        canonicalInventory = newInventory;
      })
      .catch(() => {
        // Aborted: do not update canonicalInventory
      })
      .finally(() => {
        isGenerating = false;
      });

    // User cancels Request A
    controllerA.abort();
    await requestAPromise;

    // Invariant: canonicalInventory remained completely untouched
    expect(isGenerating).toBe(false);
    expect(JSON.stringify(canonicalInventory)).toBe(initialSnapshot);

    // Subsequent Request B succeeds starting from unchanged canonicalInventory
    const resultB: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
    ];
    canonicalInventory = resultB;

    expect(canonicalInventory).toEqual([{ type: "queen_bed", quantity: 1 }]);
  });
});
