# Architecture Decision Records

An ADR captures a decision that is expensive to reverse, the context that justified it, and what we accepted as a consequence. ADRs are immutable: to change a decision, add a new ADR with `Supersedes: ADR-XXXX` and update the index status.

| ADR | Decision | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-electron-react-typescript.md) | Electron + React + TypeScript for the Windows desktop shell | Accepted | 2026-10-19 |
| [0002](0002-rive-animation-runtime.md) | Rive as the pet animation runtime | Accepted | 2026-10-19 |
| [0003](0003-main-process-authority.md) | Main process owns authoritative state | Accepted | 2026-10-19 |
| [0004](0004-rive-data-binding.md) | Rive view-model data binding, not state-machine inputs | Accepted | 2026-10-19 |
| [0005](0005-transparent-roaming-window.md) | Tight transparent window with a native motion driver | Accepted (validate in S1) | 2026-10-19 |
| [0006](0006-click-through-hit-testing.md) | Renderer ellipse hit testing with forwarded mouse events | Accepted (validate in S1) | 2026-10-19 |
| [0007](0007-versioned-json-store.md) | Versioned JSON document store with atomic writes | Accepted | 2026-10-19 |
| [0008](0008-packaging-signing-updates.md) | electron-builder NSIS, signed, staged auto-updates | Accepted (O-2/O-3 open) | 2026-10-19 |
| [0009](0009-privacy-first-observability.md) | Local-first observability, no telemetry by default | Accepted | 2026-10-19 |

## Template

```markdown
# ADR-XXXX: Title

| Field | Value |
| --- | --- |
| Status | Proposed / Accepted / Superseded by ADR-YYYY |
| Date | YYYY-MM-DD |
| Deciders | Names/roles |
| Related | Links |

## Context
The forces at play: product constraints, platform facts, team shape, deadlines.

## Decision
The choice, stated in one unambiguous paragraph.

## Alternatives considered
Each option, with the reason it was not chosen.

## Consequences
### Positive
### Negative / accepted costs
### Neutral / follow-ups

## Validation
How we will know the decision was right, and what would trigger a revisit.

## References
Verified sources, spikes, measurements.
```

## Conventions

- One decision per ADR; do not bundle unrelated choices.
- State platform facts with a source in [References](../06-appendix/references.md) when they are version-specific.
- "Accepted" does not mean risk-free; the negative consequences are part of the record.
- A spike may be a prerequisite. Mark the ADR "Accepted (validate in S1)" until the spike closes.
