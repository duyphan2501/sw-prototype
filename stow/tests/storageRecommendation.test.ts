import { describe, it, expect } from "vitest";
import {
  recommendStorageUnit,
  STORAGE_OPTIONS,
} from "../lib/storageRecommendation";
import { calculateCbm } from "../lib/calculator";
import { InventoryItem } from "../types/inventory";

describe("Phase 09 — Deterministic Storage Recommendation", () => {
  it("Test 1 — Small inventory (2.5 CBM) recommends Small (3 CBM)", () => {
    const result = recommendStorageUnit(2.5);
    expect(result).toEqual({
      id: "small",
      label: "Small storage unit",
      capacityCbm: 3,
    });
  });

  it("Test 2 — Exact small boundary (3 CBM) recommends Small (3 CBM)", () => {
    const result = recommendStorageUnit(3);
    expect(result).toEqual({
      id: "small",
      label: "Small storage unit",
      capacityCbm: 3,
    });
  });

  it("Test 3 — Between options (3.1 CBM) recommends Medium (5 CBM)", () => {
    const result = recommendStorageUnit(3.1);
    expect(result).toEqual({
      id: "medium",
      label: "Medium storage unit",
      capacityCbm: 5,
    });
  });

  it("Test 4 — Larger inventory (7.7 CBM) recommends Large (10 CBM)", () => {
    const result = recommendStorageUnit(7.7);
    expect(result).toEqual({
      id: "large",
      label: "Large storage unit",
      capacityCbm: 10,
    });
  });

  it("Test 5 — Exact large boundary (10 CBM) recommends Large (10 CBM)", () => {
    const result = recommendStorageUnit(10);
    expect(result).toEqual({
      id: "large",
      label: "Large storage unit",
      capacityCbm: 10,
    });
  });

  it("Test 6 — Above maximum (10.1 CBM) returns null", () => {
    const result = recommendStorageUnit(10.1);
    expect(result).toBeNull();
  });

  it("Test 7 — Invalid input (negative or NaN) is rejected", () => {
    expect(() => recommendStorageUnit(-1)).toThrow(/non-negative number/);
    expect(() => recommendStorageUnit(NaN)).toThrow(/non-negative number/);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => recommendStorageUnit("5" as any)).toThrow(/non-negative number/);
  });

  it("Test 8 — Integration: Verified 9.2 CBM produces Large (10 CBM)", () => {
    const inventory: InventoryItem[] = [
      { type: "queen_bed", quantity: 2 }, // 3.0
      { type: "three_seat_sofa", quantity: 1 }, // 2.0
      { type: "wardrobe", quantity: 1 }, // 1.2
      { type: "dining_table_4_chairs", quantity: 1 }, // 2.0
      { type: "box", quantity: 10 }, // 1.0
    ];

    const cbm = calculateCbm(inventory);
    expect(cbm).toBe(9.2);

    const recommendation = recommendStorageUnit(cbm);
    expect(recommendation).toEqual({
      id: "large",
      label: "Large storage unit",
      capacityCbm: 10,
    });
  });

  it("Exposes expected prototype storage options", () => {
    expect(STORAGE_OPTIONS).toHaveLength(3);
    expect(STORAGE_OPTIONS[0]).toEqual({
      id: "small",
      label: "Small storage unit",
      capacityCbm: 3,
    });
    expect(STORAGE_OPTIONS[1]).toEqual({
      id: "medium",
      label: "Medium storage unit",
      capacityCbm: 5,
    });
    expect(STORAGE_OPTIONS[2]).toEqual({
      id: "large",
      label: "Large storage unit",
      capacityCbm: 10,
    });
  });
});
