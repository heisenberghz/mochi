# ADR-0003: Main process owns authoritative state

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-10-19 |
| Deciders | Engineering |
| Related | [Architecture overview](../02-architecture/overview.md#6-state-ownership) · [IPC contracts](../02-architecture/ipc-contracts.md) |

## Context

Mochi has two renderers (pet and Den) plus a tray and global shortcuts. State includes a running timer, pet energy/mood/XP, settings, daily aggregates, and window placement. The same state is visible in several places at once, and renderers can reload or crash independently.

If each renderer owns its own copy, the timer will drift, the pet and Den will disagree, and a pet-window reload will lose a focus session. If state is shared through a renderer store, the main process still needs it for the tray, hotkeys, and persistence, creating two authorities.

## Decision

**The main process owns all durable and time-based state.** The renderer is a projection plus ephemeral input.

- Domain logic lives in `src/domain` and is pure TypeScript (no Electron, React, or I/O).
- Application services in main orchestrate the domain and expose typed commands.
- Renderers receive an `AppSnapshot` on bootstrap and ordered `StatePatch` messages with a monotonic revision.
- Renderers send commands; main validates, applies, persists, and broadcasts the resulting state.
- Renderer-only state is limited to hover, pointer capture, bubble presentation, and Den form drafts.

## Alternatives considered

### Renderer-owned state (e.g., Zustand in the pet window)

- **Pros:** simplest data flow; no IPC for state.
- **Cons:** tray/hotkeys need the state too; a renderer reload loses the timer; two windows diverge; persistence lives in the wrong process.
- **Verdict:** rejected.

### Shared store synchronized between renderers

- **Pros:** familiar Redux/CRDT mental model; local reads are fast.
- **Cons:** conflict resolution and serialization are unnecessary complexity for a single-user app; main still needs the state for persistence and OS surfaces; crash recovery remains hard.
- **Verdict:** rejected.

### Event sourcing as the primary model

- **Pros:** auditability, replay, strong recovery story.
- **Cons:** overkill for < 1 MB of data; projection complexity; migration burden; the product has no multi-writer requirement.
- **Verdict:** use a lightweight event log for diagnostics only, not as the state store.

## Consequences

### Positive

- One timer, one pet state, one settings object; every surface converges.
- A renderer crash is recoverable: main retains state and pushes a fresh snapshot.
- Domain logic is trivially unit-testable with injected clock/RNG, without Electron.
- Persistence has a single writer and a single queue.
- Security boundary is clear: renderers cannot mutate state directly.

### Negative / accepted costs

- Every state change crosses IPC; the design must batch/quantize to stay under 10 Hz for patches.
- Main's event loop must stay free; heavy work (export, update check) is async and bounded.
- Renderers need a revision/resync protocol to handle missed patches.
- Den UI cannot use local state as a source of truth, which requires discipline in forms.

### Neutral / follow-ups

- Snapshot sections are complete replacements, avoiding deep-merge bugs.
- Focus completion is emitted both as a patch and an event; duplicates are idempotent by phase id.
- Debug hooks can force behavior for tests but never bypass persistence.

## Validation

- Kill -9 tests recover the timer within ± 2 s and never double-award.
- A patch-gap test drops a message and asserts `app:resync` restores consistency.
- A renderer crash during a focus phase leaves the timer running and the pet returns with the correct posture.
- Domain coverage ≥ 90% with no Electron imports (lint boundary).
