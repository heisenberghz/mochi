# ADR-0004: Rive view-model data binding, not state-machine inputs

| Field | Value |
| --- | --- |
| Status | **Superseded by [ADR-0010](0010-svg-css-sprite-renderer.md)** |
| Date | 2026-10-19 |
| Deciders | Engineering, Design |
| Related | [Animation system](../02-architecture/animation-system.md#5-the-view-model-contract) · [Rive contract](../03-design/rive-authoring-contract.md#2-view-model) · [ADR-0002](0002-rive-animation-runtime.md) |

## Context

Rive offers two ways to drive a state machine from code:

1. **State-machine inputs** (boolean/number/trigger) accessed by name.
2. **Data binding / view models**: typed properties on a `ViewModelInstance`, which can drive transitions and artboard properties.

The installed runtime (`@rive-app/canvas` 2.45.0, React wrapper 4.37.0) marks state-machine inputs as **deprecated** in its type definitions and points to data binding as the replacement. The React package exposes `useViewModel`, `useViewModelInstance`, and typed hooks for enum/number/boolean/trigger/color properties.

The pet has many related values (behavior, energy, mood, speed, facing, theme, accessory, reduced motion, low power). Using two mechanisms would create two sources of truth and a confusing authoring contract.

## Decision

Use **Rive view models exclusively** in v1.

- One global view model, `PetModel`, with typed properties defined in the [contract](../03-design/rive-authoring-contract.md).
- The state machine reads view-model values in transition conditions; artboard properties are bound where appropriate.
- No state-machine inputs are authored or read. The bridge does not call `stateMachineInputs()`.
- Triggers (`poke`, `pet`, `nudge`) are view-model trigger properties, not state-machine trigger inputs.

## Alternatives considered

### State-machine inputs only

- **Pros:** widely documented, simple `useStateMachineInput` hook, works with older Rive files.
- **Cons:** deprecated; untyped names; no enum support; no direct binding to artboard properties; accessories/theme require extra boolean/number inputs; more bridge code.
- **Verdict:** rejected for a new project.

### Hybrid (inputs for behavior, view model for presentation data)

- **Pros:** could ease a migration or reuse an existing asset.
- **Cons:** two sources of truth; designers must wire both; hard to validate; confusing ownership.
- **Verdict:** rejected. If an asset requires inputs temporarily, it is a one-off during authoring, not shipped.

### Playing named animations directly (no state machine)

- **Pros:** simple.
- **Cons:** no blending, no layered idle, no triggers, no data-driven transitions; would reimplement a state machine in React.
- **Verdict:** rejected.

## Consequences

### Positive

- One typed, validated interface for every value the pet needs.
- Enums make behavior/accessory/theme explicit and impossible to misspell at runtime (CI catches drift).
- Data binding lets design bind energy/mood to artboard properties without engineering mapping each one.
- Aligns with Rive's roadmap; no migration debt at v1.
- The bridge is smaller and more declarative.

### Negative / accepted costs

- Requires a Rive file authored with view models and data binding; the designer must learn/use the feature.
- Requires runtime ≥ 4.37 for the hooks; older runtimes are unsupported.
- The view model is a string-keyed contract at runtime; CI validation is mandatory.
- Some advanced state-machine patterns may still be easier with inputs; design must stay within the contract.

### Neutral / follow-ups

- A legacy input fallback is **not** implemented. A contract mismatch shows the static silhouette, not a half-working pet.
- If Rive changes data-binding APIs, the adapter (`usePetViewModel`) isolates the migration.
- The CI validator introspects `ViewModel.properties` and smoke-tests enum values; names/types are contractual.

## Validation

- CI validator fails on a missing/renamed property or enum value.
- Forcing each behavior through the view model reaches a known state within 1 s.
- The bridge's ack includes the Rive state; a 2 s timeout triggers fallback.
- No `stateMachineInputs` call exists in the codebase (lint/review check).
