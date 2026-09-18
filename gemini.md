# MyStorage Assignment — Prototype Master Context

## 1. Assignment Goal

Build a small, working prototype that addresses the observed MyStorage Stow finding:

> After an assistant response is cancelled while generating, stale inventory/context can remain influential in the next inventory estimate.

The real Stow application is the **Before Fix evidence**.

The prototype is the **proposed fixed flow**.

The prototype must demonstrate that:

1. cancelling an assistant response does not contaminate canonical inventory state;
2. subsequent inventory messages are interpreted explicitly;
3. valid `ADD`, `REMOVE`, and `REPLACE` behavior is preserved;
4. the CBM calculation uses the resulting canonical inventory rather than stale generation context.

Do not attempt to reproduce or claim knowledge of Stow's internal implementation.

---

# 2. Core Finding

The observed issue is not simply "the AI calculates CBM incorrectly."

The important behavior is:

```text
Previous inventory
       ↓
Assistant response starts generating
       ↓
User cancels response
       ↓
Temporary/stale context remains influential
       ↓
User sends another inventory request
       ↓
Previous inventory can still influence the estimate
```

The exact internal cause is unknown.

Possible internal causes include frontend state, backend session state, context construction, or another implementation detail.

The prototype must therefore focus on the observable invariant rather than claim a specific production root cause.

---

# 3. Prototype Principle

Keep the implementation deliberately small.

The prototype is NOT a rebuilt version of Stow.

It is a focused proof-of-concept for safer inventory state handling.

### In scope

* customer-facing chat UI;
* real LLM interaction;
* non-streaming assistant response with customer-facing "AI is thinking..." state;
* real Cancel Response interaction via `AbortController`;
* structured inventory intent extraction;
* deterministic inventory state mutation (`REPLACE`, `ADD`, `REMOVE`);
* deterministic CBM calculation;
* deterministic storage unit recommendation;
* multi-turn clarification state preservation (`pendingClarification`);
* regression and end-to-end cancellation validation tests.

### Out of scope

* authentication;
* database;
* payment;
* booking;
* production integrations;
* RAG;
* agent orchestration;
* complex tool calling;
* full Stow UI recreation;
* Before/After simulation inside the UI;
* technical dashboard;
* state matrix;
* lifecycle visualization;
* technical drawer;
* analytics;
* production deployment architecture.

---

# 4. Architecture

Use a minimal architecture:

```text
                    ┌───────────────────┐
                    │      Chat UI      │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  LLM Intent Extr. │
                    └─────────┬─────────┘
                              │
                      structured intent
                              │
                              ▼
                    ┌───────────────────┐
                    │ Intent Validation │
                    └─────────┬─────────┘
                              │
                              ▼
                    ┌───────────────────┐
                    │  Inventory State  │
                    │   deterministic   │
                    └─────────┬─────────┘
                              │
                     canonical inventory
                              │
                              ▼
                    ┌───────────────────┐
                    │  CBM Calculator   │
                    │   deterministic   │
                    └─────────┬─────────┘
                              │
                        verified CBM
                              │
                              ▼
                    ┌───────────────────┐
                    │  Storage Recomm.  │
                    │   deterministic   │
                    └─────────┬─────────┘
                              │
                    verified recommendation
                              │
                              ▼
                    ┌───────────────────┐
                    │      LLM Text     │
                    │ (anti-hallucinate)│
                    └─────────┬─────────┘
                              │
                      verified response
                              │
                              ▼
                           Chat UI
```

The LLM must NOT directly mutate business state or calculate CBM/storage unit size.

---

# 5. State Model

The state concepts required:

## canonicalInventory

The authoritative business inventory.

```ts
canonicalInventory: InventoryItem[]
```

This is the only inventory state used by the calculator.

## inventoryInitialized

A boolean flag distinguishing the user's initial inventory setup from an already established, but currently empty, inventory (`[]`).

```ts
inventoryInitialized: boolean
```

## pendingClarification

Preserves uncommitted, ambiguous inventory items when an operation is `UNCLEAR` on an initialized inventory.

```ts
pendingClarification: {
  items: InventoryItem[]
} | null
```

## pendingGeneration

Temporary generation state associated with the currently generating assistant request (`isGenerating`, `AbortController`).

```ts
isGenerating: boolean
abortControllerRef: React.RefObject<AbortController | null>
```

Do not create unnecessary abstractions for session databases, lifecycle frameworks, etc.

The prototype only needs enough state to demonstrate the invariant.

---

# 6. Cancellation Invariant

The central invariant is:

> Cancelling an assistant response must not allow temporary generation state to influence subsequent inventory processing.

When the user clicks Cancel:

```text
active LLM request
       ↓
Abort (AbortController)
       ↓
discard temporary generation state
       ↓
canonicalInventory remains authoritative
```

Cancellation of the assistant response is NOT cancellation of a business action that has already been explicitly committed.

Therefore:

```text
Cancel response ≠ rollback inventory
```

---

# 7. LLM Responsibilities

The prototype uses an actual LLM, but the LLM has a limited role.

## LLM may

### A. Extract structured inventory intent

Example:

User:

> "Actually, I only want to store a queen-size bed and a three-seat sofa."

LLM:

```json
{
  "operation": "REPLACE",
  "items": [
    {
      "type": "queen_bed",
      "quantity": 1
    },
    {
      "type": "three_seat_sofa",
      "quantity": 1
    }
  ]
}
```

### B. Generate the natural-language assistant response

The response is delivered upon completion while displaying "AI is thinking..." during active generation.

## LLM must NOT

* directly mutate canonical inventory;
* decide authoritative CBM;
* hallucinate unsupported storage unit sizes or dimensions (e.g. 10x10, 100 sq ft);
* override deterministic storage recommendation or CBM;
* directly merge old and new business state;
* bypass validation;
* determine final storage state through free-form text.

The application code remains responsible for business state.

---

# 8. Inventory Operations

Inventory updates must be explicit.

Supported operations:

```ts
type InventoryOperation =
  | "REPLACE"
  | "ADD"
  | "REMOVE"
  | "UNCLEAR";
```

## REPLACE

Example:

> "I only want to store 1 bed and 1 sofa."

Result:

```text
old inventory
      ↓
REPLACE
      ↓
bed + sofa
```

Old items not included in the replacement are removed from the resulting inventory.

## ADD

Example:

> "Also add 10 boxes."

Result:

```text
bed + sofa
      ↓
ADD 10 boxes
      ↓
bed + sofa + 10 boxes
```

This is an intentional merge and must remain supported.

## REMOVE

Example:

> "Remove the wardrobe and all boxes."

Result:

```text
bed + sofa + wardrobe + boxes
      ↓
REMOVE wardrobe + boxes
      ↓
bed + sofa
```

## UNCLEAR

Example:

> "I need to store a queen-size bed and a three-seat sofa."

The system handles UNCLEAR according to the initialization state:

- **When `inventoryInitialized = false`**: Identifiable items are treated as establishing the initial inventory (`REPLACE`). They are applied directly to `canonicalInventory` without prompting the user for clarification.
- **When `inventoryInitialized = true`**: The system does not mutate state. It asks: *"Would you like me to add [items] to your current inventory, or replace your current inventory with those items?"* and preserves `pendingClarification = { items: [...] }`.
  - When the user answers `"add"` or `"replace"` (or natural phrasing variants), the system resolves the operation directly with the pending items without invoking the intent LLM for the standalone word.

---

# 9. Validation Boundary

Use this pipeline:

```text
Natural language
      ↓
LLM structured intent
      ↓
Schema validation
      ↓
Deterministic inventory operation (REPLACE / ADD / REMOVE)
      ↓
canonicalInventory
      ↓
Deterministic CBM calculation
      ↓
Deterministic Storage Recommendation
      ↓
LLM verified response (anti-hallucination)
```

The LLM output is untrusted input.

The application must validate the structured intent before applying it.

---

# 10. CBM Calculator & Storage Recommendation

Use a deterministic mock calculator and recommendation layer.

The purpose is to demonstrate the business consequence of stale inventory, not to reproduce MyStorage's internal pricing calculator.

Fixed volume values:

```text
queen_bed                1.5 CBM
three-seat sofa          2.0 CBM
wardrobe                 1.2 CBM
dining table + 4 chairs  2.0 CBM
box                      0.1 CBM
```

The calculator must only receive:

```ts
canonicalInventory
```

It must never receive raw conversation history or stale generation context.

### Storage Unit Recommendation

The application deterministically selects the smallest unit that fits the verified CBM:

```text
Small:   3 CBM  ("Small storage unit")
Medium:  5 CBM  ("Medium storage unit")
Large:  10 CBM  ("Large storage unit")
Exceeding 10 CBM: null (no configured prototype option)
```

The LLM is strictly forbidden from calculating or hallucinating alternative unit dimensions (e.g., "10x10", "100 sq ft").

---

# 11. Cancellation & Response State

The Cancel Response button must perform a real cancellation of the active generation.

Use an abort mechanism such as `AbortController`.

Conceptually:

```text
Send
 ↓
start LLM request
 ↓
display "AI is thinking..." + "Cancel Response"
 ↓
user clicks Cancel
 ↓
abort active request via AbortController
 ↓
UI returns to idle, temporary generation discarded
 ↓
canonicalInventory remains authoritative
```

Do not implement Cancel merely as:

```ts
setGenerating(false)
```

while allowing the underlying generation to continue.

---

# 12. UI

The UI should resemble a simple customer-facing storage assistant.

It should feel like a real chat product, not an engineering demo.

### Required

```text
┌──────────────────────────────────────┐
│ MyStorage Assistant                  │
│                                      │
│ User message                         │
│                                      │
│ AI is thinking...                    │
│                                      │
│        [ Cancel Response ]           │
│                                      │
│                                      │
├──────────────────────────────────────┤
│ Type your message...             Send│
└──────────────────────────────────────┘
```

Required interactions:

* send message;
* "AI is thinking..." state during generation;
* Cancel Response while generating;
* send another message after cancellation;
* multi-turn clarification for ambiguous inventory requests.

Do not add:

* technical drawer;
* debug panel;
* lifecycle diagram;
* state matrix;
* scenario selector;
* Before/After switch;
* large status dashboard.

The reviewer should be able to understand the prototype by using it as a customer.

---

# 13. Main Demonstration Flow

The main demo should be:

```text
1. Start with initial inventory.

2. Send a message that produces an assistant response.

3. While the response is generating,
   click "Cancel Response".

4. Send an explicit inventory update:

   "I only want to store 1 queen-size bed
    and 1 three-seat sofa."

5. LLM extracts:

   REPLACE [bed, sofa]

6. Deterministic state layer updates
   canonicalInventory.

7. CBM calculator uses only the resulting inventory.

8. Assistant returns the estimate.
```

The expected state transition is:

```text
initial inventory
      ↓
generation starts
      ↓
Cancel
      ↓
generation discarded
      ↓
canonical inventory unaffected
      ↓
explicit REPLACE
      ↓
bed + sofa
      ↓
calculate CBM
```

---

# 14. Regression Cases

Keep regression tests small.

### Test 1 — Normal completed response

```text
Send
→ response completes
→ next inventory request
→ correct intended inventory is used
```

### Test 2 — Cancelled response

```text
Send
→ response starts
→ Cancel
→ next inventory request
→ stale generation state cannot affect calculation
```

### Test 3 — Explicit REPLACE

```text
existing inventory
→ "I only want bed and sofa"
→ result = bed + sofa
```

### Test 4 — ADD / valid merge

```text
existing inventory
→ "Also add 10 boxes"
→ existing inventory + 10 boxes
```

### Test 5 — REMOVE

```text
existing inventory
→ "Remove the wardrobe"
→ wardrobe absent
```

### Test 6 — UNCLEAR

```text
ambiguous inventory statement
→ no silent destructive mutation
→ clarification
```

---

# 15. Production-Oriented Principle

The prototype should demonstrate this boundary:

```text
LLM
  = interpretation + communication

Application logic
  = validation + state mutation + calculation
```

This makes the behavior more predictable and testable.

The LLM should not be the source of truth for business inventory.

---

# 16. Implementation Constraints

Use:

* Next.js;
* TypeScript;
* simple React components;
* minimal dependencies;
* deterministic unit tests.

Avoid unnecessary design patterns.

Do not introduce:

* repository pattern;
* service factory;
* strategy hierarchy;
* event bus;
* state-machine framework;
* database abstraction;
* complex agent framework.

Prefer straightforward functions and small modules.

---

# 17. Project Structure

```text
sw-prototype/
├── package.json          # Root scripts routing to stow workspace
├── README.md             # Project documentation & run guide
├── gemini.md             # Master prototype context
├── docs/                 # Assignment & review notes
└── stow/                 # Next.js Application
    ├── app/
    │   ├── api/chat/route.ts
    │   ├── globals.css
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── Chat.tsx
    │   ├── ChatInput.tsx
    │   └── ChatMessageList.tsx
    ├── lib/
    │   ├── calculator.ts
    │   ├── inventory.ts
    │   ├── inventoryFlow.ts
    │   ├── inventoryIntent.ts
    │   ├── inventoryIntentValidator.ts
    │   ├── llm.ts
    │   └── storageRecommendation.ts
    ├── types/
    │   ├── chat.ts
    │   └── inventory.ts
    └── tests/
        ├── calculator.test.ts
        ├── cancellation.test.ts
        ├── chat-api.test.ts
        ├── inventory.test.ts
        ├── inventoryFlow.test.ts
        ├── inventoryIntent.test.ts
        ├── phase10-e2e.test.ts
        └── storageRecommendation.test.ts
```

Keep the number of files small unless implementation needs otherwise.

---

# 18. What the Prototype Must NOT Claim

Do not claim:

* the exact backend root cause of Stow;
* that MyStorage has a database corruption bug;
* that Redis/session state is responsible;
* that the LLM itself is definitely causing the behavior;
* that the customer was actually overcharged;
* that the prototype reproduces Stow's internal architecture.

The correct framing is:

> The behavior is reproducible through the customer-facing Stow interface. The prototype demonstrates a state-handling design that prevents cancelled response context from influencing subsequent inventory processing.

---

# 19. Build Priority

Build in this order:

```text
1. Chat UI
2. Real LLM + AI thinking state
3. Real Cancel Response (AbortController)
4. canonicalInventory
5. deterministic inventory operations
6. CBM calculator
7. explicit intent extraction
8. deterministic storage recommendation
9. multi-turn clarification
10. regression & E2E validation tests
```

Do not spend time on architecture documentation or UI components before the main interaction works.

The critical path is:

```text
SEND
  ↓
AI IS THINKING...
  ↓
CANCEL
  ↓
SEND NEXT INVENTORY UPDATE
  ↓
CORRECT STATE
  ↓
CORRECT CALCULATION & RECOMMENDATION
```

---

# 20. Definition of Done

The prototype is complete when a reviewer can:

1. open the app;
2. send a natural-language inventory request;
3. see the assistant show "AI is thinking..." and return the completed response;
4. click Cancel Response while it is generating;
5. send an explicit inventory update;
6. see that the cancelled response does not contaminate the new inventory state;
7. test `REPLACE`, `ADD`, and `REMOVE`;
8. see a deterministic CBM estimate based on the resulting inventory;
9. see a deterministic storage unit recommendation without LLM hallucinations;
10. run all regression & end-to-end tests successfully.

