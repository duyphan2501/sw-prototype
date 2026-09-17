import {
  InventoryItem,
  InventoryItemType,
  InventoryOperation,
  PendingClarification,
  StorageRecommendation,
} from "@/types/inventory";
import { applyInventoryOperation } from "@/lib/inventory";
import { calculateCbm } from "@/lib/calculator";
import { recommendStorageUnit } from "@/lib/storageRecommendation";
import { extractInventoryIntent } from "@/lib/inventoryIntent";
import { callLLM } from "@/lib/llm";
import { Message } from "@/types/chat";

export interface InventoryFlowResult {
  content: string;
  updatedInventory: InventoryItem[];
  cbm: number;
  storageRecommendation: StorageRecommendation | null;
  operation: "REPLACE" | "ADD" | "REMOVE" | "UNCLEAR" | "CONVERSATION";
  inventoryInitialized: boolean;
  pendingClarification: PendingClarification | null;
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
  signal?: AbortSignal,
  inventoryInitialized: boolean = false,
  pendingClarification?: PendingClarification | null
): Promise<InventoryFlowResult> {
  const latestMessage = messages[messages.length - 1];
  const userText = latestMessage?.content || "";
  const cleanText = userText
    .trim()
    .toLowerCase()
    .replace(/[.!?,]+$/, "")
    .trim();

  let resolvedOperation: InventoryOperation | null = null;
  let nextInventoryInitialized = inventoryInitialized;
  let nextPendingClarification: PendingClarification | null = null;

  // 1. Check if user is directly answering a pending clarification question
  if (
    pendingClarification &&
    pendingClarification.items &&
    pendingClarification.items.length > 0
  ) {
    const isAddAnswer =
      /^(please\s+)?add(\s+(them|these|it|all|to\s+(my\s+)?(current\s+|existing\s+)?inventory))?$/i.test(
        cleanText
      );
    const isReplaceAnswer =
      /^(please\s+)?replace(\s+(them|these|it|all|(my\s+)?(current\s+|existing\s+)?inventory))?$/i.test(
        cleanText
      );

    if (isAddAnswer) {
      resolvedOperation = {
        operation: "ADD",
        items: pendingClarification.items,
      };
      nextInventoryInitialized = true;
      nextPendingClarification = null;
    } else if (isReplaceAnswer) {
      resolvedOperation = {
        operation: "REPLACE",
        items: pendingClarification.items,
      };
      nextInventoryInitialized = true;
      nextPendingClarification = null;
    }
  }

  // 2. If not answering pending clarification, extract structured intent via LLM
  if (!resolvedOperation) {
    const intent = await extractInventoryIntent(userText, signal);

    if (intent.operation === "UNCLEAR") {
      // If inventory has not been initialized yet and the user provides identifiable inventory items:
      // - Do not ask whether to ADD or REPLACE.
      // - Treat the request as initializing the inventory (REPLACE).
      // - Apply the identified items as the canonical inventory.
      if (intent.items && intent.items.length > 0 && !inventoryInitialized) {
        resolvedOperation = {
          operation: "REPLACE",
          items: intent.items,
        };
        nextInventoryInitialized = true;
        nextPendingClarification = null;
      } else {
        const currentCbm = calculateCbm(currentInventory);
        const currentRecommendation = recommendStorageUnit(currentCbm);

        if (intent.items && intent.items.length > 0) {
          const itemsSummary = formatInventorySummary(intent.items);
          return {
            content: `Would you like me to add ${itemsSummary} to your current inventory, or replace your current inventory with those items?`,
            updatedInventory: currentInventory,
            cbm: currentCbm,
            storageRecommendation: currentRecommendation,
            operation: "UNCLEAR",
            inventoryInitialized: true,
            pendingClarification: { items: intent.items },
          };
        }

        // General conversation: respond naturally without mutating inventory
        const conversationReply = await callLLM(messages, signal);
        return {
          content: conversationReply,
          updatedInventory: currentInventory,
          cbm: currentCbm,
          storageRecommendation: currentRecommendation,
          operation: "CONVERSATION",
          inventoryInitialized,
          pendingClarification: null,
        };
      }
    } else {
      resolvedOperation = intent;
      nextInventoryInitialized = true;
      nextPendingClarification = null;
    }
  }

  // 3. Apply validated deterministic mutation
  const updatedInventory = applyInventoryOperation(
    currentInventory,
    resolvedOperation
  );

  // 4. Deterministic CBM calculation
  const cbm = calculateCbm(updatedInventory);

  // 5. Deterministic Storage Recommendation
  const storageRecommendation = recommendStorageUnit(cbm);

  // 6. Generate concise, verified customer response
  const summary = formatInventorySummary(updatedInventory);

  const recommendationClause = storageRecommendation
    ? `Based on the available prototype options, a ${storageRecommendation.capacityCbm} CBM storage unit (${storageRecommendation.label}) would be the appropriate size.`
    : "There is no configured storage option large enough in this prototype.";

  const verifiedSystemPrompt =
    "You are MyStorage Assistant. The system has deterministically updated the customer's inventory.\n" +
    `Operation performed: ${resolvedOperation.operation}\n` +
    `Updated inventory: ${summary}\n` +
    `Verified volume: ${cbm} CBM\n` +
    `Verified storage recommendation: ${recommendationClause}\n\n` +
    "Instructions for your response:\n" +
    "1. Confirm the update in a brief, friendly customer-facing sentence.\n" +
    `2. Clearly state that the estimated volume is approximately ${cbm} CBM.\n` +
    `3. State the verified storage recommendation: "${recommendationClause}".\n` +
    "4. CRITICAL: DO NOT recommend, calculate, or hallucinate any other storage unit size or dimensions (e.g. NEVER mention 10x10, 5x5, 100 sq ft, 50 sq ft, etc.). Use only the verified recommendation above.";

  let replyText = "";
  try {
    replyText = await callLLM(
      [{ id: `reply-${Date.now()}`, role: "user", content: userText }],
      signal,
      { systemPrompt: verifiedSystemPrompt }
    );
  } catch {
    // Fallback in case of conversational call issue (including AbortError)
    const sizeNote = storageRecommendation
      ? ` Based on the available prototype options, a ${storageRecommendation.capacityCbm} CBM storage unit would be the appropriate size.`
      : " There is no configured storage option large enough in this prototype.";

    if (resolvedOperation.operation === "REPLACE") {
      replyText = `Got it. I’ve updated your inventory to ${summary}. That’s approximately ${cbm} CBM.${sizeNote}`;
    } else if (resolvedOperation.operation === "ADD") {
      replyText = `Got it. I’ve added the items. Your current inventory is now ${summary} (approximately ${cbm} CBM).${sizeNote}`;
    } else {
      replyText = `Got it. I’ve removed the requested items. Your updated inventory is ${summary} (approximately ${cbm} CBM).${sizeNote}`;
    }
  }

  return {
    content: replyText,
    updatedInventory,
    cbm,
    storageRecommendation,
    operation: resolvedOperation.operation,
    inventoryInitialized: nextInventoryInitialized,
    pendingClarification: nextPendingClarification,
  };
}
