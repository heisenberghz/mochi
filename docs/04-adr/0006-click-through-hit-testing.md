# ADR-0006: Renderer ellipse hit testing with forwarded mouse events

| Field | Value |
| --- | --- |
| Status | Accepted; validate in Spike S1 |
| Date | 2026-10-19 |
| Deciders | Engineering |
| Related | [Desktop shell](../02-architecture/desktop-shell.md#3-click-through-and-hit-testing) · [ADR-0005](0005-transparent-roaming-window.md) · [Requirements](../01-product/requirements.md) |

## Context

Electron transparent windows are **not** click-through by default. `setIgnoreMouseEvents(true)` makes the entire window ignore input; `options.forward` (Windows/macOS) forwards mouse-move messages to the renderer so it can detect when the cursor enters an interactive region. There is no built-in per-pixel hit test.

Mochi needs click-through everywhere except the pet (and an actionable bubble), plus reliable click-vs-drag behavior and hover feedback. The window is never focused, and it sits above other apps.

## Decision

Default the pet window to `setIgnoreMouseEvents(true, { forward: true })`. The renderer detects cursor entry into a per-state **ellipse** (plus the bubble rect), with 8 DIP hysteresis, and asks main to call `setIgnoreMouseEvents(false)`. Leaving the expanded region for 150 ms restores click-through.

- Hit testing lives in the renderer (`HitTest.ts`), using window-local coordinates from forwarded `mousemove`.
- Main owns the OS toggle (`WindowManager.setInteractive`) and deduplicates rapid changes.
- A 10 Hz main-side cursor watchdog runs only after 2 s of interactive state, to recover from lost mouse-leave events at screen edges.
- Dragging, the native context menu, and bubble actions force the window interactive.
- The ellipse per state is defined in the [Rive contract](../03-design/rive-authoring-contract.md#6-hit-regions) and shared constants; it is not sampled from canvas alpha.

## Alternatives considered

### Per-pixel alpha sampling in the renderer

- **Pros:** perfect silhouette hit testing; adapts to any pose.
- **Cons:** GPU readback every pointer move (or a low-res offscreen pass) is expensive, causes stalls, and threatens the idle budget; transparent canvas readback behavior varies by driver.
- **Verdict:** rejected for v1; revisit only with a native helper.

### Native `WM_NCHITTEST` helper / layered window input region

- **Pros:** exact, OS-level hit testing; no IPC race; can return `HTTRANSPARENT` per pixel.
- **Cons:** requires a native addon/helper, build/sign/ARM64 work, and a Windows message loop integration; not justified before S1 evidence.
- **Verdict:** documented fallback. The renderer API stays the same if implemented later.

### `-webkit-app-region: drag` on the whole pet

- **Pros:** OS-handled drag feels native.
- **Cons:** suppresses click and hover, so petting/hover tracking break; no click-vs-drag discrimination; conflicts with toggling ignore state.
- **Verdict:** rejected.

### Keep the window interactive all the time

- **Pros:** trivial and reliable input.
- **Cons:** a 320×360 invisible rectangle blocks clicks on the desktop; violates the core "never in the way" requirement.
- **Verdict:** rejected.

## Consequences

### Positive

- The desktop remains fully clickable; only the pet intercepts input.
- The renderer can implement hover, poke, drag threshold, and bubble actions with normal DOM events.
- The OS toggle is a single, observable boolean that can be tested and reset on crash.
- No native code in v1.

### Negative / accepted costs

- A very fast click on the first frame of entry can pass through before the toggle lands. Mitigated by an 8 DIP expanded zone and measured as "first-click success"; target ≥ 99%.
- The hit region is approximate; a raised paw or scarf tip may be click-through. The per-state ellipse table must be maintained with art changes.
- Toggling too often can cause hover flicker; hysteresis and a 50 ms dedupe are required.
- The main-side watchdog adds a small timer while interactive; it stops when click-through is restored.
- Renderer crash or hide must force ignore=true, or the desktop is blocked by an invisible window.

### Neutral / follow-ups

- If first-click success misses the guardrail, implement the native `WM_NCHITTEST` helper behind `HitTestPort`; no product API changes.
- If per-pixel accuracy becomes a design requirement, a native input region is the only robust path.
- Tests must assert ignore=true after every failure path (crash, hide, suspend, quit).

## Validation

- S1 manual + E2E: clicking 20 px outside the pet activates the app below; clicking the body opens the reaction.
- First-click success ≥ 99% at 800 DIP/s cursor speed on the reference machine.
- No more than one toggle per 50 ms; no hover flicker in a 60 s trace.
- Ignore state is true after renderer crash, hide, and suspend.
- Mixed-DPI hit region is within 4 DIP of the visual silhouette.
