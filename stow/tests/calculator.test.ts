import { describe, it, expect } from "vitest";
import { calculateCbm, ITEM_VOLUME_CBM } from "../lib/calculator";
import { INITIAL_CANONICAL_INVENTORY } from "../lib/inventory";
import { InventoryItem } from "../types/inventory";

describe("Phase 06 — Deterministic CBM Calculator", () => {
  it("Test 1 — Empty inventory returns 0", () => {
    expect(calculateCbm([])).toBe(0);
  });

  it("Test 2 — One item calculates correctly", () => {
    const inventory: InventoryItem[] = [{ type: "queen_bed", quantity: 1 }];
    expect(calculateCbm(inventory)).toBe(1.5);
  });

  it("Test 3 — Multiple different items are summed correctly", () => {
    const inventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "three_seat_sofa", quantity: 1 },
      { type: "box", quantity: 10 },
    ];
    // 1.5 + 2.0 + (10 * 0.1) = 4.5
    expect(calculateCbm(inventory)).toBe(4.5);
  });

  it("Test 4 — Quantity multiplies the item volume correctly", () => {
    const inventory: InventoryItem[] = [{ type: "box", quantity: 5 }];
    // 5 * 0.1 = 0.5
    expect(calculateCbm(inventory)).toBe(0.5);
  });

  it("Test 5 — The Phase 05 mock inventory produces the expected total (7.7 CBM)", () => {
    // queen_bed (1.5) + three_seat_sofa (2.0) + wardrobe (1.2) + dining_table_4_chairs (2.0) + box * 10 (1.0) = 7.7
    expect(calculateCbm(INITIAL_CANONICAL_INVENTORY)).toBe(7.7);
  });

  it("Test 6 — Final result is rounded to two decimal places", () => {
    const inventory: InventoryItem[] = [
      { type: "wardrobe", quantity: 1 }, // 1.2
      { type: "box", quantity: 7 }, // 0.7
    ];
    // 1.2 + 0.7 = 1.9
    expect(calculateCbm(inventory)).toBe(1.9);

    // Verify rounding precision behavior
    const singleSmallItem: InventoryItem[] = [{ type: "box", quantity: 3 }];
    // 3 * 0.1 = 0.3
    expect(calculateCbm(singleSmallItem)).toBe(0.3);
  });

  it("Test 7 — Invalid quantity is rejected", () => {
    // Zero quantity
    expect(() =>
      calculateCbm([{ type: "box", quantity: 0 }])
    ).toThrow(/positive integer/);

    // Negative quantity
    expect(() =>
      calculateCbm([{ type: "box", quantity: -2 }])
    ).toThrow(/positive integer/);

    // Non-integer quantity
    expect(() =>
      calculateCbm([{ type: "box", quantity: 1.5 }])
    ).toThrow(/positive integer/);
  });

  it("Test 8 — Unsupported item type is rejected", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const invalidInventory: any[] = [{ type: "kayak", quantity: 1 }];

    expect(() => calculateCbm(invalidInventory)).toThrow(
      /Unsupported inventory item type/
    );
  });

  it("Test 9 — Input inventory is not mutated", () => {
    const original: InventoryItem[] = [
      { type: "queen_bed", quantity: 1 },
      { type: "box", quantity: 10 },
    ];
    const snapshot = JSON.stringify(original);

    calculateCbm(original);

    expect(JSON.stringify(original)).toBe(snapshot);
    expect(original).toEqual([
      { type: "queen_bed", quantity: 1 },
      { type: "box", quantity: 10 },
    ]);
  });

  it("Exposes expected prototype volume constants", () => {
    expect(ITEM_VOLUME_CBM).toEqual({
      queen_bed: 1.5,
      three_seat_sofa: 2.0,
      wardrobe: 1.2,
      dining_table_4_chairs: 2.0,
      box: 0.1,
    });
  });
});
