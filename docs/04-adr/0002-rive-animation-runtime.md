# ADR-0002: Rive as the pet animation runtime

| Field | Value |
| --- | --- |
| Status | **Superseded by [ADR-0010](0010-svg-css-sprite-renderer.md)** |
| Version | 1.0 |
| Date | 2026-10-19 |
| Deciders | Design, Engineering |
| Related | [Animation system](../02-architecture/animation-system.md) · [Rive contract](../03-design/rive-authoring-contract.md) · [ADR-0004](0004-rive-data-binding.md) |

## Context

The pet is the product. Its animation must:

- Support layered idle motion (breathing, blinking, ear/tail follow-through) that never looks frozen.
- Blend between locomotion, sleep, focus, celebration, and drag states without hard cuts.
- React to data (energy, mood, speed, theme, accessories) without engineering authoring every variant.
- Run at 60 fps in a 200×220 transparent window with a low idle cost.
- Be authored by a designer without a game engine or a rigging pipeline.
- Ship offline, with no remote asset fetch.

## Decision

Use **Rive** (`@rive-app/react-canvas` 4.37.0, runtime 2.45.0) for all pet animation. The `.riv` is a versioned artifact with a contractual artboard, state machine, and view model. Engineering drives macro-state through the view model; Rive owns breathing, blinking, secondary motion, and transition craft.

## Alternatives considered

### Spritesheet + custom animator

- **Pros:** complete control, simple runtime, easy to source pixel art.
- **Cons:** large atlases for 8 states × DPI variants, no vector crispness, hand-written state machine/blending, expensive to iterate, poor at 200% scaling.
- **Verdict:** viable for pixel art but worse fit for a soft vector character and a small team.

### Lottie / dotLottie

- **Pros:** After Effects pipeline, widely available animators, small files.
- **Cons:** weak state-machine and interactivity model; blending and data binding require custom code; dynamic accessories/theme variants multiply files; not designed for continuous character state.
- **Verdict:** good for one-shot UI motion, not a living character.

### Procedural SVG/Canvas

- **Pros:** no external art, tiny, fully dynamic.
- **Cons:** reaching "high-class character charm" requires a rig and animation system we would have to build; designer iteration is poor.
- **Verdict:** rejected for v1.

### Unity / Godot embedded

- **Pros:** powerful animation and rigging.
- **Cons:** huge runtime, awkward desktop overlay integration, overkill for one character.
- **Verdict:** rejected.

## Consequences

### Positive

- State machines + view-model data binding map directly to our behavior director.
- Vector art stays crisp at 100–200% DPI and is cheap to re-color for themes.
- The runtime is small (WASM ~2 MB) and offline-friendly when bundled.
- Design can iterate on motion without engineering changing renderer code.
- A CI validator can assert the artboard/state/view-model contract.

### Negative / accepted costs

- A designer dependency and a binary asset in Git; design delays block the feel work.
- Rive's editor is a subscription; the runtime is free, but the team must budget for the editor.
- Canvas2D rendering may miss frame budgets on weak GPUs; WebGL2 is a fallback but changes GPU risk.
- Data-binding behavior must be validated at runtime; names are strings until CI checks them.
- The `.riv` is a security-relevant asset; user-supplied files are not supported in v1.

### Neutral / follow-ups

- Bundle `rive.wasm` and `rive_fallback.wasm` locally; disable the Rive CDN.
- Pin the runtime; contract-test every asset change.
- Keep the runtime behind an adapter (`RiveStage`, `usePetViewModel`) so a WebGL2 swap or a future engine does not touch the app.

## Validation

- Contract validator passes on every asset PR.
- Visual goldens for static poses at DPR 1/1.5/2.
- S1/S3 measure frame pacing and idle CPU with the real asset.
- A 10-second behavior reel is reviewed by design/engineering before merge.
- If Canvas2D misses the guardrail on low-end hardware, evaluate `@rive-app/react-webgl2` and record a follow-up ADR.

## References

- Rive React package `@rive-app/react-canvas` 4.37.0, runtime `@rive-app/canvas` 2.45.0 (verified 2026-10-19).
- Rive runtime APIs inspected: `useRive`, `useViewModel`, `useViewModelInstance*`, `RuntimeLoader.setWasmUrl`, `Rive.contents`, `ViewModel.properties`.
