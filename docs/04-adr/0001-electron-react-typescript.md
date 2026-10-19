# ADR-0001: Electron + React + TypeScript for the Windows desktop shell

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-10-19 |
| Deciders | Engineering, Product |
| Related | [Requirements](../01-product/requirements.md) · [Desktop shell](../02-architecture/desktop-shell.md) · [ADR-0002](0002-rive-animation-runtime.md) |

## Context

Mochi is a Windows-first desktop companion with unusually strict requirements for a small app:

- A transparent, frameless, always-on-top window that composes over arbitrary desktop content.
- Per-pixel-feeling click-through and a draggable character.
- Continuous 60 fps vector animation with a small idle footprint.
- A mature system-tray, hotkey, notification, auto-launch, and auto-update story on Windows.
- A two-person team's velocity: the UI layer should be familiar and testable.
- The build machine already has Node 24 and .NET 8; Rust is not installed.

The decision is expensive to reverse because it determines the process model, packaging, animation integration, and the security surface.

## Decision

Use **Electron 44.x** with **React 19** and **TypeScript (strict)**. The app is a single package with three processes:

- Main: authoritative domain/services and all OS integration.
- Preload: narrow `contextBridge` APIs per surface.
- Renderers: a Rive pet window and a React Den, both sandboxed.

The build uses `electron-vite`, packaging uses `electron-builder`, and tests use Vitest + Playwright Electron.

## Alternatives considered

### Tauri 2 + React

- **Pros:** much smaller installer, Rust backend, strong security defaults, good Windows support via WebView2.
- **Cons:** WebView2 transparency and always-on-top composition are less predictable; per-pixel-style click-through requires more native work; WebView2 runtime availability/version differences add QA surface; Rust is not installed and the team's velocity is in TypeScript.
- **Verdict:** viable, but riskier for the core "feel" requirements. Revisit only if installer size becomes a measured retention problem.

### .NET 8 + WinUI 3 / WPF

- **Pros:** native Win32 control, smallest idle footprint, no browser sandbox, excellent transparency and topmost behavior.
- **Cons:** animation workflow (Rive runtime, vector blending) is less direct; UI iteration is slower; a smaller talent pool for the Den; cross-platform exit is harder.
- **Verdict:** the strongest technical fit for a pure pet overlay, but the product needs a rich settings/insights surface and fast design iteration. Not chosen.

### Flutter Desktop

- **Pros:** consistent rendering, good animation, single codebase.
- **Cons:** Windows transparency/topmost/tray integrations are plugin-dependent; Rive's Flutter runtime would replace the web contract; desktop ecosystem is less mature for this use case.
- **Verdict:** not chosen.

### Native C++/Win32 layered window

- **Pros:** ultimate control over per-pixel hit testing and composition; minimal footprint.
- **Cons:** high cost for the Den, updates, accessibility, and iteration; not viable for the team size.
- **Verdict:** keep the relevant techniques (e.g., `WM_NCHITTEST`) as a future native-helper option behind a port.

## Consequences

### Positive

- Transparent/frameless windows, tray, global shortcuts, notifications, autostart, and updates are first-class and well documented.
- One language and one component model across main, preload, and both renderers.
- Rive's React runtime integrates directly; the contract is testable in Chromium.
- Playwright can launch the real Electron app and inspect `BrowserWindow` options, which makes shell requirements testable.

### Negative / accepted costs

- Installer ~100–130 MB and baseline memory ~200–300 MB; budgets and lazy Den mitigate.
- Chromium/Electron security releases require a regular upgrade cadence and a full QA pass on majors.
- The pet window is a web renderer; transparency + GPU driver bugs are a real risk (see [ADR-0005](0005-transparent-roaming-window.md)).
- Electron's default settings are unsafe; the hardening in [Security & privacy](../02-architecture/security-and-privacy.md) is mandatory, not optional.

### Neutral / follow-ups

- Pin Electron exactly; upgrade majors only after S1-style transparency and performance checks.
- Keep the domain free of Electron imports so a future shell swap is possible.
- Add a `--disable-gpu` compatibility mode for broken drivers.

## Validation

- Spike S1: transparency, always-on-top, click-through, drag, and motion smoothness on Windows 11 + Windows 10.
- NFR budgets on reference and low-end machines; if idle CPU/memory cannot meet guardrails, revisit the shell choice before building the Den.
- A packaged build must pass the security checklist (fuses, ASAR integrity, CSP).

## References

- Electron `BrowserWindow` and custom window styles documentation (see [References](../06-appendix/references.md)).
- Electron 44.9.0 and electron-builder 26.x version checks performed 2026-10-19.
