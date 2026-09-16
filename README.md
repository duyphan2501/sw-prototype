# MyStorage Inventory Cancellation Fix Prototype

A minimal Next.js prototype investigating a stale-inventory behavior observed in the MyStorage AI assistant after an in-progress response is cancelled.

## Core finding

After cancellation, a subsequent inventory statement can retain influence from previously mentioned inventory, unlike the equivalent normal flow.

## Core fix

Separate:

- conversation context
- temporary response-generation state
- canonical inventory state

Invariant:

> Cancelled assistant generation must never mutate canonical inventory.

## Architecture

```text
User
 ↓
Next.js UI
 ↓
Intent Resolver
 ↓
Validation
 ↓
Deterministic Inventory State Manager
 ↓
Canonical Inventory
 ↓
CBM Calculator
```

## Development

```bash
npm install
npm run dev
```

Run tests:

```bash
npm test
```

## AI-assisted development

Development uses Antigravity and AI coding assistance.

Every AI-generated change is reviewed line-by-line. Important accepted, rejected, and rewritten changes are recorded in:

`docs/phase-05-ai-review.md`

## Prototype limitation

This is a behavioral reproduction and engineering prototype. It does not claim to reproduce MyStorage's internal production implementation or pricing engine.
