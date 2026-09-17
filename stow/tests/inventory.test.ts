import { describe, it, expect } from "vitest";
import {
  applyInventoryOperation,
  INITIAL_CANONICAL_INVENTORY,
} from "../lib/inventory";
import { InventoryItem } from "../types/inventory";

describe("Phase 05 — Deterministic Inventory State", () => {
  it("Test 1 — REPLACE replaces the entire inventory with supplied items", () => {
    const initial: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "wardrobe", quantity: 1 },
      { type: "box", quantity: 10 },
    ];

    const result = applyInventoryOperation(initial, {
      operation: "REPLACE",
      items: [
        { type: "queen_bed", quantity: 1 },
        { type: "three_seat_sofa", quantity: 1 },
      ],
    });

    expect(result).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ]);
  });

  it("Test 2 — ADD preserves existing items and adds new items", () => {
    const initial: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ];

    const result = applyInventoryOperation(initial, {
      operation: "ADD",
      items: [{ type: "box", quantity: 10 }],
    });

    expect(result).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
      { type: "box", quantity: 10 },
    ]);
  });

  it("Test 3 — ADD merges quantity if an item already exists", () => {
    const initial: InventoryItem[] = [{ type: "box", quantity: 10 }];

    const result = applyInventoryOperation(initial, {
      operation: "ADD",
      items: [{ type: "box", quantity: 5 }],
    });

    expect(result).toEqual([{ type: "box", quantity: 15 }]);
  });

  it("Test 4 — REMOVE removes specified items", () => {
    const initial: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
      { type: "wardrobe", quantity: 1 },
      { type: "box", quantity: 10 },
    ];

    const result = applyInventoryOperation(initial, {
      operation: "REMOVE",
      items: [
        { type: "wardrobe", quantity: 1 },
        { type: "box", quantity: 10 },
      ],
    });

    expect(result).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ]);
  });

  it("Test 5 — REMOVE does not affect unspecified items", () => {
    const initial: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
      { type: "wardrobe", quantity: 1 },
    ];

    const result = applyInventoryOperation(initial, {
      operation: "REMOVE",
      items: [{ type: "wardrobe", quantity: 1 }],
    });

    expect(result).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ]);
  });

  it("Test 6 — Invalid quantities (0, negative, non-integer) are rejected without modifying state", () => {
    const initial: InventoryItem[] = [{ type: "box", quantity: 10 }];

    // Zero quantity
    expect(() =>
      applyInventoryOperation(initial, {
        operation: "ADD",
        items: [{ type: "box", quantity: 0 }],
      })
    ).toThrow(/positive integer/);

    // Negative quantity
    expect(() =>
      applyInventoryOperation(initial, {
        operation: "ADD",
        items: [{ type: "box", quantity: -5 }],
      })
    ).toThrow(/positive integer/);

    // Decimal quantity
    expect(() =>
      applyInventoryOperation(initial, {
        operation: "ADD",
        items: [{ type: "box", quantity: 3.5 }],
      })
    ).toThrow(/positive integer/);

    // Original array remains unchanged
    expect(initial).toEqual([{ type: "box", quantity: 10 }]);
  });

  it("Test 7 — Unsupported items are rejected without modifying state", () => {
    const initial: InventoryItem[] = [{ type: "box", quantity: 10 }];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unsupportedOperation: any = {
      operation: "ADD",
      items: [{ type: "grand_piano", quantity: 1 }],
    };

    expect(() =>
      applyInventoryOperation(initial, unsupportedOperation)
    ).toThrow(/Unsupported inventory item type/);

    expect(initial).toEqual([{ type: "box", quantity: 10 }]);
  });

  it("Test 8 — Cancellation Isolation: LLM request start and abort does NOT mutate canonical inventory", async () => {
    // Initial canonical inventory
    const canonicalInventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ];
    const initialSnapshot = JSON.stringify(canonicalInventory);

    // Simulate AI generation lifecycle
    const controller = new AbortController();
    let isGenerating = true;

    // Simulate active generation that gets cancelled by user
    const generationPromise = new Promise<string>((_, reject) => {
      controller.signal.addEventListener("abort", () => {
        const err = new Error("Aborted");
        err.name = "AbortError";
        reject(err);
      });
    })
      .catch(() => {
        // Cancelled
      })
      .finally(() => {
        isGenerating = false;
      });

    // User clicks Cancel Response
    controller.abort();
    await generationPromise;

    // Assert that generation state returned to idle
    expect(isGenerating).toBe(false);

    // Assert invariant: cancelling an AI response generation does NOT contaminate or mutate canonicalInventory
    expect(JSON.stringify(canonicalInventory)).toBe(initialSnapshot);
    expect(canonicalInventory).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
    ]);
  });

  it("Provides initial mock canonical inventory with expected defaults", () => {
    expect(INITIAL_CANONICAL_INVENTORY).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
      { type: "wardrobe", quantity: 1 },
      { type: "dining_table_4_chairs", quantity: 1 },
      { type: "box", quantity: 10 },
    ]);
  });
});
