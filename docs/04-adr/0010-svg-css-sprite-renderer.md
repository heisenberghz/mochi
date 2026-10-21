# ADR-0010: The pet is drawn in SVG, not Rive

| Field | Value |
| --- | --- |
| Status | Accepted |
| Version | 1.0 |
| Date | 2026-10-21 |
| Deciders | Engineering |
| Supersedes | [ADR-0002](0002-rive-animation-runtime.md) · [ADR-0004](0004-rive-data-binding.md) |
| Related | [Character art contract](../03-design/character-art-contract.md) · [ADR-0005](0005-transparent-roaming-window.md) · [ADR-0006](0006-click-through-hit-testing.md) |

## Context

[ADR-0002](0002-rive-animation-runtime.md) chose Rive as the pet's animation runtime, and
[ADR-0004](0004-rive-data-binding.md) chose a Rive view model as the way data reaches the
character. Both assumed a **designer** who authors and animates a `.riv` file:

> "The designer can deliver a first `.riv` by the end of week 1."
> — [roadmap](../05-plan/roadmap.md)

Mochi is being built by one person, with no designer and no budget for a Rive subscription.
The Rive plan was written for a team that does not exist here, and the risk register already
named it the single biggest schedule risk.

Meanwhile a working slice was built with the opposite approach: an inline SVG character
animated by CSS keyframes. It renders all eight states, runs fully offline, and needs no
binary asset, no WASM runtime and no extra dependency.

The question was whether to go back to Rive, or to make the SVG approach the decision.

## Decision

**The pet is drawn in SVG and animated with CSS.** The Rive runtime is not used.

- The artwork lives in `assets/pet/mochi.svg`, a plain text file that can be opened in any
  drawing tool and edited directly. It is injected into the page rather than linked, because
  the animations in `pet.css` reach inside it.
- The animation is **code**, in `pet.css`: keyframes, timing tokens and easing tokens. It is
  diffable, reviewable and testable, which a compiled binary is not.
- The **behaviour contract** is unchanged and stays renderer-agnostic. The eight behaviour
  names and the pet's properties — `behavior`, `energy`, `mood`, `facing`, `speed`,
  `accessory`, `reducedMotion` — are the same ones
  [ADR-0004](0004-rive-data-binding.md) specified for the Rive view model.
- The **character art contract**
  ([character-art-contract.md](../03-design/character-art-contract.md)) replaces the Rive
  authoring contract. It holds the anchors, the palette, the layer order and the accessory
  attachment points, and the code reads the same numbers from
  `src/shared/art-anchors.ts`.

## Alternatives considered

### Keep Rive

- **Pros:** real blend trees, computed secondary motion, one file holding both the art and
  the animation, and a designer-authored accessory system.
- **Cons:** needs a designer and a tool subscription; a binary in the repository; a WASM
  runtime in the installer; `wasm-unsafe-eval` in the Content-Security-Policy; the
  character becomes a canvas rectangle, so per-pixel hit-testing is lost; and a contract
  validator in CI to stop the file and the code drifting apart.
- **Verdict:** rejected. Its value is animation craft on a complex character. Mochi is ten
  shapes, and there is no one to author the file.

### Keep the artwork inside the React component

- **Pros:** the colours and anchors could come straight from the code.
- **Cons:** the artwork could only be edited in a text editor, in the middle of application
  logic.
- **Verdict:** rejected. The artwork is a separate artifact and now behaves like one.

### Hand-written SVG animation only, with no contract

- **Pros:** the least machinery of all.
- **Cons:** the artwork and the click target drift apart quietly, which is exactly what
  already happened once with the hand-written hit region.
- **Verdict:** rejected. The contract and the shared anchors are what make the cheap option
  safe.

## Consequences

### Positive

- No binary asset, no WASM runtime, no extra dependency, and no tool subscription.
- The artwork is editable in Figma, Inkscape or a text editor, and exported back to SVG.
- The animation is reviewed like the rest of the code.
- The Content-Security-Policy stays strict with no `wasm-unsafe-eval`.
- The character keeps real SVG DOM structure, so hit regions can follow its shape.

### Negative / accepted costs

- **Secondary motion is hand-coupled.** The scarf and tail are separate CSS loops rather
  than one simulation, and they can drift out of step. The timing tokens keep their periods
  apart.
- **Blending between poses is a swap, not a blend.** Moving from one pose to another is
  abrupt. The contract's per-state poses are the thing to improve here.
- **Every accessory is drawn by hand** in SVG. There is no accessory system, only a
  contract that says where each one hangs.
- **The artwork is not authored by a designer**, and it shows. It will be polished by hand.

### Neutral / follow-ups

- The behaviour names and property names stay as ADR-0004 specified, so a different
  renderer is a new `PetSprite` and not a rewrite of the app.
- If the character ever grows enough to need computed secondary motion — several moving
  parts, a long trailing scarf, more than one character — revisit this with a spike
  rather than a migration.

## Validation

- The artwork is the right size, holds every class the animations hook onto, and is drawn in
  the design system's colours — checked by `src/shared/art-file.test.ts`.
- The click target is derived from the artwork, and a live guard fails the smoke run if the
  two drift apart.
- The animation timings are checked against the motion spec in
  [visual-and-motion.md](../03-design/visual-and-motion.md).

## References

- [ADR-0002](0002-rive-animation-runtime.md) and
  [ADR-0004](0004-rive-data-binding.md) — the decisions this replaces.
- [Rive authoring contract](../03-design/rive-authoring-contract.md) — replaced by the
  character art contract.
- [Risk register R-02](../05-plan/risk-register.md) — the risk this closes.
