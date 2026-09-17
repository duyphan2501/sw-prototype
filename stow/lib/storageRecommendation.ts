import { StorageRecommendation } from "@/types/inventory";

export const STORAGE_OPTIONS = [
  {
    id: "small",
    label: "Small storage unit",
    capacityCbm: 3,
  },
  {
    id: "medium",
    label: "Medium storage unit",
    capacityCbm: 5,
  },
  {
    id: "large",
    label: "Large storage unit",
    capacityCbm: 10,
  },
] as const;

export function recommendStorageUnit(cbm: number): StorageRecommendation | null {
  if (typeof cbm !== "number" || Number.isNaN(cbm) || cbm < 0) {
    throw new Error(
      `Invalid CBM value: ${cbm}. CBM must be a non-negative number.`
    );
  }

  // Find smallest option whose capacity is >= cbm
  for (const option of STORAGE_OPTIONS) {
    if (option.capacityCbm >= cbm) {
      return {
        id: option.id,
        label: option.label,
        capacityCbm: option.capacityCbm,
      };
    }
  }

  // CBM exceeds maximum prototype option (10 CBM)
  return null;
}
