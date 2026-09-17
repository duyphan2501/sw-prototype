import { InventoryItem, InventoryItemType } from "@/types/inventory";
import { applyInventoryOperation } from "@/lib/inventory";
import { calculateCbm } from "@/lib/calculator";
import { extractInventoryIntent } from "@/lib/inventoryIntent";
import { callLLM } from "@/lib/llm";
import { Message } from "@/types/chat";

export interface InventoryFlowResult {
  content: string;
  updatedInventory: InventoryItem[];
  cbm: number;
  operation: "REPLACE" | "ADD" | "REMOVE" | "UNCLEAR" | "CONVERSATION";
}

const ITEM_DISPLAY_NAMES: Record<InventoryItemType, string> = {
  queen_bed: "queen-size bed",
  three_seat_sofa: "three-seat sofa",
  wardrobe: "wardrobe",
  dining_table_4_chairs: "dining table with 4 chairs",
  box: "box",
};

export function formatInventorySummary(items: InventoryItem[]): string {
  if (items.length === 0) return "empty";
  return items
    .map((item) => {
      const name = ITEM_DISPLAY_NAMES[item.type] || item.type;
      const plural = item.quantity > 1 && item.type === "box" ? "boxes" : name;
      return `${item.quantity} ${plural}`;
    })
    .join(", ");
}

export async function processInventoryTurn(
  messages: Message[],
  currentInventory: InventoryItem[],
  signal?: AbortSignal
): Promise<InventoryFlowResult> {
  const latestMessage = messages[messages.length - 1];
  const userText = latestMessage?.content || "";

  // 1. Extract structured intent via LLM
  const intent = await extractInventoryIntent(userText, signal);

  // 2. Handle UNCLEAR or non-inventory requests
  if (intent.operation === "UNCLEAR") {
    const currentCbm = calculateCbm(currentInventory);

    if (intent.items && intent.items.length > 0) {
      const itemsSummary = formatInventorySummary(intent.items);
      return {
        content: `Would you like me to add ${itemsSummary} to your current inventory, or replace your current inventory with those items?`,
        updatedInventory: currentInventory,
        cbm: currentCbm,
        operation: "UNCLEAR",
      };
    }

    // General conversation: respond naturally without mutating inventory
    const conversationReply = await callLLM(messages, signal);
    return {
      content: conversationReply,
      updatedInventory: currentInventory,
      cbm: currentCbm,
      operation: "CONVERSATION",
    };
  }

  // 3. Apply validated deterministic mutation
  const updatedInventory = applyInventoryOperation(currentInventory, intent);

  // 4. Deterministic CBM calculation
  const cbm = calculateCbm(updatedInventory);

  // 5. Generate concise, verified customer response
  const summary = formatInventorySummary(updatedInventory);

  const verifiedSystemPrompt =
    "You are MyStorage Assistant. The system has deterministically updated the customer's inventory.\n" +
    `Operation performed: ${intent.operation}\n` +
    `Updated inventory: ${summary}\n` +
    `Verified volume: ${cbm} CBM\n\n` +
    "Instructions for your response:\n" +
    "1. Confirm the update in a brief, friendly customer-facing sentence.\n" +
    `2. Clearly state that the estimated volume is approximately ${cbm} CBM based on prototype volume estimates.\n` +
    "3. CRITICAL: DO NOT recommend, calculate, or hallucinate any storage unit size (e.g. NEVER mention 10x10, 5x5, 100 sq ft, 50 sq ft, etc.). Stop at the verified CBM.";

  let replyText = "";
  try {
    replyText = await callLLM(
      [{ id: `reply-${Date.now()}`, role: "user", content: userText }],
      signal,
      { systemPrompt: verifiedSystemPrompt }
    );
  } catch {
    // Fallback in case of conversational call issue
    if (intent.operation === "REPLACE") {
      replyText = `Got it. I’ve updated your inventory to ${summary}. That’s approximately ${cbm} CBM based on our prototype volume estimates.`;
    } else if (intent.operation === "ADD") {
      replyText = `Got it. I’ve added the items. Your current inventory is now ${summary} (approximately ${cbm} CBM).`;
    } else {
      replyText = `Got it. I’ve removed the requested items. Your updated inventory is ${summary} (approximately ${cbm} CBM).`;
    }
  }

  return {
    content: replyText,
    updatedInventory,
    cbm,
    operation: intent.operation,
  };
}
