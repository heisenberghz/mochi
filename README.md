# Mochi

**A calm, always-there desktop companion for Windows.** Mochi is a small animated blob-cat that lives in the corner of your screen, keeps you company through focus sessions, and makes deep work feel a little more human.

> **Status:** architecture and specification complete — implementation has not started.
> **Spec version:** 1.0 · **Date:** 2026-10-19 · **Target:** Windows 11 (22H2+), Windows 10 22H2 (best effort), x64 first.

---

## Why this exists

Productivity software usually asks for more attention than it gives back. Mochi takes the opposite bet: a tiny, delightful presence that is **ambient by default**, **useful when called upon**, and **never guilt-tripping**. It behaves like a good desk companion — quiet while you work, playful when you take a break, and asleep when you are.

Three product pillars drive every technical decision:

| Pillar | What it means | Architectural consequence |
| --- | --- | --- |
| **Invisible until wanted** | The pet must never block clicks, steal focus, or clutter the taskbar. | Transparent frameless window, per-pixel-style hit testing, click-through by default, `showInactive()` startup. |
| **Alive, not noisy** | Motion is continuous and characterful, but idle cost is near zero. | Rive state machine with layered idle animations; main-process behavior director; power-aware rendering. |
| **Trustworthy companion** | Local-first data, no surveillance, predictable recovery. | No telemetry by default, sandboxed renderers, validated IPC, atomic versioned storage. |

## What v1 does

- An always-on-top, transparent, draggable pet window with a roaming walk cycle, sleep, blink, wave, focus, celebrate, and drag reactions.
- A behavior brain that chooses what Mochi does based on time of day, energy, mood, and what you are doing.
- A focus timer (Pomodoro-style) with idle-aware auto-pause, break nudges, XP, streaks, and daily insights.
- A "Den" window for the timer, stats, cosmetics, and settings.
- Tray integration, global hotkeys, launch-at-login, multi-monitor and DPI handling.
- Signed NSIS installer with background auto-update.

Full scope, acceptance criteria, and release gates live in the [requirements](docs/01-product/requirements.md) and [roadmap](docs/05-plan/roadmap.md).

## Stack

| Layer | Choice | Version baseline |
| --- | --- | --- |
| Shell | Electron | 44.9.x |
| UI | React + TypeScript (strict) | React 19.x, TS 5.x |
| Build | electron-vite + Vite | current at scaffold time |
| Pet animation | Rive (`@rive-app/react-canvas`) | 4.37.0 / runtime 2.45.0 |
| Styling (Den) | Tailwind CSS + CSS custom properties, Radix primitives | Tailwind 4.x |
| Domain tests | Vitest + fake clock/RNG | Vitest 3.x |
| E2E | Playwright Electron | current at scaffold time |
| Packaging | electron-builder + electron-updater | 26.x / 6.x |
| Storage | Versioned JSON document store (no native modules) | schema v1 |

Rationale for each choice is recorded in the [ADR set](docs/04-adr/README.md).

## Architecture at a glance

```
┌──────────────────────────── Main process (authority) ────────────────────────────┐
│  Domain core (pure TS)          Application services           OS integration     │
│  ├─ BehaviorDirector            ├─ PetService                  ├─ WindowManager    │
│  ├─ FocusEngine                 ├─ FocusService                ├─ MotionDriver     │
│  ├─ PetModel (energy/mood/XP)   ├─ SettingsService             ├─ TrayController   │
│  └─ RoamPlanner                 ├─ StatsService                ├─ HotkeyService    │
│                                 └─ PersistenceService           └─ PowerService     │
│                    typed, validated IPC  ◄────────────►  preload (contextBridge)   │
└──────────────────────────────────────────────────────────────────────────────────┘
          │                                                          │
   ┌──────▼──────────────┐                                   ┌───────▼──────────────┐
   │ Pet renderer        │                                   │ Den renderer         │
   │ Rive canvas + bubble│                                   │ Timer, stats,        │
   │ input capture       │                                   │ settings, locker     │
   └─────────────────────┘                                   └──────────────────────┘
```

- **The main process owns state.** Renderers send commands and render snapshots. This keeps behavior consistent across window reloads and makes the domain testable without Electron.
- **Rive owns the body, not the brain.** The behavior director emits a behavior enum plus energy/mood/speed; the Rive state machine handles blending, blinking, and secondary motion.
- **The pet window is tight, not a full-screen overlay.** It moves with a main-process motion driver when Mochi walks, and is click-through everywhere except the pet's hit region.
- **Everything that crosses a process boundary is typed and validated** with Zod at both ends.

Read the full [architecture overview](docs/02-architecture/overview.md).

## Documentation map

| Document | Purpose |
| --- | --- |
| [Docs index](docs/README.md) | Reading paths, conventions, status |
| [PRD](docs/01-product/prd.md) | Vision, users, scope, success metrics |
| [Requirements](docs/01-product/requirements.md) | FR/NFR IDs and acceptance criteria |
| [Architecture overview](docs/02-architecture/overview.md) | Process model, modules, data flow, constants |
| [Desktop shell](docs/02-architecture/desktop-shell.md) | Windows, transparency, click-through, drag, motion, DPI |
| [Behavior engine](docs/02-architecture/behavior-engine.md) | Statecharts, behavior catalog, scheduling |
| [Animation system](docs/02-architecture/animation-system.md) | Rive runtime, bridge, asset lifecycle, failure modes |
| [Focus engine](docs/02-architecture/focus-engine.md) | Timer semantics, idle/suspend recovery, rewards |
| [Data & persistence](docs/02-architecture/data-and-persistence.md) | Schemas, atomic writes, migrations, recovery |
| [IPC contracts](docs/02-architecture/ipc-contracts.md) | Channels, envelopes, errors, preload API |
| [Security & privacy](docs/02-architecture/security-and-privacy.md) | Threat model, hardening, data inventory |
| [Performance & reliability](docs/02-architecture/performance-and-reliability.md) | Budgets, measurement, power, crash handling |
| [Experience spec](docs/03-design/experience-spec.md) | Flows, interactions, surfaces, copy, a11y |
| [Visual & motion system](docs/03-design/visual-and-motion.md) | Art direction, palette, timing, sound |
| [Rive authoring contract](docs/03-design/rive-authoring-contract.md) | Artboard, state machine, view model contract |
| [ADRs](docs/04-adr/README.md) | Nine decisions with alternatives and consequences |
| [Roadmap](docs/05-plan/roadmap.md) | Phases, spikes, estimates, release checklist |
| [Test strategy](docs/05-plan/test-strategy.md) | Pyramid, E2E, visual, perf, release gates |
| [Risk register](docs/05-plan/risk-register.md) | Likelihood, impact, mitigation, owners |
| [Glossary](docs/06-appendix/glossary.md) | Shared vocabulary |
| [References](docs/06-appendix/references.md) | Verified API/version sources |

## Planned repository layout

```
mochi/
├─ src/
│  ├─ main/            # Electron main process, adapters, services
│  ├─ preload/         # contextBridge API (one per renderer surface)
│  ├─ domain/          # pure TypeScript: no electron, no React, no I/O
│  ├─ shared/          # Zod contracts, constants, types
│  └─ renderer/
│     ├─ pet/          # Rive canvas, bubble, input capture
│     └─ den/          # timer, insights, settings, locker
├─ assets/
│  ├─ rive/mochi.riv   # designer-owned; validated in CI
│  ├─ icons/           # tray + installer, multi-DPI
│  └─ audio/           # short, license-cleared cues
├─ docs/               # this specification
└─ tests/              # fixtures, E2E, visual goldens
```

## Working agreements

- **Requirements are testable.** Every `FR-*` has an acceptance criterion and a verification method. Every NFR has a budget and a measurement.
- **ADRs are immutable records.** Superseding a decision means adding a new ADR, not editing history.
- **The Rive file is a versioned interface.** Its view model and state machine names are contractual; CI fails if they drift.
- **Docs are the source of truth until code exists.** When implementation reveals a better decision, update the ADR and the affected specs in the same change.

## Immediate next steps

1. Approve the [character direction](docs/03-design/visual-and-motion.md) and commission the first `.riv` file against the [Rive contract](docs/03-design/rive-authoring-contract.md).
2. Run Spike S1 (transparent window + click-through + motion smoothness) before committing to the motion driver design.
3. Scaffold the repo from [Roadmap Phase 0](docs/05-plan/roadmap.md#3-phase-0-foundations-week-1).
