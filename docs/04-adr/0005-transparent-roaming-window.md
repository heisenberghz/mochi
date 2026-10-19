# ADR-0005: Tight transparent window with a native motion driver

| Field | Value |
| --- | --- |
| Status | Accepted; validate in Spike S1 |
| Date | 2026-10-19 |
| Deciders | Engineering, Design |
| Related | [Desktop shell](../02-architecture/desktop-shell.md#5-motion-driver-roaming) · [ADR-0006](0006-click-through-hit-testing.md) · [Performance](../02-architecture/performance-and-reliability.md) |

## Context

Mochi must be able to sit in a corner and occasionally walk along the bottom of the screen. There are three broad ways to achieve that on Windows:

1. A small window that moves with the pet.
2. A screen-wide transparent "stage" window with the pet animated inside.
3. A native layered window with custom composition (`UpdateLayeredWindow`/DirectComposition).

The choice affects click-through safety, power draw, multi-monitor behavior, and how much native code we own.

## Decision

Use a **tight 320×360 DIP transparent window** and move it with a **main-process motion driver** at 60 Hz (30 Hz fallback). The pet's walk cycle is driven by Rive and synced to the window velocity (`speed`, `facing`).

Keep a **stage-mode fallback** behind a flag: if S1 or beta measurements show unacceptable DWM artifacts, dropped frames, or tearing, expand the window to the work-area width and animate the pet inside it without moving the OS window.

## Alternatives considered

### Stage window by default (screen-wide overlay)

- **Pros:** no OS window movement; buttery CSS/Rive animation; simpler multi-monitor motion.
- **Cons:** a large always-on-top transparent surface magnifies click-through bugs (a mis-toggle blocks a strip of the desktop); higher GPU/compositing cost; interacts badly with fullscreen apps; harder to reason about hit regions.
- **Verdict:** excellent fallback, not the default. The product's "never in the way" pillar favors the smallest possible surface.

### Native layered window (C++/Win32 or a helper process)

- **Pros:** pixel-perfect hit testing, precise composition, potentially lower overhead.
- **Cons:** native toolchain and maintenance; per-monitor DPI and accessibility work; slows iteration; we would still need a webview for the Den.
- **Verdict:** keep as a future option for a native hit-test helper, not the v1 shell.

### Move the window with CSS `app-region: drag` or OS animation APIs

- **Pros:** OS-smoothed movement, no custom loop.
- **Cons:** `app-region` suppresses clicks and only works for user drags; `setBounds` animation flags are macOS-only; OS animation is not controllable at 60 Hz for a path.
- **Verdict:** not applicable to autonomous roaming.

## Consequences

### Positive

- The interactive surface is small; a click-through failure has limited blast radius.
- The pet can be placed anywhere, and placement is a simple bounds rectangle to persist.
- Window movement is explicit, cancellable, and testable in main.
- No native code in v1; iteration remains in TypeScript.

### Negative / accepted costs

- Moving a layered window at 60 Hz can produce DWM artifacts or stutter on some GPUs/drivers.
- Multi-monitor and DPI changes add complexity: bounds are DIP, displays can change, the pet must be re-clamped.
- Motion is limited to a horizontal path in v1; vertical wandering needs a path planner later.
- The walk cycle must be synced to velocity, or feet slide.
- A full-screen game with exclusive mode can cover the pet; this is a platform limitation, not solved by the window choice.

### Neutral / follow-ups

- S1 measures dropped frames, tearing, and CPU during a 2-minute roam on reference and low-end hardware.
- If stage mode is activated, the renderer's layout changes but the contract, behavior engine, and persistence do not.
- The motion driver is behind an interface (`MotionPort`) so a native implementation can replace it.

## Validation

- S1: ≥ 95% of frames ≤ 16.7 ms, no stall > 50 ms, no visible tearing in a 10 s capture.
- Window bounds never intersect the taskbar or leave the work area.
- 30 Hz fallback is visually acceptable and activates only after 10 consecutive over-budget frames.
- Mixed-DPI drag/roam keeps the pet the same DIP size and the hit region aligned within 4 DIP.
- If guardrails fail, stage mode is enabled and re-measured before release.
