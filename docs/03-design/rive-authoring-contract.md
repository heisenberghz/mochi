# Rive Authoring Contract

| Field | Value |
| --- | --- |
| Contract version | 1 |
| Status | Awaiting first asset (O-1) |
| Date | 2026-10-19 |
| Owner | Design (asset) · Engineering (interface) |
| Related | [Animation system](../02-architecture/animation-system.md) · [Visual & motion](visual-and-motion.md) · [ADR-0004](../04-adr/0004-rive-data-binding.md) |

This is the interface between the Rive file and the application. Names, types, ranges, states, and events in this document are **contractual**. The CI validator fails if the shipped `.riv` does not match. Design owns motion and expression inside these boundaries; engineering owns when and why a state is requested.

## 1. File and artboard

| Item | Required value |
| --- | --- |
| File | `assets/rive/mochi.riv` |
| Artboard | `Mochi` |
| Artboard size | 200 × 220 (Rive units = DIP at 100%) |
| State machine | `PetSM` |
| Global view model | `PetModel` |
| Runtime | Rive React 4.37.0 / Canvas runtime 2.45.0 |
| File size budget | ≤ 2.5 MB |
| Embedded rasters | None, or ≤ 512 × 512 each; prefer vector |
| Text | None (all copy is HTML) |
| Audio | None (sound is app-level) |
| Scripts/editor-only features | None |

### 1.1 Layout anchors (artboard coordinates, origin top-left)

| Anchor | Position | Notes |
| --- | --- | --- |
| Character center X | 100 | Facing flips around this axis |
| Head center | (100, 78) | Eyes at y ≈ 76 |
| Body center | (100, 142) | Belly |
| Feet / ground contact | y = 212 | Contact shadow at y = 216 |
| Tail root | (156, 160) | Curls right, stays inside 200 width |
| Ear tips | y ≈ 34 | Highest point in idle; wave may lift to 30 |
| Scarf knot | (100, 120) | Attach point `attach_neck` |
| Head attach | (100, 44) | `attach_head` (leaf hat) |
| Face attach | (100, 76) | `attach_face` (glasses) |
| Right paw attach | (146, 176) | `attach_paw_right` (mug) |
| Ground attach | (100, 216) | `attach_ground` (bed) |

No visible art may extend outside the 200 × 220 artboard in any core state. Shadows, scarf tips, and particles must stay inside; the renderer clips at the canvas, but clipping reads as a bug.

### 1.2 Draw order / layers

From back to front:

1. `GroundFX` — contact shadow (only if used), bed, ground sparkles
2. `Tail`
3. `Body`
4. `ScarfBack`
5. `Head`
6. `Face` — eyes, mouth, blush, glasses
7. `ScarfFront` — loose end with follow-through
8. `AccessoryFront` — leaf hat, mug
9. `FX` — Zzz, confetti, sparkles (disabled in low power)
10. `Outline` — only visible in high contrast

## 2. View model

Global view model name: **`PetModel`**. All properties are top-level (no nested view models in v1). Engineering sets these via Rive React hooks; design binds them in the editor.

| Property | Type | Default | Range / values | Bound to | Notes |
| --- | --- | --- | --- | --- | --- |
| `behavior` | Enum `Behavior` | `Idle` | `Idle`, `Walk`, `Sleep`, `Wake`, `Wave`, `Focus`, `Celebrate`, `Drag` | State machine transitions | Required |
| `energy` | Number | 80 | 0–100 | Eyelid heaviness, posture slump, idle variation | Continuous |
| `mood` | Number | 70 | 0–100 | Mouth curve, ear angle, tail energy, celebration intensity | Continuous |
| `speed` | Number | 0 | 0–1 | Walk cycle rate / lean | 0 = stationary |
| `facing` | Number | 1 | −1 or 1 | Artboard horizontal scale / tail direction | Never 0 |
| `reducedMotion` | Boolean | false | — | Motion variants, particles off | Accessibility |
| `lowPower` | Boolean | false | — | FX off, footstep events off | Battery |
| `accessory` | Enum `Accessory` | `None` | `None`, `ScarfMoss`, `ScarfSky`, `Glasses`, `LeafHat`, `Bed`, `AuroraScarf`, `Mug` | Accessory visibility/color | `None` = default scarf |
| `theme` | Enum `Theme` | `Light` | `Light`, `Dark`, `HighContrast` | Palette set, outline visibility | Instant switch |
| `poke` | Trigger | — | — | Happy squish reaction | Idle/Wake/Walk only |
| `pet` | Trigger | — | — | Petting/purr pose | Idle/Walk only |
| `nudge` | Trigger | — | — | 2 s look-up during Focus | Focus only |
| `microStretch` | Trigger (optional) | — | — | Stretch one-shot during Idle | Optional channel |
| `microYawn` | Trigger (optional) | — | — | Yawn one-shot during Idle | Optional channel |
| `microLook` | Trigger (optional) | — | — | Look-around one-shot during Idle | Optional channel |

### 2.1 Rules

- **No state-machine inputs.** Use view-model properties only. Mixing inputs and data binding creates two sources of truth and inputs are deprecated by Rive.
- Property names are case-sensitive and must match exactly.
- Enum value spelling and order are contractual for the CI validator; do not rename.
- Triggers are fire-and-forget; the state machine must return to its current state automatically. A trigger must never leave the pet in a one-shot state.
- `speed` must not advance the walk cycle when `behavior != Walk`; the walk clip is paused otherwise.
- `facing` changes only when stationary or at the start of a walk. Flipping mid-stride is a bug.
- `energy`/`mood` changes must be damped inside Rive (or applied over ≥ 200 ms) so a 0.5 Hz update does not pop.
- `theme` switching must not flash; colors are bound, not animated over 1 s.

## 3. State machine `PetSM`

### 3.1 States

| State | Loop | Purpose |
| --- | --- | --- |
| `Idle` | Yes | Breathing, blinking, idle variants (sit, look, stretch, yawn) |
| `Walk` | Yes | Locomotion cycle; speed/facing driven |
| `Sleep` | Yes | Curled sleep, slow breath, Zzz |
| `Wake` | No | Stretch and sit up |
| `Wave` | No | Greeting one-shot |
| `Focus` | Yes | Upright posture, glasses, slower breath; `nudge` sub-state |
| `Celebrate` | No | Squash-stretch, scarf lift, particles |
| `Drag` | Yes | Dangling sway |

### 3.2 Transitions

Conditions are view-model values unless stated. Blend times are targets; exact curves are design-owned but must not exceed the listed blend.

| From | To | Condition | Blend | Notes |
| --- | --- | --- | --- | --- |
| `Idle` | `Walk` | `behavior == Walk` | 0.18 s | Start on a contact frame |
| `Walk` | `Idle` | `behavior == Idle` | 0.18 s | Finish the current step if possible |
| `Idle` | `Sleep` | `behavior == Sleep` | 0.40 s | Curl + eye close |
| `Sleep` | `Wake` | `behavior == Wake` | 0.30 s | Open eyes first |
| `Wake` | `Idle` | exit time 1.2 s or `behavior == Idle` | 0.20 s | Do not snap |
| `Idle` | `Wave` | `behavior == Wave` | 0.15 s | One-shot |
| `Wave` | `Idle` | exit time 1.5 s | 0.20 s | No loop |
| `Idle` | `Focus` | `behavior == Focus` | 0.30 s | Glasses fade in |
| `Focus` | `Idle` | `behavior == Idle` | 0.30 s | Glasses fade out |
| `Focus` | `Celebrate` | `behavior == Celebrate` | 0.15 s | Timer completion |
| `Idle` | `Celebrate` | `behavior == Celebrate` | 0.15 s | Level-up |
| `Walk` | `Celebrate` | `behavior == Celebrate` | 0.15 s | Completion during roam |
| `Celebrate` | `Idle` | exit time 2.5 s, `behavior == Idle` | 0.30 s | |
| `Celebrate` | `Focus` | exit time 2.5 s, `behavior == Focus` | 0.30 s | Return to focus posture |
| Any | `Drag` | `behavior == Drag` | 0.12 s | Immediate, P0 |
| `Drag` | `Idle` | `behavior != Drag` | 0.25 s | Bridge sends the post-drop state |
| Any | `Wake` | `behavior == Wake` | 0.20 s | Recovery path |

The "Any → Drag" transition must be a true any-state transition (or duplicated on every state); a drag during sleep must not wait for a sleep exit.

### 3.3 Idle variants

`Idle` is a layered state, not a single clip:

- **Base:** `idle_breathe` loop (3.6 s).
- **Face layer:** procedural blink (2.5–7 s), eye tracking (optional), mouth curve bound to mood.
- **Micro layer:** random look, ear flick, tail sway; one micro at a time, 4–12 s apart.
- **Variants:** `sit` and `stretch`/`yawn` one-shots may be triggered internally on a timer or via optional triggers from the director. They must return to the breathing base.

Engineering does not schedule blinks. If the director requests `microStretch`, the trigger is advisory; the designer may ignore it if the character is mid-blink.

## 4. Animation clips

| Clip | Duration | Loop | Notes |
| --- | --- | --- | --- |
| `idle_breathe` | 3.6 s | Yes | 2.5% vertical scale, 1.5% chest |
| `idle_blink` | 210 ms | No | 120 ms closed, 90 ms open; double blink 8% |
| `idle_look_left` / `idle_look_right` | 1.4–2.2 s | No | Eyes first, then head |
| `idle_ear_flick` | 600 ms | No | One ear, with follow-through |
| `idle_sit` | 6–12 s | Yes | Lower body, tail wrap |
| `idle_stretch` | 2.4 s | No | Anticipation 200 ms, settle |
| `idle_yawn` | 1.8 s | No | Eyes close, mouth open, shake |
| `walk_loop` | 0.9 s | Yes | Two steps; contact frames at 0% and 50% |
| `sleep_loop` | 5.0 s | Yes | Curl, slow breath, ear flick every ~9 s |
| `wake` | 1.2 s | No | Eyes → stretch → sit |
| `wave` | 1.5 s | No | Anticipation 200 ms, two waves, settle |
| `focus_loop` | 4.4 s | Yes | Upright, glasses, tail still |
| `focus_nudge` | 2.0 s | No | Look up, blink, return |
| `celebrate` | 2.5 s | No | Squash 92% → stretch 106% → settle; ≤ 40 particles |
| `drag_loop` | 1.2 s | Yes | Sway, limbs hang, ears back |

No clip may contain camera movement, background, text, or a hard cut. Every one-shot starts and ends on the idle pose to blend cleanly.

## 5. Events and listeners

| Event | Direction | Payload | Purpose |
| --- | --- | --- | --- |
| `headPetted` | Rive → app | none | Optional semantic zone for petting |
| `bodyPetted` | Rive → app | none | Optional semantic zone |
| `footstep` | Rive → app | none | Optional soft footstep sound; disabled in low power |

Events are optional in v1; the renderer already knows pointer zones from the DOM hit region. If implemented, they must fire once per contact, not per frame. No event may carry text or user data.

## 6. Hit regions

The click-through hit test is a **window-space ellipse** per state, defined in the renderer. The artboard is placed at (60, 132) in the 320 × 360 window. The table below is in artboard coordinates; the renderer offsets and scales it.

| State | Ellipse size | Center (artboard) | Notes |
| --- | --- | --- | --- |
| `Idle` | 168 × 200 | (100, 110) | Covers ears to feet |
| `Walk` | 168 × 200 | (100, 108) | Slightly higher due to bob |
| `Sleep` | 190 × 120 | (100, 162) | Curled low; includes bed |
| `Wake` | 180 × 200 | (100, 108) | Stretch may extend up |
| `Wave` | 180 × 210 | (100, 105) | Paw up |
| `Focus` | 168 × 200 | (100, 110) | Glasses do not extend |
| `Celebrate` | 184 × 210 | (100, 105) | Jump/stretch |
| `Drag` | 150 × 200 | (100, 112) | Elongated body |

If the silhouette in a state extends beyond the ellipse by > 6 DIP, the designer must either adjust the pose or update this table in the same PR. The renderer uses the table from `shared/hit-regions.ts`; the contract test asserts every behavior has an entry.

## 7. Mode variants

### 7.1 Reduced motion (`reducedMotion = true`)

- No walk cycle; if `behavior == Walk` arrives anyway, hold `Idle` with a subtle weight shift. The director already suppresses roam, but the state machine must be robust.
- `Wave` becomes a 600 ms head nod + ear lift (still communicates greeting).
- `Celebrate` becomes a 600 ms squash + sparkle glyph; no particles, no jump.
- `Drag` sway amplitude ≤ 2°; no limb flop beyond 4 px.
- Blink every 5–8 s; breathing unchanged (slow motion is not vestibular).
- Transitions ≤ 150 ms; no overshoot curves.
- Sleep Zzz is static or a 1 s opacity pulse, not rising particles.

### 7.2 Low power (`lowPower = true`)

- `FX` layer off; no confetti, sparkles, steam, or Zzz particles (use a static glyph).
- Footstep events off; scarf/tail secondary motion reduced by 50%.
- Sleep breathing may run at a lower update cost; the app may pause rendering entirely in sleep-low-power mode, so the sleep pose must read as a still frame.
- No semantic changes.

### 7.3 Themes (`theme`)

- `Light`: warm palette from [Visual & motion](visual-and-motion.md#31-light-theme-default).
- `Dark`: warm dark palette; pet body remains warm cream, scarf apricot; no pure black.
- `HighContrast`: 2 px ink outline, flat fills, no gradients; scarf falls back to a high-contrast solid; particles off regardless of low power.
- Theme changes are instant (≤ 120 ms) and must not reset the current state or trigger a blink/gesture.

### 7.4 Accessories (`accessory`)

- `None` shows the default apricot scarf.
- `Glasses` are shown outside focus; during `Focus`, glasses are always visible regardless of the equipped accessory (the focus glasses are part of the state, not the cosmetic).
- `Bed` replaces the contact shadow only in `Sleep`; hidden otherwise.
- `Mug` appears only in break/idle states and is hidden during `Walk`, `Drag`, `Sleep`, and `Focus`.
- Accessories must never obscure the face or change the silhouette enough to break the hit ellipse.

## 8. Authoring rules

1. **Vector only** unless a raster is essential; no raster textures on the idle loop.
2. **No text** in the artboard; localization and accessibility live in HTML.
3. **No embedded audio.**
4. **No nested state machines** in v1; one `PetSM` keeps the contract testable.
5. **No random transitions with unbounded duration**; every state must be exit-able by a behavior change.
6. **No physics dependency** that behaves differently at 30 fps vs 60 fps; use state machine time, not frame count.
7. **No blend that leaves both eyes half-open** at rest; blink must be a crisp one-shot.
8. **Keep the silhouette** at 16 px in mind; avoid thin lines and low-contrast details on the head.
9. **Follow-through** on scarf/tail is required, but must stay within the artboard.
10. **Naming:** PascalCase for states/artboards/view models; camelCase for properties; snake_case for clips and events is allowed for readability but must match this document exactly.
11. **File hygiene:** remove unused artboards, unused assets, and editor-only guides before export.
12. **Golden poses:** maintain `mochi-golden.riv` with one static artboard per core state for visual tests (not shipped).

## 9. Export checklist

- [ ] Artboard `Mochi` at 200 × 220.
- [ ] State machine `PetSM` with exactly the 8 required states and the transition conditions in §3.2.
- [ ] View model `PetModel` with all required properties, types, and defaults.
- [ ] Enum values match exactly (including `ScarfMoss`, `ScarfSky`, `AuroraScarf`).
- [ ] Triggers `poke`, `pet`, `nudge` implemented; optional micro triggers declared or omitted consistently.
- [ ] No state-machine inputs.
- [ ] No text, audio, or raster > 512 px.
- [ ] File ≤ 2.5 MB.
- [ ] Export "Runtime" `.riv`, not the editor project.
- [ ] Run `npm run validate:rive` locally and attach the output to the PR.
- [ ] Record a 10 s reel: idle, walk, sleep, wake, wave, focus, celebrate, drag, reduced motion, dark theme.

## 10. CI validator mapping

| Contract item | Validator assertion |
| --- | --- |
| Artboard `Mochi` | Exists; size ≈ 200 × 220 (tolerance 0.5) |
| State machine `PetSM` | Exists in `rive.contents` |
| View model `PetModel` | `rive.viewModelByName('PetModel')` non-null |
| Property names/types | `viewModel.properties` includes every required property with the expected type |
| Enum values | Each `Behavior`/`Accessory`/`Theme` value is accepted and produces a state change (runtime smoke) |
| Behaviors | Forcing each of the 8 enum values reaches a matching state within 1 s |
| Triggers | Injecting `poke`/`pet` does not leave the state machine stuck |
| File size | ≤ 2.5 MB |
| Raster assets | None > 512 px |
| Forbidden inputs | No state-machine inputs exposed (warn, not fail, if Rive reports none) |

If the runtime cannot introspect enum values directly, the validator uses the smoke path (set each value, observe a state/ack change). Either way, a renamed or missing value fails.

## 11. Change management

- **Contract version** is bumped when a required name, type, enum value, state, or transition condition changes. A cosmetic-only change does not bump it.
- **Design → engineering:** the designer updates `mochi.riv`, runs the validator, and attaches the reel. Engineering reviews the diff and the contract test output.
- **Engineering → design:** changes to the bridge or hit regions require updating this document and the shared constants first.
- **Binary in Git:** the `.riv` is committed directly; Git LFS is optional if it grows beyond 5 MB (it should not).
- **Rollback:** the previous `.riv` and its contract version are kept in the release branch; a bad asset can be reverted without touching code if the contract is unchanged.

## 12. Definition of done for the first asset

- All 8 behaviors play and return cleanly.
- Idle never looks frozen; blinks are irregular but not twitchy.
- Walk reads at 70 DIP/s with no foot sliding.
- Sleep/wake transitions are gentle and do not pop.
- Drag dangle is stable and settles on drop.
- Reduced motion, low power, dark, and high contrast variants all read correctly.
- The hit ellipse covers the silhouette in every state.
- CI validator passes; file size within budget; visual goldens approved by design.
- A 10 s reel and a still contact sheet are attached to the PR.

---

**Next:** [ADRs →](../04-adr/README.md)
