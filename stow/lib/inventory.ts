import {
  InventoryItem,
  InventoryItemType,
  InventoryOperation,
} from "@/types/inventory";

export const SUPPORTED_ITEM_TYPES: readonly InventoryItemType[] = [
  "queen_bed",
  "three_seat_sofa",
  "wardrobe",
  "dining_table_4_chairs",
  "box",
] as const;

export const INITIAL_CANONICAL_INVENTORY: InventoryItem[] = [
  { type: "queen_bed", quantity: 1 },
  { type: "three_seat_sofa", quantity: 1 },
  { type: "wardrobe", quantity: 1 },
  { type: "dining_table_4_chairs", quantity: 1 },
  { type: "box", quantity: 10 },
];

export function validateInventoryItem(item: InventoryItem): void {
  if (!item || typeof item !== "object") {
    throw new Error("Invalid inventory item: item must be an object.");
  }

  if (!SUPPORTED_ITEM_TYPES.includes(item.type)) {
    throw new Error(`Unsupported inventory item type: "${item.type}".`);
  }

  if (
    typeof item.quantity !== "number" ||
    !Number.isInteger(item.quantity) ||
    item.quantity <= 0
  ) {
    throw new Error(
      `Invalid quantity for ${item.type}: ${item.quantity}. Quantity must be a positive integer.`
    );
  }
}

export function applyInventoryOperation(
  currentInventory: InventoryItem[],
  operation: InventoryOperation
): InventoryItem[] {
  if (!operation || !operation.operation || !Array.isArray(operation.items)) {
    throw new Error("Invalid operation: operation type and items array are required.");
  }

  // Validate all incoming items
  for (const item of operation.items) {
    validateInventoryItem(item);
  }

  switch (operation.operation) {
    case "REPLACE": {
      // Replace entire inventory with supplied items (consolidating duplicate types if any)
      const replacedMap = new Map<InventoryItemType, number>();
      for (const item of operation.items) {
        replacedMap.set(
          item.type,
          (replacedMap.get(item.type) || 0) + item.quantity
        );
      }
      return Array.from(replacedMap.entries()).map(([type, quantity]) => ({
        type,
        quantity,
      }));
    }

    case "ADD": {
      // Clone current inventory as map
      const inventoryMap = new Map<InventoryItemType, number>();
      for (const item of currentInventory) {
        inventoryMap.set(item.type, item.quantity);
      }

      // Add specified items
      for (const item of operation.items) {
        inventoryMap.set(
          item.type,
          (inventoryMap.get(item.type) || 0) + item.quantity
        );
      }

      return Array.from(inventoryMap.entries()).map(([type, quantity]) => ({
        type,
        quantity,
      }));
    }

    case "REMOVE": {
      // Clone current inventory as map
      const inventoryMap = new Map<InventoryItemType, number>();
      for (const item of currentInventory) {
        inventoryMap.set(item.type, item.quantity);
      }

      // Remove specified quantities
      for (const item of operation.items) {
        const currentQty = inventoryMap.get(item.type);
        if (currentQty !== undefined) {
          const remaining = currentQty - item.quantity;
          if (remaining <= 0) {
            inventoryMap.delete(item.type);
          } else {
            inventoryMap.set(item.type, remaining);
          }
        }
      }

      return Array.from(inventoryMap.entries()).map(([type, quantity]) => ({
        type,
        quantity,
      }));
    }

    default: {
      const exhaustiveCheck: never = operation;
      throw new Error(`Unsupported inventory operation: ${(exhaustiveCheck as { operation: string }).operation}`);
    }
  }
}
