# MyStorage Inventory Cancellation Fix — Gemini.md

## 1. Project Context

This prototype investigates and fixes a black-box behavior observed in the MyStorage AI assistant:

> After an in-progress assistant response is cancelled, a subsequent inventory statement can retain stale previously mentioned inventory in the primary storage estimate.

The finding was validated with an A/B control:

- Normal flow: initial full inventory → assistant completes → exact same new inventory statement → new inventory is treated as current.
- Cancel flow: initial full inventory → assistant response is cancelled → exact same new inventory statement → previously mentioned inventory remains influential in the primary estimate.
- Explicit modification control: an explicit instruction such as "Update my inventory. Remove..." is handled correctly.

The prototype must reproduce the behavioral distinction and demonstrate a safer state-management design.

## 2. Core Engineering Principle

Separate:

1. Conversation context
2. Assistant response generation state
3. Canonical business state (inventory)

A cancelled assistant response must not mutate canonical inventory and must not leave an uncommitted generation state that affects the next inventory assessment.

### Invariant

```text
Cancelled assistant generation MUST NOT mutate canonical inventory state.
```

This is the primary invariant tested by the prototype.

## 3. Technology

Use a single Next.js application.

- Next.js
- TypeScript
- App Router
- React
- API Route / Route Handler for server-side logic
- Vitest for unit tests
- No database required
- No Redis required
- In-memory/session state is sufficient for the prototype
- Antigravity is the development environment
- Gemini/LLM may be used only for intent extraction; deterministic application code owns state mutation

Do not introduce unnecessary infrastructure.

## 4. Architecture

```text
                    ┌─────────────────────┐
                    │      Next.js UI     │
                    │ Chat + Inventory UI │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │   Chat Route/Service│
                    └──────────┬──────────┘
                               │
                 ┌─────────────┴─────────────┐
                 │                           │
                 ▼                           ▼
       ┌───────────────────┐       ┌────────────────────┐
       │ Generation State  │       │ Inventory Resolver │
       │ temporary only    │       │ REPLACE/ADD/REMOVE │
       └─────────┬─────────┘       │ /UNCLEAR           │
                 │                 └─────────┬──────────┘
                 │                           │
          cancel/discard                     ▼
                 │                 ┌────────────────────┐
                 X                 │ Inventory State    │
                                   │ Manager            │
                                   └─────────┬──────────┘
                                             │
                                             ▼
                                   ┌────────────────────┐
                                   │ Canonical Inventory│
                                   └─────────┬──────────┘
                                             │
                                             ▼
                                   ┌────────────────────┐
                                   │ Deterministic CBM  │
                                   │ Calculator (mock)  │
                                   └────────────────────┘
```

## 5. Domain Model

### InventoryItem

```ts
type InventoryItem = {
  name: string;
  quantity: number;
};
```

### InventoryIntent

```ts
type InventoryIntent =
  | "REPLACE"
  | "ADD"
  | "REMOVE"
  | "UNCLEAR";
```

### ResolvedInventoryIntent

```ts
type ResolvedInventoryIntent = {
  intent: InventoryIntent;
  items: InventoryItem[];
  confidence?: number;
  reason?: string;
};
```

### Session State

Conceptually:

```ts
type SessionState = {
  canonicalInventory: InventoryItem[];
  generation?: {
    id: string;
    status: "GENERATING";
    temporaryContext: unknown;
  };
};
```

Do not persist cancelled generation state as canonical business state.

## 6. Inventory Semantics

### REPLACE

Example:

> I need to store 10 boxes and 1 queen-size bed.

Replace the previous inventory.

### ADD

Example:

> Also add 5 boxes.

Append/increment the requested items.

### REMOVE

Example:

> Remove the wardrobe.

Remove/decrement the requested items.

### UNCLEAR

Example:

> I need to store 10 boxes and a sofa.

When context makes both replacement and addition plausible, do not silently choose one if the prototype cannot establish the intended semantics.

Ask:

> Should I replace your previous inventory with these items, or add them to it?

No state mutation occurs for UNCLEAR.

## 7. Important Design Constraint

Do NOT implement:

```text
Every inventory-looking message = REPLACE
```

That would fix the reproduced case while breaking legitimate additive updates.

Do NOT implement:

```text
Cancel = clear all conversation context
```

That would throw away useful conversational context.

Instead:

```text
Conversation context can survive.
Uncommitted generation state cannot become canonical inventory.
Inventory mutation requires explicit resolved semantics.
```

## 8. LLM Boundary

If an LLM is used:

```text
User message
    ↓
LLM intent extraction
    ↓
Structured JSON
    ↓
Application validation
    ↓
Deterministic state mutation
    ↓
Canonical inventory
```

The LLM must not directly mutate application state.

The application should validate:

- allowed intent
- valid item names
- positive quantities
- required fields
- supported operation

If LLM output is invalid, return a controlled clarification/fallback.

## 9. Prototype Calculator

The calculator is a deterministic demonstration component, NOT a claim about MyStorage's production calculation engine.

Suggested values:

```text
queen-size bed        2.5 CBM
three-seat sofa       2.0 CBM
wardrobe              1.5 CBM
dining table + chairs 2.0 CBM
box                   0.1 CBM
```

The purpose is to make stale-state impact visible.

Example:

```text
10 boxes + queen-size bed
= 1.0 + 2.5
= 3.5 CBM
```

## 10. UI Requirements

Build a minimal but clear demo.

Show:

- Chat transcript
- Cancel response button
- Current canonical inventory
- Estimated CBM
- Current implementation mode: Before Fix / After Fix
- Optional event/state log for demonstration

The UI should make it obvious whether the inventory changed after cancellation.

## 11. Before-Fix Simulation

The prototype should include a controlled simulation of the observed bug.

Before Fix:

```text
Initial inventory
    ↓
Assistant starts response
    ↓
Cancel
    ↓
Next inventory message
    ↓
Stale previous inventory influences estimate
```

This is a reproduction model, not a claim that the prototype contains MyStorage's actual source code.

## 12. After-Fix Behavior

After Fix:

```text
Initial inventory
    ↓
Assistant starts response
    ↓
Cancel
    ↓
Canonical inventory remains unchanged
    ↓
Next inventory message
    ↓
Resolve intent
    ↓
Commit new canonical inventory
    ↓
Calculate estimate
```

## 13. What NOT to Build

Do not build:

- authentication
- production database
- payment
- real booking
- full MyStorage clone
- production pricing engine
- fine-tuned model
- autonomous agent loop
- unnecessary microservices
- unnecessary state-management framework

## 14. Testing Strategy

Required tests:

1. Normal replacement
2. Cancelled generation does not mutate canonical inventory
3. Explicit replacement
4. ADD semantics
5. REMOVE semantics
6. UNCLEAR does not mutate state
7. Calculator uses canonical inventory only

The key regression test is:

```text
same initial inventory
+
same exact subsequent user message
+
only difference = response cancelled
```

The after-fix implementation must produce equivalent inventory semantics in both flows.

## 15. AI Coding Workflow Requirement

The assignment explicitly asks:

> Tell us what Claude Code produced that you rejected or rewrote, and why.

Even though development is done in Antigravity, preserve the same discipline:

- Ask Gemini/AI to implement a bounded task.
- Read every changed line.
- Run tests.
- Reject unsafe or over-broad implementation.
- Rewrite when architecture or behavior is wrong.
- Record important AI decisions in `docs/ai-review-log.md`.

Do not claim code was manually written if AI generated it.

The final report should contain concrete examples of:

```text
AI suggestion
→ Review
→ Accepted / Rejected / Rewritten
→ Technical reason
→ Test/evidence
```

## 16. Definition of Done

The prototype is complete when:

- `npm test` passes.
- Normal flow works.
- Cancel flow no longer causes stale canonical inventory.
- ADD and REMOVE semantics work.
- Ambiguous intent does not silently mutate state.
- UI demonstrates before/after behavior.
- README explains architecture and limitation.
- AI review log documents rejected/rewritten AI-generated code.
