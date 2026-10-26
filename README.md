# virtual_pet

**A calm, always-there desktop companion for Windows.** Mochi is a small
cream blob-cat who lives in the corner of your screen — keeping
you company through focus sessions, napping when you nap, and making deep work
feel a little more human.

> **Status:** personal-use app, built and running from source on Windows.
> Pushed to GitHub as source only — no installer, no auto-update, no telemetry.

---

## Why this exists

Productivity software usually asks for more attention than it gives back.
Mochi takes the opposite bet: a tiny, delightful presence that is **ambient by
default**, **useful when called upon**, and **never guilt-tripping**. She is
quiet while you work, playful when you take a break, and asleep when you are.

## What she does

- Lives in an always-on-top, transparent, drag-anywhere window — click-through
  everywhere except her own body, so she never blocks a click.
- Walks her own walk cycles (roaming, sleep-curl, blink, wave, celebrate,
  carried-by-you) driven by a behaviour brain that reads the time of day,
  your energy budget, her energy and mood.
- Runs a Pomodoro-style focus engine with idle-aware auto-pause, break
  nudges, XP, levels, streaks and daily insights.
- Wears cosmetics from her **Locker**: leaf hat, mug, bed, glasses and three
  scarves — unlocked by level, retired when replaced.
- Snoozes through quiet hours, pauses when you lock the screen, hides during
  real fullscreen games, and comes back when you double-click her icon in the
  tray (or at next log-in, if you let her).

## Running it

```powershell
npm install
npm run dev        # she appears
```

Quality gates:

```powershell
npm test           # unit tests (vitest)
npm run lint
npm run typecheck
npm run build
npm run smoke      # real desktop phases; needs a Windows desktop, local only
```

Details live in [ROADMAP.md](ROADMAP.md) — the live build log, stage by stage.

## How it's built

| Layer | Choice | Notes |
| --- | --- | --- |
| Shell | Electron 44 | main process owns all state |
| UI | React 19 + TypeScript (strict) | dumb renderers, typed IPC (Zod-validated at both ends) |
| Build | electron-vite | |
| Art | one hand-drawn SVG + CSS keyframes | the character is a single editable file; no binary art formats |
| Native bridge | [koffi](https://github.com/Koromix/koffi) (MIT, prebuilt) | one tiny job: asking Windows which window is fullscreen |
| Tests | Vitest | pure domain; a separate `scripts/smoke.mjs` drives the real desktop |

Architecture in one line: **the main process decides, the renderers draw.**
A pure-TypeScript domain core (behaviour brain, focus engine, persistence
schema) runs in the main process; the pet and Den windows are projections of
its snapshots, wired over a typed `contextBridge` API.

## Deliberately not built

This is a personal app, so some spec dreams stay parked in
[ROADMAP.md](ROADMAP.md): the NSIS installer, auto-update with staged rollout,
code signing, and the Rive binary-art pipeline. The docs in `docs/` are the
original product specification — kept as history, not as the build plan.

## Repository layout

```
virtual_pet/
├─ src/
│  ├─ main/          # Electron main process: controller, store, windows, smoke
│  ├─ preload/       # contextBridge API for each renderer surface
│  ├─ domain/        # pure TypeScript: behaviour, focus, persistence (no Electron)
│  ├─ shared/        # Zod contracts, constants, art anchors
│  └─ renderer/
│     ├─ pet/        # the SVG pet, bubbles, input
│     └─ den/        # focus timer, insights, locker, settings
├─ assets/pet/       # mochi.svg — the entire character, one editable file
├─ scripts/          # icon generator + the two-phase desktop smoke harness
└─ docs/             # the original specification (historical)
```

## The Name

The repo is **virtual_pet** — the simplest honest description of what it is.
Mochi the character keeps the name she was born with.
