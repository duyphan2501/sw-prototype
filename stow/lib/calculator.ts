import { InventoryItem, InventoryItemType } from "@/types/inventory";
import { validateInventoryItem } from "@/lib/inventory";

export const ITEM_VOLUME_CBM: Record<InventoryItemType, number> = {
  queen_bed: 1.5,
  three_seat_sofa: 2.0,
  wardrobe: 1.2,
  dining_table_4_chairs: 2.0,
  box: 0.1,
} as const;

export function calculateCbm(inventory: InventoryItem[]): number {
  if (!Array.isArray(inventory)) {
    throw new Error("Invalid inventory: expected an array of inventory items.");
  }

  if (inventory.length === 0) {
    return 0;
  }

  let totalCbm = 0;

  for (const item of inventory) {
    // Validate quantity and supported item type
    validateInventoryItem(item);

    const unitVolume = ITEM_VOLUME_CBM[item.type];
    if (unitVolume === undefined) {
      throw new Error(`Unsupported inventory item type: "${item.type}".`);
    }

    totalCbm += item.quantity * unitVolume;
  }

  // Round final total to two decimal places
  return Math.round((totalCbm + Number.EPSILON) * 100) / 100;
}
