# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

(Mochi is a Windows desktop app — an Electron 44 shell whose rendering surfaces are HTML/CSS/React. All impec design guidance here applies to those web-tech surfaces: the pet window and the Den.)

## Users

The primary user is the developer themselves: one person on a Windows laptop/desktop doing knowledge work in 30–90 minute bursts, frequently interrupted, who wants a low-effort focus ritual and a warm visual companion rather than another dashboard. The app is **personal-use, single-user** — the spec personas ("Maya," "Devon," "Priya") in `docs/01-product/prd.md` describe a hypothetical audience, not targets; activation/retention targets in that spec are likewise aspirational, not commitments. Explicit non-users for the buildable product: teams, enterprise IT, and anyone wanting app-blocking or surveillance-based coaching.

## Product Purpose

Mochi is a calm, always-there desktop companion for Windows: a small cream blob-cat that lives in a corner of the screen, never blocks a click, and quietly supports a focus practice (Pomodoro-style timer, breaks, XP/levels, daily insights). The bet: a warm, low-demand, high-craft presence makes it more likely someone starts and finishes focused work, and pleasant enough to stay installed. Success for this personal app: it stays running on the author's machine, helps real focus blocks happen, and feels alive — not installer/adoption metrics.

## Positioning

Not a productivity dashboard — a character with a light layer of focus tooling underneath, where depth of craft is the feature. What a neighboring product could not truthfully copy: an ambient, hand-crafted pet **with an honest, local, never-nagging focus engine** — one artifact that is ambient, charming, and useful, closer to a desk toy than a productivity suite. Anti-patterns are named in the spec and stay binding: guilt streaks, loss-aversion mechanics, "you haven't focused in N days" pushes, interaction required to keep the pet "alive."

## Operating Context

- Real usage scene: focus blocks on a Windows machine during a workday; interruptions from messengers; idle drift after ~20 minutes; evenings/quiet hours (Mochi curls up and sleeps); suspend/resume, screen lock, and exclusive-fullscreen games, all of which Mochi must handle politely (hide/pause, never corrupt state).
- Surfaces: the always-on-top transparent pet window; the **Den** (Home, Focus, Insights, Locker, Settings — a standard window); a tray icon; Windows toasts; global hotkeys (`Ctrl+Alt+P/F/D`).
- Personal-use distribution (deliberately not built): NSIS signed installer, auto-update with staged rollout, code signing, localization — parked in `ROADMAP.md` §3.

## Capabilities and Constraints

- **Confirmed, current state:** transparent/click-through/draggable roaming pet window, tray, hotkeys, single-instance, domain core in pure TypeScript (behaviour brain, focus engine, persistence), atomic versioned JSON store, loose DPI/monitor handling, smoke harness for real desktop phases. Per `ROADMAP.md` (updated 2026-10-29), of the 88 spec requirement rows: 17 done, 40 partly, 31 missing — depth is the gap, not direction. Session roadmap order: **bugs before features** (correctness is subtractive).
- **Soft-sounding rules that are hard points in the FR tables:** everything is achievable fully offline (FR-DAT-07); no interaction is ever required to avoid negative consequences (FR-INT-09); no punishing or irreversible states (FR-ANI-10).
- **Renderer:** hand-drawn single SVG + CSS keyframes, no binary art formats (ADR-0010 supersedes the Rive ADRs; the eight-state behaviour contract — idle, walk, sleep, wake, wave, focus, celebrate, drag — stays as specified).
- **Architecture authority:** the main process decides, the renderers draw. Domain layer must not import Electron/React/Node I/O (NFR-MAINT-01); typed Zod-validated IPC at both ends; sandboxed renderers; strict CSP; allowlisted external links only.
- **Privacy:** local-first, no telemetry by default; idle detection uses duration only; diagnostics upload only with explicit consent and payload preview; logs carry no window titles/content.
- **Petting rate limits, bubble frequency caps (≤ 1 unsolicited bubble / 5 min, ≤ 6 / hour), one-nudge-per-block** are binding interactions (FR-INT), not tunables to bypass.
- **Deliberately undecided / open (from spec §13):** sound default (O-5), Windows 10 support tier (O-4), cosmetics monetization post-launch (O-7 — none in v1). Record further decisions when made; do not invent them.

## Brand Commitments

- **Name & character:** the app is **Mochi**, a cream blob-cat with a scarf (one hand-drawn SVG, `assets/pet/mochi.svg`); the repo keeps the honest name **virtual_pet**. Mochi is female, calm, warm, playful on breaks, asleep when you are — the character's identity is fixed; she is not a generic mascot skin.
- **Voice:** quiet, warm, and sure; short authored bubble copy (≤ 80 chars, deterministic, never AI-generated, never developer jargon — AC-08, FR §9). Celebratory copy is a punctuation mark ("25 minutes. That's a good block."), never praise inflation; absence is rendered openly and without judgment ("A quiet week. Want to try a 10-minute block?").
- **Look world:** craft-and-come-calm; cosmetics (leaf hat, mug, bed, glasses, scarves) are earned, non-random, non-purchased, no pressure UI.

## Evidence on Hand

- `README.md` — honest current description and stack table.
- `ROADMAP.md` — the live build log and truthful status vs. spec; the only authoritative order-of-work.
- `docs/` — the original ~4,900-line product specification (PRD, requirements, architecture, ADRs, design contracts); treated as history and requirement catalogue, not as "already done."
- `assets/pet/mochi.svg` — the entire character; `art-mockups/*.html` — art/QA preview surfaces; `screenshots/`, `smoke-*.{json,png}` — desktop smoke outputs.
- Absence that must not be fabricated: no real user testimonials, no usage/beta data, no signing cert, no update hosting. Until evidence exists, claims stay aspirational and out of user-facing copy.

## Product Principles

1. **Ambient by default.** Mochi occupies a corner, not the center; anything persistent, modal, or attention-stealing is a defect.
2. **Warmth over gamification.** Rewards are small, earned, and diegetic; streaks and XP never judge, never decrease, never hold the user hostage.
3. **One nudge, then silence.** Silence is a feature; caps on bubbles/notifications are hard constraints.
4. **User control is visible.** Hide, pause, mute, reduce motion, quit are always one or two actions away; never a trap.
5. **Depth over breadth.** Bugs before features; partial-but-true beats broad-but-happy-path (the ROADMAP failure mode is explicitly named and guarded against).

## Accessibility & Inclusion

The Den meets **WCAG 2.2 AA** (contrast, focus, target size; keyboard-only flows, usable at 200% scaling) — binding per FR-A11Y-01/NFR-A11Y-01. Reduced-motion mode is honored everywhere (no roaming, no confetti, ≤ 150 ms transitions) and can follow the OS setting. Bubbles/status announce via `aria-live`/`role="status"` without stealing focus; color is never the sole state indicator; all pet actions have keyboard/tray equivalents. Language: English only in v1; strings externalized.
