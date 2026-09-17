export type InventoryItemType =
  | "queen_bed"
  | "three_seat_sofa"
  | "wardrobe"
  | "dining_table_4_chairs"
  | "box";

export interface InventoryItem {
  type: InventoryItemType;
  quantity: number;
}

export type InventoryOperation =
  | {
      operation: "REPLACE";
      items: InventoryItem[];
    }
  | {
      operation: "ADD";
      items: InventoryItem[];
    }
  | {
      operation: "REMOVE";
      items: InventoryItem[];
    };

export type InventoryIntent =
  | InventoryOperation
  | {
      operation: "UNCLEAR";
      items: InventoryItem[];
    };


