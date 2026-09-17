import { InventoryIntent, InventoryItem } from "@/types/inventory";
import { validateInventoryItem } from "@/lib/inventory";

export function validateInventoryIntent(raw: unknown): InventoryIntent {
  let parsed: unknown = raw;

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    // Remove markdown code fences if present
    const cleaned = trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    try {
      parsed = JSON.parse(cleaned);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Malformed JSON in inventory intent: ${message}`);
    }
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid inventory intent: expected a JSON object.");
  }

  const candidate = parsed as Record<string, unknown>;

  if (typeof candidate.operation !== "string") {
    throw new Error("Invalid inventory intent: operation field is required and must be a string.");
  }

  const operation = candidate.operation.toUpperCase();

  if (
    operation !== "REPLACE" &&
    operation !== "ADD" &&
    operation !== "REMOVE" &&
    operation !== "UNCLEAR"
  ) {
    throw new Error(
      `Unsupported inventory intent operation: "${candidate.operation}". Must be REPLACE, ADD, REMOVE, or UNCLEAR.`
    );
  }

  if (candidate.items !== undefined && !Array.isArray(candidate.items)) {
    throw new Error("Invalid inventory intent: items field must be an array.");
  }

  if (operation !== "UNCLEAR" && !Array.isArray(candidate.items)) {
    throw new Error("Invalid inventory intent: items field must be an array.");
  }

  const itemsList = Array.isArray(candidate.items) ? candidate.items : [];
  const validatedItems: InventoryItem[] = [];

  for (const item of itemsList) {
    validateInventoryItem(item as InventoryItem);
    validatedItems.push({
      type: item.type,
      quantity: item.quantity,
    });
  }

  return {
    operation,
    items: validatedItems,
  };
}
