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
* streaming assistant response;
* real Cancel Response interaction;
* structured inventory intent extraction;
* deterministic inventory state mutation;
* deterministic CBM calculation;
* regression tests.

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
                    ┌───────────────┐
                    │   Chat UI     │
                    └───────┬───────┘
                            │
                            ▼
                    ┌───────────────┐
                    │      LLM      │
                    │ Intent + Text │
                    └───────┬───────┘
                            │
                    structured intent
                            │
                            ▼
                  ┌───────────────────┐
                  │ Inventory State   │
                  │ deterministic     │
                  └─────────┬─────────┘
                            │
                  canonical inventory
                            │
                            ▼
                  ┌───────────────────┐
                  │  CBM Calculator   │
                  │ deterministic     │
                  └─────────┬─────────┘
                            │
                            ▼
                         Estimate
                            │
                            ▼
                           LLM
                            │
                       stream response
                            │
                            ▼
                         Chat UI
```

The LLM must NOT directly mutate business state.

---

# 5. State Model

Only two state concepts are required.

## canonicalInventory

The authoritative business inventory.

```ts
canonicalInventory: InventoryItem[]
```

This is the only inventory state used by the calculator.

## pendingGeneration

Temporary state associated with the currently generating assistant response.

```ts
pendingGeneration: {
  status: "generating" | "cancelled" | "completed"
  ...
} | null
```

Do not create unnecessary abstractions for conversation state, lifecycle state, policy state, etc.

The prototype only needs enough state to demonstrate the invariant.

---

# 6. Cancellation Invariant

The central invariant is:

> Cancelling an assistant response must not allow temporary generation state to influence subsequent inventory processing.

When the user clicks Cancel:

```text
active LLM stream
       ↓
Abort
       ↓
discard pendingGeneration
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
      "name": "queen-size bed",
      "quantity": 1
    },
    {
      "name": "three-seat sofa",
      "quantity": 1
    }
  ]
}
```

### B. Generate the natural-language assistant response

The response can be streamed to the UI.

## LLM must NOT

* directly mutate canonical inventory;
* decide authoritative CBM;
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

> "I need to store a bed and sofa."

If the system cannot determine whether the user intends to replace the existing inventory or add to it, it should not silently mutate state.

It may ask for clarification.

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
Deterministic inventory operation
      ↓
canonicalInventory
      ↓
CBM calculation
      ↓
LLM response
```

The LLM output is untrusted input.

The application must validate the structured intent before applying it.

---

# 10. CBM Calculator

Use a deterministic mock calculator.

The purpose is to demonstrate the business consequence of stale inventory, not to reproduce MyStorage's internal pricing calculator.

Example volume assumptions:

```text
queen-size bed           2.5 CBM
three-seat sofa          2.0 CBM
wardrobe                 1.5 CBM
dining table + 4 chairs  2.0 CBM
box                      0.1 CBM
```

The calculator must only receive:

```ts
canonicalInventory
```

It must never receive raw conversation history or stale generation context.

---

# 11. Cancellation / Streaming

The Cancel Response button must perform a real cancellation of the active generation.

Use an abort mechanism such as `AbortController`.

Conceptually:

```text
Send
 ↓
start LLM stream
 ↓
display streamed response
 ↓
show "Cancel Response"
 ↓
user clicks Cancel
 ↓
abort active request
 ↓
discard pendingGeneration
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
│ Assistant response...                │
│                                      │
│        [ Cancel Response ]            │
│                                      │
│                                      │
├──────────────────────────────────────┤
│ Type your message...             Send│
└──────────────────────────────────────┘
```

Required interactions:

* send message;
* streaming response;
* Cancel Response while generating;
* send another message after cancellation;
* reset conversation.

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

# 17. Suggested Project Structure

```text
src/
├── app/
│   └── page.tsx
│
├── components/
│   └── Chat.tsx
│
├── lib/
│   ├── inventory.ts
│   ├── parser.ts
│   ├── calculator.ts
│   └── llm.ts
│
└── types.ts

tests/
├── inventory.test.ts
└── cancellation.test.ts
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
2. LLM streaming
3. Real Cancel Response
4. canonicalInventory
5. deterministic inventory operations
6. CBM calculator
7. explicit intent extraction
8. regression tests
9. visual polish
```

Do not spend time on architecture documentation or UI components before the main interaction works.

The critical path is:

```text
SEND
  ↓
STREAM
  ↓
CANCEL
  ↓
SEND NEXT INVENTORY UPDATE
  ↓
CORRECT STATE
  ↓
CORRECT CALCULATION
```

---

# 20. Definition of Done

The prototype is complete when a reviewer can:

1. open the app;
2. send a natural-language inventory request;
3. see the assistant stream a response;
4. click Cancel Response while it is generating;
5. send an explicit inventory update;
6. see that the cancelled response does not contaminate the new inventory state;
7. test `REPLACE`, `ADD`, and `REMOVE`;
8. see a deterministic CBM estimate based on the resulting inventory;
9. run the regression tests successfully.

The prototype should be small enough to explain in a few minutes and clear enough that the reviewer can immediately connect:

```text
REAL STOW FINDING
       ↓
STATE INVARIANT
       ↓
PROPOSED FIX
       ↓
WORKING PROTOTYPE
       ↓
REGRESSION TESTS
```
