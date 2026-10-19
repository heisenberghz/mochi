# Mochi — Documentation Index

This directory is the complete specification for Mochi v1. It is written to be executable: a new engineer or designer should be able to start work without a synchronous handoff.

**Spec version:** 1.0 · **Last updated:** 2026-10-19 · **Owner:** Product/Architecture

## Reading paths

### If you are implementing

1. [PRD](01-product/prd.md) — what we are building and why (15 min)
2. [Requirements](01-product/requirements.md) — the contract you must satisfy (20 min)
3. [Architecture overview](02-architecture/overview.md) — module boundaries and constants (20 min)
4. Your area: [desktop shell](02-architecture/desktop-shell.md), [behavior](02-architecture/behavior-engine.md), [animation](02-architecture/animation-system.md), [focus](02-architecture/focus-engine.md), [data](02-architecture/data-and-persistence.md), [IPC](02-architecture/ipc-contracts.md)
5. [Test strategy](05-plan/test-strategy.md) and the [roadmap](05-plan/roadmap.md) for your phase.

### If you are designing the pet

1. [Experience spec](03-design/experience-spec.md) — how Mochi should feel.
2. [Visual & motion system](03-design/visual-and-motion.md) — art direction, palette, timing rules.
3. [Rive authoring contract](03-design/rive-authoring-contract.md) — the exact interface engineering expects.
4. [Animation system](02-architecture/animation-system.md#6-bridge-protocol) — how your file is loaded and driven.

### If you are reviewing or funding

1. [PRD](01-product/prd.md) — problem, bet, success metrics.
2. [Roadmap](05-plan/roadmap.md) — phases, effort, release gates.
3. [Risk register](05-plan/risk-register.md) — what could go wrong and what we are doing about it.
4. [ADRs](04-adr/README.md) — the decisions that constrain cost and quality.

## Document set

| # | Document | Status | Primary audience |
| --- | --- | --- | --- |
| 1 | [PRD](01-product/prd.md) | ✅ Approved for build | All |
| 2 | [Requirements & NFRs](01-product/requirements.md) | ✅ Approved for build | Eng, QA |
| 3 | [Architecture overview](02-architecture/overview.md) | ✅ Approved for build | Eng |
| 4 | [Desktop shell & Windows integration](02-architecture/desktop-shell.md) | ⚠️ Validate in Spike S1 | Eng |
| 5 | [Behavior engine](02-architecture/behavior-engine.md) | ✅ Approved for build | Eng, Design |
| 6 | [Animation system](02-architecture/animation-system.md) | ✅ Approved for build | Eng, Design |
| 7 | [Focus engine](02-architecture/focus-engine.md) | ✅ Approved for build | Eng, Product |
| 8 | [Data & persistence](02-architecture/data-and-persistence.md) | ✅ Approved for build | Eng |
| 9 | [IPC contracts](02-architecture/ipc-contracts.md) | ✅ Approved for build | Eng |
| 10 | [Security & privacy](02-architecture/security-and-privacy.md) | ✅ Approved for build | Eng, Security |
| 11 | [Performance & reliability](02-architecture/performance-and-reliability.md) | ⚠️ Budgets pending S1/S3 measurements | Eng |
| 12 | [Experience spec](03-design/experience-spec.md) | ✅ Approved for build | Design, Eng |
| 13 | [Visual & motion system](03-design/visual-and-motion.md) | 🟡 Awaiting character sign-off | Design |
| 14 | [Rive authoring contract](03-design/rive-authoring-contract.md) | 🟡 Awaiting first asset | Design, Eng |
| 15 | [ADRs](04-adr/README.md) | ✅ Accepted (except noted) | Eng |
| 16 | [Roadmap](05-plan/roadmap.md) | ✅ Approved | All |
| 17 | [Test strategy](05-plan/test-strategy.md) | ✅ Approved | Eng, QA |
| 18 | [Risk register](05-plan/risk-register.md) | ✅ Living document | All |
| 19 | [Glossary](06-appendix/glossary.md) | ✅ Living document | All |
| 20 | [References](06-appendix/references.md) | ✅ Living document | Eng |

**Status legend:** ✅ approved · ⚠️ needs a spike before freeze · 🟡 blocked on an external deliverable · 🔴 open decision.

## Conventions

### Requirement IDs

- `FR-<AREA>-<n>` — functional requirement. Areas: `WIN` (window/OS), `ANI` (animation/behavior), `INT` (interaction), `FOC` (focus), `DAT` (data/settings), `DEN` (Den UI), `OPS` (packaging/updates).
- `NFR-<AREA>-<n>` — non-functional requirement. Areas: `PERF`, `REL`, `SEC`, `PRIV`, `A11Y`, `MAINT`, `COMPAT`.
- `AC-<n>` — acceptance criterion that spans features.
- IDs are stable. Removing a requirement means marking it **Dropped** with a reason, not renumbering.

### Normative language

`MUST`, `MUST NOT`, `SHOULD`, and `MAY` follow RFC 2119. Anything without one of these keywords is explanatory.

### Constants

Numeric constants that appear in more than one document are defined once in [Architecture overview → System constants](02-architecture/overview.md#8-system-constants). If a spec disagrees with that table, the table wins until amended by an ADR.

### Decision records

Architecture decisions use the [ADR template](04-adr/README.md#template). An accepted ADR is not edited; a replacement gets a new number and a `Supersedes` line.

### Diagram style

Mermaid is used for state machines and sequence flows so diagrams render in GitHub and most IDEs. Tables are preferred for contracts because they are diffable and testable.

## Open decisions

| ID | Question | Owner | Needed by |
| --- | --- | --- | --- |
| O-1 | Final character design and name (working name: Mochi) | Design/Product | End of Phase 0 |
| O-2 | Auto-update hosting: public GitHub Releases vs. object storage + generic provider | Eng | Phase 3 |
| O-3 | Code-signing provider and certificate budget | Product/Eng | Phase 3 |
| O-4 | Whether Windows 10 22H2 is a supported tier or best-effort | Product | Phase 1 |
| O-5 | Sound on by default vs. muted until first interaction | Design | Phase 1 |
| O-6 | Localization for v1 (English-only proposed) | Product | Phase 2 |
| O-7 | Cosmetics monetization (none in v1) | Product | Post-launch |

Open decisions are tracked in the [PRD](01-product/prd.md#13-open-questions) with context. This table is the quick status view.

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-10-19 | Initial specification set |
