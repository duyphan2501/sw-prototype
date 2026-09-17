import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { processInventoryTurn } from "../lib/inventoryFlow";
import { InventoryItem, PendingClarification } from "../types/inventory";
import { Message } from "../types/chat";
import { calculateCbm } from "../lib/calculator";
import { recommendStorageUnit } from "../lib/storageRecommendation";

describe("Phase 10 — End-to-End State & Cancellation Validation", () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv, GEMINI_API_KEY: "test-gemini-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // 1. Cancel before intent commit
  it("Case 1 — Cancel before intent commit: Aborting during intent extraction leaves canonical inventory unchanged", async () => {
    const canonicalInventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ];
    const snapshot = JSON.stringify(canonicalInventory);

    const controller = new AbortController();
    // Simulate intent extraction hanging / aborted
    global.fetch = vi.fn().mockImplementation((_url, options) => {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const messages: Message[] = [
      { id: "1", role: "user", content: "I need to store 10 boxes." },
    ];

    const turnPromise = processInventoryTurn(
      messages,
      canonicalInventory,
      controller.signal,
      true
    );

    // Cancel while request is running
    controller.abort();

    await expect(turnPromise).rejects.toThrow("Aborted");

    // Existing canonical inventory must remain unchanged
    expect(JSON.stringify(canonicalInventory)).toBe(snapshot);
    expect(canonicalInventory).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ]);
  });

  // 2. Cancel after inventory commit
  it("Case 2 — Cancel after inventory commit: Aborting final response does not roll back committed inventory", async () => {
    const canonicalInventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
    ];

    const controller = new AbortController();

    // Intent extraction succeeds with ADD 10 boxes
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

    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockIntentResponse,
      } as unknown as Response)
      // Step 6 response generation rejects due to abort
      .mockImplementationOnce((_url, options) => {
        return new Promise((_resolve, reject) => {
          options?.signal?.addEventListener("abort", () => {
            const err = new Error("Aborted");
            err.name = "AbortError";
            reject(err);
          });
          controller.abort();
        });
      });

    const messages: Message[] = [
      { id: "1", role: "user", content: "Add 10 boxes." },
    ];

    const result = await processInventoryTurn(
      messages,
      canonicalInventory,
      controller.signal,
      true
    );

    // Cancel response != rollback business state
    expect(result.operation).toBe("ADD");
    expect(result.updatedInventory).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "box", quantity: 10 },
    ]);
    // Queen bed (1.5) + 10 boxes (1.0) = 2.5 CBM
    expect(result.cbm).toBe(2.5);
    expect(result.storageRecommendation).toEqual({
      id: "small",
      label: "Small storage unit",
      capacityCbm: 3,
    });
    // Fallback response used
    expect(result.content).toContain("2.5 CBM");
  });

  // 3. New request after cancellation
  it("Case 3 — New request after cancellation: Temporary cancelled state never influences subsequent request", async () => {
    let canonicalInventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ];

    // Request 1: "Add 10 boxes" -> Cancelled
    const controller1 = new AbortController();
    global.fetch = vi.fn().mockImplementationOnce((_url, options) => {
      return new Promise((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => {
          const err = new Error("Aborted");
          err.name = "AbortError";
          reject(err);
        });
      });
    });

    const req1Promise = processInventoryTurn(
      [{ id: "1", role: "user", content: "Add 10 boxes." }],
      canonicalInventory,
      controller1.signal,
      true
    ).catch(() => {
      // Intentionally aborted
    });

    controller1.abort();
    await req1Promise;

    // Invariant: canonicalInventory has not been contaminated with 10 boxes
    expect(canonicalInventory).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ]);

    // Request 2: "Replace my inventory with 1 wardrobe."
    const mockIntentResponse2 = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  operation: "REPLACE",
                  items: [{ type: "wardrobe", quantity: 1 }],
                }),
              },
            ],
          },
        },
      ],
    };

    const mockReplyResponse2 = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "Got it! Your inventory is now 1 wardrobe (1.2 CBM).",
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
        json: async () => mockIntentResponse2,
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockReplyResponse2,
      } as unknown as Response);

    const result2 = await processInventoryTurn(
      [{ id: "2", role: "user", content: "Replace my inventory with 1 wardrobe." }],
      canonicalInventory,
      undefined,
      true
    );

    canonicalInventory = result2.updatedInventory;

    // Expected: strictly [wardrobe x 1], no boxes or remnants from cancelled request
    expect(canonicalInventory).toEqual([{ type: "wardrobe", quantity: 1 }]);
    expect(result2.cbm).toBe(1.2);
  });

  // 4. Multi-turn Clarification → ADD
  it("Case 4 — Clarification → ADD: Answering 'add' commits items with ADD without calling intent LLM", async () => {
    const canonicalInventory: InventoryItem[] = [
      { type: "wardrobe", quantity: 1 },
    ];

    const pendingClarification: PendingClarification = {
      items: [
        { type: "queen_bed", quantity: 1 },
        { type: "three_seat_sofa", quantity: 1 },
      ],
    };

    const mockReplyResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "Added 1 queen-size bed and 1 three-seat sofa to your wardrobe. That is 4.7 CBM.",
              },
            ],
          },
        },
      ],
    };

    const fetchSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockReplyResponse,
    } as unknown as Response);
    global.fetch = fetchSpy;

    const messages: Message[] = [
      { id: "1", role: "user", content: "add" },
    ];

    const result = await processInventoryTurn(
      messages,
      canonicalInventory,
      undefined,
      true,
      pendingClarification
    );

    // LLM intent extractor must NOT be called for standalone 'add'
    // Only the final response LLM is called (fetchSpy called once)
    expect(fetchSpy).toHaveBeenCalledTimes(1);

    expect(result.operation).toBe("ADD");
    expect(result.updatedInventory).toEqual([
      { type: "wardrobe", quantity: 1 },
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ]);
    // Wardrobe (1.2) + Queen bed (1.5) + 3-seat sofa (2.0) = 4.7 CBM
    expect(result.cbm).toBe(4.7);
    expect(result.storageRecommendation).toEqual({
      id: "medium",
      label: "Medium storage unit",
      capacityCbm: 5,
    });
    expect(result.pendingClarification).toBeNull();
  });

  // 5. Multi-turn Clarification → REPLACE
  it("Case 5 — Clarification → REPLACE: Answering 'replace' replaces existing inventory", async () => {
    const canonicalInventory: InventoryItem[] = [
      { type: "wardrobe", quantity: 1 },
      { type: "box", quantity: 10 },
    ];

    const pendingClarification: PendingClarification = {
      items: [
        { type: "queen_bed", quantity: 1 },
        { type: "three_seat_sofa", quantity: 1 },
      ],
    };

    const mockReplyResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "Replaced your inventory. You now have 1 queen-size bed and 1 three-seat sofa (3.5 CBM).",
              },
            ],
          },
        },
      ],
    };

    const fetchSpy = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockReplyResponse,
    } as unknown as Response);
    global.fetch = fetchSpy;

    const messages: Message[] = [
      { id: "1", role: "user", content: "please replace" },
    ];

    const result = await processInventoryTurn(
      messages,
      canonicalInventory,
      undefined,
      true,
      pendingClarification
    );

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(result.operation).toBe("REPLACE");
    // Previous inventory (wardrobe, boxes) must not remain
    expect(result.updatedInventory).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ]);
    expect(result.cbm).toBe(3.5);
    expect(result.pendingClarification).toBeNull();
  });

  // 6. First inventory initialization
  it("Case 6 — First inventory initialization: inventoryInitialized = false treats UNCLEAR as REPLACE without asking", async () => {
    // Starting with default prototype inventory seed items
    const canonicalInventory: InventoryItem[] = [
      { type: "dining_table_4_chairs", quantity: 1 },
    ];

    const mockIntentResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  operation: "UNCLEAR",
                  items: [
                    { type: "queen_bed", quantity: 1 },
                    { type: "three_seat_sofa", quantity: 1 },
                    { type: "dining_table_4_chairs", quantity: 1 },
                    { type: "wardrobe", quantity: 1 },
                    { type: "box", quantity: 10 },
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
                text: "Your storage inventory has been initialized with 7.7 CBM.",
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
        content: "I need to store a queen bed, sofa, dining table, wardrobe, and 10 boxes.",
      },
    ];

    const result = await processInventoryTurn(
      messages,
      canonicalInventory,
      undefined,
      false // inventoryInitialized = false
    );

    expect(result.content).not.toMatch(/add.*replace/i);
    expect(result.operation).toBe("REPLACE");
    // 1.5 + 2.0 + 2.0 + 1.2 + 1.0 = 7.7 CBM
    expect(result.cbm).toBe(7.7);
    expect(result.storageRecommendation).toEqual({
      id: "large",
      label: "Large storage unit",
      capacityCbm: 10,
    });
    expect(result.inventoryInitialized).toBe(true);
  });

  // 7. Empty but initialized inventory
  it("Case 7 — Empty but previously initialized inventory: asks ADD vs REPLACE and does not treat [] as uninitialized", async () => {
    const canonicalInventory: InventoryItem[] = [];

    const mockIntentResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  operation: "UNCLEAR",
                  items: [{ type: "queen_bed", quantity: 1 }],
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
      { id: "1", role: "user", content: "I need to store 1 queen-size bed." },
    ];

    const result = await processInventoryTurn(
      messages,
      canonicalInventory,
      undefined,
      true // inventoryInitialized = true
    );

    expect(result.operation).toBe("UNCLEAR");
    expect(result.content).toMatch(/add.*replace/i);
    expect(result.updatedInventory).toEqual([]);
    expect(result.pendingClarification).toEqual({
      items: [{ type: "queen_bed", quantity: 1 }],
    });
  });

  // 8. ADD quantity semantics
  it("Case 8 — ADD quantity semantics: merges quantities and does NOT silently deduplicate", async () => {
    const canonicalInventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ];

    const pendingClarification: PendingClarification = {
      items: [
        { type: "queen_bed", quantity: 1 },
        { type: "three_seat_sofa", quantity: 1 },
      ],
    };

    const mockReplyResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: "Added items." }],
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => mockReplyResponse,
    } as unknown as Response);

    const result = await processInventoryTurn(
      [{ id: "1", role: "user", content: "add" }],
      canonicalInventory,
      undefined,
      true,
      pendingClarification
    );

    // Must be 2 of each, not deduplicated to 1
    expect(result.updatedInventory).toEqual([
      { type: "queen_bed", quantity: 2 },
      { type: "three_seat_sofa", quantity: 2 },
    ]);
    // 2 * 1.5 + 2 * 2.0 = 7.0 CBM
    expect(result.cbm).toBe(7.0);
  });

  // 9. CBM derived from canonical inventory
  it("Case 9 — CBM derived from canonical inventory: always calculated from authoritative inventory", () => {
    const testInventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 }, // 1.5
      { type: "three_seat_sofa", quantity: 1 }, // 2.0
      { type: "wardrobe", quantity: 1 }, // 1.2
    ];

    const calculatedCbm = calculateCbm(testInventory);
    expect(calculatedCbm).toBe(4.7);
  });

  // 10. Storage recommendation derived from CBM
  it("Case 10 — Storage recommendation derived from CBM: selected deterministically from CBM", () => {
    const calculatedCbm = 4.7;
    const recommendation = recommendStorageUnit(calculatedCbm);
    expect(recommendation).toEqual({
      id: "medium",
      label: "Medium storage unit",
      capacityCbm: 5,
    });
  });

  // 11. LLM cannot override verified business result
  it("Case 11 — LLM cannot override verified business results: verified application state is authoritative", async () => {
    const canonicalInventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
      { type: "dining_table_4_chairs", quantity: 1 },
      { type: "wardrobe", quantity: 1 },
      { type: "box", quantity: 10 },
    ];

    // User modifies inventory to wardrobe x 1 (1.2 CBM -> Small 3 CBM)
    const mockIntentResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  operation: "REPLACE",
                  items: [{ type: "wardrobe", quantity: 1 }],
                }),
              },
            ],
          },
        },
      ],
    };

    // LLM produces hallucinated / unsupported size
    const mockReplyResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: "I recommend a 15 CBM unit or a 10x10 space for your wardrobe.",
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

    const result = await processInventoryTurn(
      [{ id: "1", role: "user", content: "I only have 1 wardrobe." }],
      canonicalInventory,
      undefined,
      true
    );

    // Business values must remain verified regardless of LLM text
    expect(result.cbm).toBe(1.2);
    expect(result.storageRecommendation).toEqual({
      id: "small",
      label: "Small storage unit",
      capacityCbm: 3,
    });
    expect(result.updatedInventory).toEqual([{ type: "wardrobe", quantity: 1 }]);
  });

  // 12. Race protection: Older cancelled request cannot overwrite newer request
  it("Case 12 — Race protection: Older request completion cannot overwrite newer request state", async () => {
    let currentRequestId = 0;
    let canonicalState: InventoryItem[] = [{ type: "box", quantity: 5 }];

    // Simulate Client Chat component logic with requestId tracking
    const handleRequest = async (
      requestId: number,
      reqPromise: Promise<{ updatedInventory: InventoryItem[] }>
    ) => {
      try {
        const data = await reqPromise;
        if (requestId !== currentRequestId) {
          // Discarded because superseded
          return;
        }
        canonicalState = data.updatedInventory;
      } catch {
        // Ignored
      }
    };

    // Request A starts (slow)
    const reqAId = ++currentRequestId;
    let resolveReqA: (value: { updatedInventory: InventoryItem[] }) => void;
    const reqAPromise = new Promise<{ updatedInventory: InventoryItem[] }>((resolve) => {
      resolveReqA = resolve;
    });
    const taskA = handleRequest(reqAId, reqAPromise);

    // Request B starts and completes immediately
    const reqBId = ++currentRequestId;
    const reqBItems: InventoryItem[] = [{ type: "queen_bed", quantity: 1 }];
    const reqBPromise = Promise.resolve({
      updatedInventory: reqBItems,
    });
    await handleRequest(reqBId, reqBPromise);

    expect(canonicalState).toEqual([{ type: "queen_bed", quantity: 1 }]);

    // Request A finishes later
    const reqAItems: InventoryItem[] = [{ type: "box", quantity: 999 }];
    resolveReqA!({ updatedInventory: reqAItems });
    await taskA;

    // Invariant: Request A was ignored, state is still from Request B
    expect(canonicalState).toEqual([{ type: "queen_bed", quantity: 1 }]);
  });

  // 13. LLM extraction error does not mutate inventory
  it("Case 13 — LLM extraction error: failures leave canonical inventory intact", async () => {
    const canonicalInventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
    ];
    const snapshot = JSON.stringify(canonicalInventory);

    global.fetch = vi.fn().mockRejectedValueOnce(new Error("LLM network timeout"));

    const messages: Message[] = [
      { id: "1", role: "user", content: "Add 10 boxes." },
    ];

    await expect(
      processInventoryTurn(messages, canonicalInventory, undefined, true)
    ).rejects.toThrow("LLM network timeout");

    expect(JSON.stringify(canonicalInventory)).toBe(snapshot);
  });

  // 14. Final response error does not roll back committed inventory
  it("Case 14 — Final response error does not roll back committed inventory", async () => {
    const canonicalInventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
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

    // Intent succeeds, final conversational LLM throws 500
    global.fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockIntentResponse,
      } as unknown as Response)
      .mockRejectedValueOnce(new Error("LLM internal server error"));

    const messages: Message[] = [
      { id: "1", role: "user", content: "Add 10 boxes." },
    ];

    const result = await processInventoryTurn(
      messages,
      canonicalInventory,
      undefined,
      true
    );

    // Business state must remain committed with deterministic fallback
    expect(result.operation).toBe("ADD");
    expect(result.updatedInventory).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "box", quantity: 10 },
    ]);
    expect(result.cbm).toBe(2.5);
    expect(result.storageRecommendation).toEqual({
      id: "small",
      label: "Small storage unit",
      capacityCbm: 3,
    });
    expect(result.content).toContain("2.5 CBM");
  });
});
