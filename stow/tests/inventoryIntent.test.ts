import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { validateInventoryIntent } from "../lib/inventoryIntentValidator";
import { extractInventoryIntent } from "../lib/inventoryIntent";
import { InventoryItem } from "../types/inventory";

describe("Phase 07 — LLM Structured Inventory Intent", () => {
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

  describe("Validation Logic (validateInventoryIntent)", () => {
    it("validates a valid REPLACE intent", () => {
      const raw = JSON.stringify({
        operation: "REPLACE",
        items: [
          { type: "queen_bed", quantity: 1 },
          { type: "three_seat_sofa", quantity: 1 },
        ],
      });

      const intent = validateInventoryIntent(raw);
      expect(intent).toEqual({
        operation: "REPLACE",
        items: [
          { type: "queen_bed", quantity: 1 },
          { type: "three_seat_sofa", quantity: 1 },
        ],
      });
    });

    it("validates a valid ADD intent", () => {
      const raw = JSON.stringify({
        operation: "ADD",
        items: [{ type: "box", quantity: 10 }],
      });

      const intent = validateInventoryIntent(raw);
      expect(intent).toEqual({
        operation: "ADD",
        items: [{ type: "box", quantity: 10 }],
      });
    });

    it("validates a valid REMOVE intent", () => {
      const raw = JSON.stringify({
        operation: "REMOVE",
        items: [{ type: "wardrobe", quantity: 1 }],
      });

      const intent = validateInventoryIntent(raw);
      expect(intent).toEqual({
        operation: "REMOVE",
        items: [{ type: "wardrobe", quantity: 1 }],
      });
    });

    it("validates an UNCLEAR intent with identified items", () => {
      const raw = JSON.stringify({
        operation: "UNCLEAR",
        items: [
          { type: "queen_bed", quantity: 1 },
          { type: "three_seat_sofa", quantity: 1 },
        ],
      });

      const intent = validateInventoryIntent(raw);
      expect(intent).toEqual({
        operation: "UNCLEAR",
        items: [
          { type: "queen_bed", quantity: 1 },
          { type: "three_seat_sofa", quantity: 1 },
        ],
      });
    });

    it("validates an UNCLEAR intent with empty items when no supported items identified", () => {
      const raw = JSON.stringify({
        operation: "UNCLEAR",
        items: [],
      });

      const intent = validateInventoryIntent(raw);
      expect(intent).toEqual({
        operation: "UNCLEAR",
        items: [],
      });
    });

    it("normalizes markdown code block formatting in LLM output", () => {
      const raw = '```json\n{"operation": "ADD", "items": [{"type": "box", "quantity": 5}]}\n```';
      const intent = validateInventoryIntent(raw);
      expect(intent).toEqual({
        operation: "ADD",
        items: [{ type: "box", quantity: 5 }],
      });
    });

    it("rejects malformed JSON", () => {
      expect(() => validateInventoryIntent("not json")).toThrow(
        /Malformed JSON/
      );
    });

    it("rejects unsupported inventory operations", () => {
      const raw = JSON.stringify({
        operation: "DELETE_ALL",
        items: [],
      });
      expect(() => validateInventoryIntent(raw)).toThrow(
        /Unsupported inventory intent operation/
      );
    });

    it("rejects unsupported item types", () => {
      const raw = JSON.stringify({
        operation: "ADD",
        items: [{ type: "grand_piano", quantity: 1 }],
      });
      expect(() => validateInventoryIntent(raw)).toThrow(
        /Unsupported inventory item type/
      );
    });

    it("rejects invalid quantities (0, negative, non-integer)", () => {
      const zeroQty = JSON.stringify({
        operation: "ADD",
        items: [{ type: "box", quantity: 0 }],
      });
      expect(() => validateInventoryIntent(zeroQty)).toThrow(/positive integer/);

      const negQty = JSON.stringify({
        operation: "ADD",
        items: [{ type: "box", quantity: -2 }],
      });
      expect(() => validateInventoryIntent(negQty)).toThrow(/positive integer/);

      const floatQty = JSON.stringify({
        operation: "ADD",
        items: [{ type: "box", quantity: 3.5 }],
      });
      expect(() => validateInventoryIntent(floatQty)).toThrow(/positive integer/);
    });
  });

  describe("End-to-End Intent Extraction (extractInventoryIntent)", () => {
    it("extracts REPLACE intent for 'I only want to store 1 queen-size bed and 1 three-seat sofa.'", async () => {
      process.env.GEMINI_API_KEY = "test-gemini-key";

      const mockLlmResponse = {
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

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockLlmResponse,
      } as unknown as Response);

      const result = await extractInventoryIntent(
        "I only want to store 1 queen-size bed and 1 three-seat sofa."
      );

      expect(result).toEqual({
        operation: "REPLACE",
        items: [
          { type: "queen_bed", quantity: 1 },
          { type: "three_seat_sofa", quantity: 1 },
        ],
      });
    });

    it("extracts ADD intent for 'Also add 10 boxes.'", async () => {
      process.env.GEMINI_API_KEY = "test-gemini-key";

      const mockLlmResponse = {
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

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockLlmResponse,
      } as unknown as Response);

      const result = await extractInventoryIntent("Also add 10 boxes.");

      expect(result).toEqual({
        operation: "ADD",
        items: [{ type: "box", quantity: 10 }],
      });
    });

    it("extracts REMOVE intent for 'Remove the wardrobe.'", async () => {
      process.env.GEMINI_API_KEY = "test-gemini-key";

      const mockLlmResponse = {
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

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockLlmResponse,
      } as unknown as Response);

      const result = await extractInventoryIntent("Remove the wardrobe.");

      expect(result).toEqual({
        operation: "REMOVE",
        items: [{ type: "wardrobe", quantity: 1 }],
      });
    });

    it("normalizes approximate quantities such as 'around 10 boxes' to integer 10", async () => {
      process.env.GEMINI_API_KEY = "test-gemini-key";

      const mockLlmResponse = {
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

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockLlmResponse,
      } as unknown as Response);

      const result = await extractInventoryIntent("I want to store around 10 boxes.");

      expect(result).toEqual({
        operation: "ADD",
        items: [{ type: "box", quantity: 10 }],
      });
    });

    it("returns UNCLEAR with identified items for 'I need to store a queen-size bed and a three-seat sofa.'", async () => {
      process.env.GEMINI_API_KEY = "test-gemini-key";

      const mockLlmResponse = {
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
                    ],
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockLlmResponse,
      } as unknown as Response);

      const result = await extractInventoryIntent(
        "I need to store a queen-size bed and a three-seat sofa."
      );

      expect(result).toEqual({
        operation: "UNCLEAR",
        items: [
          { type: "queen_bed", quantity: 1 },
          { type: "three_seat_sofa", quantity: 1 },
        ],
      });
    });

    it("returns UNCLEAR with empty items when no supported items can be identified", async () => {
      process.env.GEMINI_API_KEY = "test-gemini-key";

      const mockLlmResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    operation: "UNCLEAR",
                    items: [],
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockLlmResponse,
      } as unknown as Response);

      const result = await extractInventoryIntent("Can you help me?");

      expect(result).toEqual({
        operation: "UNCLEAR",
        items: [],
      });
    });
  });

  describe("Critical Regression Invariant: State Isolation", () => {
    it("extracting an inventory intent does NOT mutate canonicalInventory", async () => {
      process.env.GEMINI_API_KEY = "test-gemini-key";

      const canonicalInventory: InventoryItem[] = [
        { type: "queen_bed", quantity: 1 },
        { type: "three_seat_sofa", quantity: 1 },
        { type: "wardrobe", quantity: 1 },
      ];
      const snapshot = JSON.stringify(canonicalInventory);

      const mockLlmResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    operation: "REPLACE",
                    items: [{ type: "queen_bed", quantity: 1 }],
                  }),
                },
              ],
            },
          },
        ],
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockLlmResponse,
      } as unknown as Response);

      const intent = await extractInventoryIntent(
        "I only want to store 1 queen-size bed."
      );

      expect(intent).toEqual({
        operation: "REPLACE",
        items: [{ type: "queen_bed", quantity: 1 }],
      });

      // Assert invariant: canonicalInventory was never mutated
      expect(JSON.stringify(canonicalInventory)).toBe(snapshot);
      expect(canonicalInventory).toEqual([
        { type: "queen_bed", quantity: 1 },
        { type: "three_seat_sofa", quantity: 1 },
        { type: "wardrobe", quantity: 1 },
      ]);
    });
  });
});
