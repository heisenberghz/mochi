# Test Strategy

| Field | Value |
| --- | --- |
| Status | Approved |
| Version | 1.0 |
| Date | 2026-10-19 |
| Related | [Requirements](../01-product/requirements.md) · [Performance](../02-architecture/performance-and-reliability.md) · [Roadmap](roadmap.md) |

Mochi is a small app with a large "feel" surface. The test strategy protects the parts that are easy to break and hard to see: timer semantics, behavior determinism, persistence, file transparency, IPC security, and animation contract drift. It does not attempt to assert visual charm with pixel tests; that requires human review.

## 1. Principles

1. **Test behavior, not implementation.** Domain tests use public decisions/effects, not private fields.
2. **Determinism by construction.** Clock, RNG, idle state, and storage are injected. No `sleep(1000)` in unit tests.
3. **Real Electron for shell claims.** Window flags, click-through, and drag are verified in a launched app, not jsdom.
4. **Contracts are tests.** Rive names, IPC channels, settings keys, and hit regions have executable inventories.
5. **Failures must be reproducible.** Every flaky test has a seed and a trace; retries do not hide a bug.
6. **The release gate is a matrix, not a single suite.** Unit + contract + E2E + perf + security + manual QA.

## 2. Test pyramid

| Layer | Scope | Approx. count | Runtime |
| --- | --- | --- | --- |
| Unit | Domain: behavior, focus, pet, stats; persistence; schemas; copy | 250–350 | < 10 s |
| Contract | Rive asset, IPC inventory, settings inventory, hit regions, channel docs | 15–25 | < 60 s |
| Component | Den views with fake preload; bubble; settings forms; charts | 40–60 | < 30 s |
| E2E | Real Electron: launch, window flags, drag, focus flow, crash recovery | 15–25 | 2–5 min |
| Visual | Static Rive poses and Den screens at 3 DPRs/themes | 20–30 | 1–2 min |
| Performance | CPU/memory/startup/frame pacing/soak | 6–10 scenarios | 20–60 min |
| Security | Fuses, ASAR, CSP, protocol, IPC fuzz, network trace | 10–15 | 5–10 min + manual |
| Manual | DPI, wallpaper, tray, notifications, fullscreen, install/update | matrix | 1–2 days per RC |

The ratio is deliberate: most logic is pure and fast; the expensive layers focus on integration and platform behavior.

## 3. Tooling and layout

| Tool | Use |
| --- | --- |
| Vitest | Unit, component (with jsdom), contract scripts in Node |
| Testing Library | Den components, user-event flows |
| Playwright `_electron` | E2E, Rive contract, visual goldens, perf smoke |
| `fake-indexeddb`? | Not used (no renderer persistence) |
| `axe-core` | Accessibility scans in Den E2E |
| `pixelmatch` / `sharp` | Visual diff |
| `monitorEventLoopDelay` | Main-loop lag assertions |
| `presentmon` (external) | Frame pacing on the reference machine |
| Windows VMs | Install/update/DPI matrix |

```
tests/
├─ unit/domain/behavior/
├─ unit/domain/focus/
├─ unit/domain/pet/
├─ unit/persistence/
├─ contract/rive.spec.ts
├─ contract/ipc-inventory.spec.ts
├─ contract/settings-inventory.spec.ts
├─ component/den/
├─ e2e/
├─ visual/
├─ perf/
├─ fixtures/state/v1.json …
├─ fixtures/rive/mochi-golden.riv
└─ helpers/fake-clock.ts, fake-rng.ts, fake-preload.ts
```

## 4. Unit testing

### 4.1 Behavior engine

- Eligibility matrix: behavior × mode × energy band × mood band × quiet hours × reduced motion.
- Priority/preemption matrix, including P0 drag vs. focus, sleep vs. poke, celebrate coalescing.
- Selection determinism: fixed seed + scripted day → exact sequence.
- Cooldowns and anti-repetition (last 3 excluded).
- Offline accrual property tests: energy ∈ [0, 100], mood ∈ [20, 100], XP monotonic, level derived.
- Watchdog: a behavior that never ends is reset within `maxDuration + 2 s`.
- Fuzz: 10,000 random events, no unknown state/exception/stuck behavior.
- Bubble policy: gaps, hourly cap, quiet hours, focus suppression.

### 4.2 Focus engine

- Phase sequencing with rounds, long break, auto-start combinations.
- Pause/resume idempotence; no double award.
- Idle auto-pause at 180 s; one prompt; resume/abandon.
- Suspend/lock: zero accrual; resume paused; no completion while away.
- Kill -9 recovery at every second of a short phase; ± 2 s, no award.
- Midnight and DST split fixtures; time-zone change; clock jumps (monotonic).
- XP/streak: completion bonus, partial ≥ 50%, skip/stop, missed day, longest preserved.
- Property tests: daily minutes ≥ 0, streak ≤ days since install, timer within [0, duration].

### 4.3 Pet model and stats

- XP → level thresholds; no XP decay.
- Mood caps (+8/day pokes), neglect decay floor, offline decay cap.
- Cosmetics unlock at exact levels; equip persists.
- Daily aggregation from segments; pruning; recent session cap.

### 4.4 Persistence

- Atomic write fault injection at every step; previous file remains loadable.
- Checksum mismatch, truncation, bit flip, zero-byte file.
- Backup recovery; quarantine naming; defaults + notice.
- Migration fixtures and idempotence; newer-schema read-only mode.
- Queue coalescing; 1,000 rapid changes; flush on quit/suspend.
- Checkpoint recovery ± 2 s.
- Export: valid JSON, no secrets, preview matches file; reset preserves settings.

### 4.5 IPC and schemas

- Zod round-trip for every channel payload.
- 10,000 malformed payloads per channel → `VALIDATION`, no state mutation.
- Sender/frame spoofing → `UNAUTHORIZED`.
- Rate-limit token buckets; legitimate bursts pass.
- Revision ordering; patch gap triggers resync.
- Debug channels absent in production build.

### 4.6 Copy and settings inventory

- Every setting key has a default, a control, and a validation rule.
- Every bubble has one action max and ≤ 80 characters.
- No banned phrases ("streak", "missed", "should") in copy fixtures.

## 5. Contract tests

### 5.1 Rive contract

Load `mochi.riv` in headless Chromium with the bundled runtime and assert:

- Artboard `Mochi` exists with 200×220 bounds.
- State machine `PetSM` and view model `PetModel` exist.
- All required properties exist with the expected types.
- Enum values are accepted and produce a state change within 1 s (runtime smoke if introspection is limited).
- No state-machine inputs are exposed/used.
- File ≤ 2.5 MB; no raster > 512 px.
- `mochi-golden.riv` poses are present for visual tests.

The validator runs on asset PRs and release builds; a failure blocks packaging.

### 5.2 IPC inventory

A snapshot test enumerates every channel with `{direction, schema, surface, rateLimit, handler}`. Adding/removing a channel without updating the snapshot fails. It also asserts the preload API exposes exactly the documented methods and no generic `send`/`invoke`.

### 5.3 Settings and hit regions

- Settings inventory = schema keys = controls = migration coverage.
- Every `RiveBehavior` has a hit-region entry; every entry has a test fixture.

### 5.4 Documentation links

A docs lint script checks internal Markdown links and anchors. Broken links fail CI (this document set is part of the product).

## 6. Component testing

- Den views render with a fake preload implementing `MochiDenApi`; no Electron required.
- Forms: validation messages, autosave debounce, "Saved" confirmation, dirty-state on close.
- Timer display: 1 Hz interpolation does not drift more than 1 s; external pause updates immediately.
- Charts: accessible table toggle, empty state, 7/30-day toggle.
- Settings: each control maps to a key; invalid values are rejected inline.
- Bubble: action/dismiss, auto-dismiss timing with fake timers, `role="status"` announced once.
- Locker: locked/unlocked states, equip, no purchase UI.

## 7. End-to-end testing

Playwright launches the packaged-ish dev build with:

```ts
const app = await _electron.launch({
  args: ['.'],
  env: { ...process.env, MOCHI_TEST: '1', MOCHI_USER_DATA: tmpDir },
});
```

### 7.1 Shell

- Pet window options: transparent, frameless, alwaysOnTop, skipTaskbar, resizable false, sandbox/contextIsolation true.
- Launch does not steal focus: foreground window unchanged (use a helper window).
- Click-through: `debug:getWindowState` reports ignore=true at start, false after pointer enters the body, true after leaving.
- Drag: `sendInputEvent` mousedown/move/up moves the window by the expected delta; a click under 4 DIP does not move it.
- Snap: drop near a corner → bounds equal the corner within 1 DIP.
- Hide/show preserves focus state; single instance via a second launch.
- Renderer crash: `debug:crashRenderer('pet')` → window recreates and snapshot is correct within 3 s.

### 7.2 Focus

- Start from each entry point; all surfaces agree.
- Pause/resume/skip/stop; menu state matches.
- Idle simulation (`debug:simulateIdle(181)`) pauses once.
- Kill -9 recovery: launch, start, kill, relaunch, assert paused + remaining ± 2 s.
- Completion: shortened 3 s phase fixture → celebration event, one toast (mock Notification), XP.
- Notification denial: no error, visual celebration remains.

### 7.3 Den

- Open/close/reopen; last view restored; timer continues while closed.
- Settings save/restart; invalid value rejected.
- Insights fixture values; 200% zoom; keyboard-only flow.
- Export/reset with mocked dialogs; no path from renderer.

### 7.4 What E2E does not cover

- Native tray menu interaction (Windows UI automation is brittle): verify menu construction in main via a test hook, and manual QA.
- Real notification appearance (OS): assert the main notification call and do a manual check.
- Installer/update: VM-based manual/scripted tests.
- Visual charm: human review.

## 8. Visual testing

- **Rive:** use `mochi-golden.riv` static poses (Idle, Sleep, Wave, Focus, Celebrate, Drag) at DPR 1, 1.5, 2 on transparent and two solid backgrounds. Perceptual diff ≤ 1% pixels; a human approves intentional updates.
- **Den:** screenshots of Home/Focus/Insights/Locker/Settings in light, dark, high contrast at 100% and 200%. Threshold ≤ 0.5% pixels; text anti-aliasing differences are masked.
- **Motion:** record a 10 s reel (idle, walk, sleep, wave, focus, celebrate, drag) at 60 fps. Reviewed by design; not pixel-diffed.
- **Wallpaper:** a manual contact sheet over light, dark, busy, and photographic wallpapers to catch halos/rectangles.
- Goldens are stored with the test file and updated only in a PR that explains the visual change.

## 9. Performance testing

The methodology and budgets live in [Performance & reliability](../02-architecture/performance-and-reliability.md#4-measurement-methodology). The automation:

| Scenario | Duration | Assertions |
| --- | --- | --- |
| Startup | 20 cold + 20 warm | p95 to first frame within budget |
| Idle awake | 5 min | CPU target/guardrail, memory, event-loop p95 |
| Roam | 2 min | frame pacing, CPU, no stalls |
| Sleep | 5 min | Rive paused, CPU ≤ 0.2%, no timer faster than 5 s |
| Den open | 5 min | memory within budget, UI responsive |
| Focus 25 min | 25 min | timer drift ≤ 1 s, CPU within idle+1%, notifications once |
| Soak | 8 h | no crash, growth ≤ 10 MB, valid state, drift ≤ 1 s/h |
| Fault storm | 1 h | 100 renderer crashes? no: bounded to 3/10 min, fallback; no unhandled rejections |

CI runs a smoke subset; the full matrix runs nightly on a self-hosted Windows runner and before each RC. A > 10% regression on a guarded metric fails the nightly.

## 10. Security testing

- Fuses verified on the packaged binary; `ELECTRON_RUN_AS_NODE=1` and `--inspect` fail.
- ASAR tamper test: modify one byte → startup refuses.
- Protocol traversal: `..`, `%2e%2e`, encoded slashes, UNC paths, null bytes, unknown extensions → 404, no file read.
- CSP: production build has no `unsafe-eval`, no remote origins; a deliberate inline script is blocked.
- IPC fuzz + sender/frame spoof (see unit/contract).
- Navigation/new-window/permission denial tests.
- Network trace: 30-minute session, only update metadata host.
- Signature verification: tampered installer/update rejected.
- `npm audit --omit=dev` triage; install-script review for new deps.

## 11. Accessibility testing

- axe-core on every Den view and the settings dialogs: 0 critical/serious.
- Keyboard-only script: open Den, start/pause focus, change a setting, export data, close.
- NVDA smoke: landmarks, headings, timer announcements, toggle labels, chart table.
- Reduced motion: OS setting + in-app override; no roaming/confetti; transitions ≤ 150 ms.
- High contrast: Windows theme + in-app toggle; all states distinguishable; contrast ≥ 7:1.
- Target size and focus visibility checked at 200% zoom.
- Manual review of bubble announcements (once, not on repeat).

## 12. Manual QA matrix

| Dimension | Values |
| --- | --- |
| OS | Windows 11 22H2+, Windows 10 22H2 |
| Display | 1920×1080 @ 100%, 4K @ 150%, 1366×768, dual monitors, mixed DPI |
| Power | AC, battery, sleep/resume, lock/unlock |
| Desktop | light/dark wallpaper, busy wallpaper, photographic wallpaper, taskbar top/left/auto-hide |
| Apps | maximized Explorer, PowerPoint fullscreen, exclusive fullscreen game, RDP session |
| Notifications | allowed, denied, Do Not Disturb, quiet hours |
| Input | mouse, touchpad, touch (if available), keyboard-only, high-contrast theme |
| Install | fresh, upgrade from N-1, portable ZIP, uninstall keep/delete, no admin |
| Network | online, offline, blocked update host, slow network |

Each RC records pass/fail with screenshots for any deviation.

## 13. CI pipeline

| Stage | Trigger | Contents | Budget |
| --- | --- | --- | --- |
| PR fast | every PR | lint, typecheck, unit, contract inventory, component, docs links | ≤ 5 min |
| PR build | every PR | electron-vite build, Rive validator, packaged smoke launch | ≤ 10 min |
| Nightly | main | E2E, visual, performance smoke, security checks | ≤ 45 min |
| Release | tag | full E2E, full perf matrix, security checklist, signed artifact | ≤ 2 h |
| Release VM | tag/manual | install/update/uninstall on clean Windows 11/10 | ≤ 1 day |

Coverage gates: domain ≥ 90% lines, persistence ≥ 90%, IPC schemas ≥ 95%, overall ≥ 80%. Coverage is a floor, not a goal; a missed acceptance criterion is a failure even at 100%.

## 14. Flake policy

- Any test that fails intermittently is quarantined within one business day and tracked with a seed/trace.
- CI may retry once for known platform flakes, but a retry-pass is not a green gate; it is recorded.
- Timing tests use fake clocks or generous tolerance (never `sleep` in unit tests).
- E2E waits on state/events, not arbitrary timeouts.
- A flaky test that masks a crash or data loss is a release blocker.

## 15. Requirement traceability

| Requirement group | Primary verification |
| --- | --- |
| FR-WIN-01…18 | E2E window flags, click-through/drag tests, manual DPI/tray matrix |
| FR-ANI-01…14 | Rive contract, behavior unit tests, visual reel, fault injection |
| FR-INT-01…10 | E2E interaction, bubble component tests, manual hover |
| FR-FOC-01…13 | Focus unit suite, crash recovery E2E, midnight/DST fixtures |
| FR-DAT-01…10 | Persistence fault injection, migration fixtures, restart E2E |
| FR-DEN-01…09 | Component + E2E + axe + keyboard/NVDA |
| FR-OPS-01…08 | VM install/update/uninstall, signature checks, About assertions |
| NFR-PERF-* | Performance harness, nightly + RC matrix |
| NFR-REL-* | Fault injection, soak, crash recovery |
| NFR-SEC/PRIV-* | Security checklist, fuzz, network trace |
| NFR-A11Y-* | axe, NVDA, reduced motion, high contrast |
| NFR-MAINT/COMPAT-* | Lint boundaries, coverage, docs lint, OS matrix |

---

**Next:** [Risk register →](risk-register.md)
