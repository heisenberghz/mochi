# Performance and Reliability

| Field | Value |
| --- | --- |
| Status | Approved for build; budgets validated in spikes S1/S3 |
| Version | 1.0 |
| Date | 2026-10-19 |
| Related | [Requirements](../01-product/requirements.md#non-functional-requirements) · [Desktop shell](desktop-shell.md) · [Test strategy](../05-plan/test-strategy.md) |

Mochi's value depends on being unnoticeable. An always-on-top, always-animating app that costs 5% CPU or leaks memory is worse than no pet at all. This document defines the budgets, how they are measured, and how the app degrades when reality disagrees.

## 1. Budgets

Budgets are **targets** (design goals) and **guardrails** (release blockers). A target miss is a warning; a guardrail miss blocks release unless explicitly waived by engineering and product with a documented reason.

| Metric | Target | Guardrail | Measurement |
| --- | --- | --- | --- |
| Idle CPU, pet awake, no roam | ≤ 1.2% of one core | ≤ 1.5% | 5-min average, 1 s samples |
| Roaming CPU | ≤ 3.5% of one core | ≤ 4.5% | 2-min average during roam |
| Sleep/hidden CPU | ≤ 0.2% | ≤ 0.5% | 5-min average |
| On-battery idle CPU | ≤ 0.8% | ≤ 1.2% | 5-min average |
| Working set, Den closed | ≤ 280 MB | ≤ 320 MB | `app.getAppMetrics()` sum |
| Working set, Den open | ≤ 380 MB | ≤ 450 MB | Same |
| Peak memory (celebration + Den) | ≤ 420 MB | ≤ 500 MB | 1 s sampling |
| GPU utilization, idle | ≤ 8% | ≤ 12% | Windows GPU Engine counters |
| Frame pacing during roam | ≥ 95% ≤ 16.7 ms | ≥ 90% | PresentMon / frame timestamps |
| No frame stall | 0 > 50 ms | ≤ 1 per 2 min | PresentMon |
| Startup to pet visible, cold | ≤ 1.5 s p95 | ≤ 2.0 s | 20 launches, process start → first present |
| Startup, warm | ≤ 800 ms p95 | ≤ 1.0 s | 20 launches |
| IPC invoke round-trip | p95 ≤ 5 ms | p95 ≤ 10 ms | 1,000-ping harness |
| Main event-loop lag | p95 ≤ 20 ms | p95 ≤ 35 ms | `monitorEventLoopDelay` |
| Memory growth, 8 h soak | ≤ 10 MB after warm-up | ≤ 20 MB, no monotonic trend | Linear regression on RSS |
| Installer size | ≤ 130 MB | ≤ 150 MB | Artifact |
| Installed size | ≤ 400 MB | ≤ 450 MB | Program Files + resources |
| Focus timer drift | ≤ 1 s per 60 min | ≤ 2 s | Fake + real clock tests |
| State loss on kill -9 | ≤ 2 s | ≤ 5 s | Checkpoint test |

**Why these numbers:** Electron's own baseline plus two sandboxed renderers is already a few hundred MB; a small Rive canvas at 60 fps is cheap but not free. The budgets are deliberately set where a well-built Electron app can meet them without heroics, and where a regression is visible to users. They are not marketing claims and will be revised with data (with an ADR note if they loosen materially).

## 2. Reference machines

| Tier | Spec | Use |
| --- | --- | --- |
| **Reference** | 4-core/8-thread CPU (e.g., i5-1135G7 class), 16 GB RAM, integrated GPU, 1920×1080 @ 100%, Windows 11 22H2+, SSD | All budgets and release gates |
| **Low-end** | 2-core/4-thread, 8 GB RAM, integrated GPU, 1366×768, Windows 10 22H2 | Guardrail checks; reported separately |
| **High-DPI** | 4K @ 150%, discrete GPU | Visual/DPI and GPU regressions |
| **Battery** | Laptop on battery, balanced power plan | Battery budget |

Results are recorded with OS build, driver version, Electron version, Rive version, display configuration, and whether the Den is open. A number without context is not a result.

## 3. Where the cost goes

| Area | Cost driver | Control |
| --- | --- | --- |
| Transparency compositing | DWM blending a layered window every frame | Small window, no unnecessary invalidation, pause when hidden |
| Rive rendering | Vector complexity, FX particles, canvas size/DPR | 200×220 DIP, DPR ≤ 2, FX off in low power, no React per-frame work |
| Window motion | `setBounds` at 60 Hz | Short bursts, 30 Hz fallback, integer positions |
| IPC | Patches, drag messages, focus ticks | ≤ 10 Hz patches, coalesced drag, 1 Hz focus |
| Persistence | Full-state writes | Debounce, tiny runtime checkpoint, atomic queue |
| Chromium idle | Renderer processes, timers | Lazy Den, sandboxed renderers, no polling faster than 5 s |
| Logging | Sync I/O on the main thread | Async transports, rotation, no debug logging in production |

The pet renderer must not re-render React on every frame. Behavior/property changes go directly to Rive's view model; React state is limited to bubble/hover visibility.

## 4. Measurement methodology

### 4.1 Startup

- Instrument main with `performance.mark` at: process start (`app.getAppMetrics` not yet available), `app.whenReady`, window created, `loadURL` called, `pet:ready` received, `showInactive` called, first renderer frame (`requestAnimationFrame` timestamp sent in `pet:ready`).
- Run 20 cold launches (kill process, clear OS file cache only if representative; report both) and 20 warm launches on the reference machine.
- Report p50/p95, not averages. Attach the trace (`chrome://tracing`-style) to the release artifact.
- S1 validates that `ready-to-show`/asset load does not add a visible flash; startup budget includes the first visible frame, not just window creation.

### 4.2 CPU

- Sample `process.getCPUUsage()` every 1 s in main; it reports percent since the last call. Aggregate to a 5-min mean.
- Cross-check with Windows `Get-Counter '\Process(Mochi*)\% Processor Time'` and Task Manager on the reference machine. Report both "percent of one core" and "percent of total CPU" to avoid unit confusion.
- Scenarios: idle awake (no roam, no bubble), roam, focus, sleep, hidden, Den open idle, celebration burst.
- Close DevTools, disable Windows animations? No: measure the real environment. Report if Windows "Best performance" changes results.

### 4.3 Memory

- Sum `app.getAppMetrics()` `memory.workingSetSize` across processes every 10 s.
- Baseline after 2 min warm-up; report steady, peak, and slope (MB/hour) over 8 h.
- Leak test: 500 behavior transitions, 100 Den open/close cycles, 1,000 focus commands; memory must return to baseline ±10 MB.
- Renderer reload must not grow main memory; verify no retained webContents or event subscriptions.

### 4.4 Frame pacing and smoothness

- **Primary:** PresentMon (or Windows Performance Recorder) captures `MsBetweenPresents` and `MsUntilDisplayed` for the Mochi process during a 2-minute roam. Report the percentage of frames ≤ 16.7 ms, the 99th percentile, and stalls > 50 ms.
- **Secondary (CI-friendly):** the renderer records `requestAnimationFrame` deltas; the motion driver records callback lateness. CI asserts the driver's p99 lateness ≤ 8 ms and no gap > 50 ms. This does not capture DWM composition, so it is a smoke check, not the release number.
- Visual QA records a 10 s screen capture at 60 fps for manual review of tearing, stutter, and foot sliding.

### 4.5 IPC and event loop

- Dev-only `debug:ping` round-trip 1,000 times with small payloads; report p50/p95/p99.
- `monitorEventLoopDelay({ resolution: 10 })` runs continuously in dev and in a release-test build; snapshot percentiles every minute. Production keeps only a coarse histogram in memory (no I/O).
- A patch storm test (100 state changes/s) must not block the loop > 50 ms.

### 4.6 Battery and thermals

- On battery with the balanced plan, measure CPU/GPU and estimate drain over 1 h (report percentage points, not just CPU).
- Sleep and hidden modes are the key battery paths; verify Rive is paused and no timers faster than 5 s run.
- Thermal throttling test: 30-min roam loop on a laptop; frame pacing must stay within guardrail.

### 4.7 Network

- A release-test build logs all `webRequest` requests (URL, method, bytes) to a local diagnostic file.
- Run a 30-minute session: idle, focus, Den, update check. Assert only the configured update metadata host is contacted, no analytics, no CDN.
- This test is a release blocker for [NFR-PRIV-01](../01-product/requirements.md#security-and-privacy).

### 4.8 Soak

- 8-hour simulated workday: random pokes, drags, 6 focus sessions, 20 Den opens, monitor sleep/resume, display changes, update check.
- Assert: no crash, no unhandled rejection, memory slope ≤ 10 MB/8 h, no unbounded arrays, timer drift ≤ 1 s/hour, state file valid at the end.
- Run nightly on CI for the main branch (headless where possible; window-specific soak on a self-hosted Windows runner).

## 5. Instrumentation

| Layer | Instrument | Production? |
| --- | --- | --- |
| Main | `perf_hooks` marks/measures, `monitorEventLoopDelay`, `app.getAppMetrics()` snapshots | Yes, in-memory counters only |
| IPC | Correlation ids, handler duration histogram | Yes, aggregated |
| Behavior | Decision counts, timeouts, watchdog resets | Yes, anonymous counters |
| Animation | Load time, fault count, ack latency, DPR | Yes, aggregated |
| Renderer | rAF delta histogram, long-task observer | Dev/test only |
| Motion | Callback lateness, frames, fallback activations | Yes, aggregated |
| Persistence | Write duration, failures, recovery events | Yes, aggregated |
| Diagnostics | `diagnostics:getInfo` returns versions, flags, counts, last 20 errors | On demand |

No per-frame or per-user timeline leaves the device. The dev overlay (`Ctrl+Shift+P`) shows live FPS, frame budget, event-loop lag, behavior state, IPC p95, and memory; it is not shipped.

## 6. Degradation ladder

When budgets are missed, the app degrades in this order. Each step is automatic where safe and visible in diagnostics.

1. **Disable FX.** Particles, confetti, and extra secondary layers off (`lowPower=true`). No semantic change.
2. **Reduce roam frame rate.** 60 → 30 Hz with wider steps, only while roaming.
3. **Disable roaming.** Pet stays in place but idle animations continue. Triggered by low energy, battery saver, or repeated frame-budget misses.
4. **Sleep low-power.** Pause Rive after the sleep-in transition; static curled pose + CSS Zzz pulse. Wake restores.
5. **Static silhouette.** Animation fault fallback; the timer and Den still work.
6. **Disable the pet window.** If the pet window repeatedly crashes or cannot composite, keep the timer/tray/Den and show a one-time explanation. Never crash the whole app for a rendering failure.

The ladder is a feature, not a silent failure: diagnostics record which rung was reached and why.

## 7. Reliability model

### 7.1 Failure taxonomy and response

| Failure | Detection | Response | User-visible |
| --- | --- | --- | --- |
| Main uncaught exception | `uncaughtException` / `unhandledRejection` | Log, attempt final flush (≤ 250 ms), show native dialog with "Restart" / "Quit", optionally relaunch once | Clear message; no silent zombie |
| Main crash / OOM | Process death | Windows Error Reporting; on next launch, recover state/checkpoint | Normal relaunch; recovery notice if needed |
| Pet renderer crash | `render-process-gone` | Recreate pet window (max 3 in 10 min), push snapshot, reset hit-test/ignore state | Pet disappears briefly, returns ≤ 3 s |
| Den renderer crash | Same | Recreate Den hidden; reopen on demand | Den reopens with state intact |
| Renderer hang | `unresponsive` | Wait 5 s, offer "Reload window" in tray/Den; no forced kill of main | Inline recovery |
| GPU process crash | `child-process-gone` reason `crashed` | Chromium restarts GPU; if 3 in 10 min, switch to software compositing + notify | Possible brief flash; app continues |
| Animation fault | Ack timeout / load error | Retry once, then silhouette fallback | Tooltip + diagnostics |
| Behavior stuck | Watchdog deadline | Force wake/idle, log, count | Pet resumes |
| Persistence failure | Write/rename error | Retry with backoff; keep in-memory state; warn after 3 failures | Settings banner "Changes may not be saved" |
| State corruption | Checksum/Zod | Backup → quarantine → defaults + notice | One-time explanation |
| Update failure | Updater error | Keep running version, retry next interval; no partial install | No interruption |
| Notification failure | OS error | Log, visual fallback | No error |
| Hotkey conflict | Registration failure | Mark unbound, notify once | Settings shows unbound |
| Display loss | `display-removed` | Re-clamp to primary within 500 ms | Pet reappears |
| Update loop | 3 failed checks in a row | Exponential backoff to 24 h, then stop until manual check | Settings shows status |

### 7.2 Crash-loop protection

- Main records `crashCount` and `lastCrashAt` in a tiny sidecar (not state.json) before exiting. If two crashes occur within 60 s, do not auto-relaunch; show the native dialog with "Open logs" and "Start fresh".
- Renderer recreation is throttled: max 3 in 10 minutes, then fall back to a static silhouette for 10 minutes and log `renderer_crash_loop`.
- Update failures use exponential backoff (15 min → 1 h → 6 h → 24 h) and never block launch.

### 7.3 Durability guarantees

- Completed focus phases are flushed immediately; the runtime checkpoint bounds in-progress loss to 2 s.
- Settings changes are debounced but flushed on hide, suspend, and quit; forced kill may lose ≤ 2 s.
- A backup exists after every successful full write; a migration always leaves a pre-migration copy.
- No operation truncates a valid file before a replacement is durable.

### 7.4 Fault injection

Tests deliberately trigger:

- `render-process-gone` for pet and Den, including during focus.
- Kill -9 at 1 s intervals during a focus phase; assert ± 2 s recovery and no double award.
- Rename/remove WASM and `.riv`; assert silhouette fallback and no blank window.
- Simulate permission errors on `%APPDATA%`; assert a single clear error and read-only mode.
- Corrupt/truncate/bit-flip state; assert backup/quarantine paths.
- Deny notifications; assert visual completion.
- Unplug the active display; assert re-clamp.
- Force 30 fps and software compositing; assert no visual state is lost.

## 8. Observability and diagnostics

- Local logs are the primary diagnostic tool; there is no remote crash reporting in v1 ([ADR-0009](../04-adr/0009-privacy-first-observability.md)).
- `diagnostics:getInfo` returns: app/Electron/Rive versions, Windows build, display count and scale factors, GPU vendor/renderer (via `app.getGPUInfo('basic')`), flags, uptime, crash counters, last 20 error codes, performance snapshot (CPU/memory/event-loop p95), and whether the pet is in fallback.
- The user can export a diagnostics bundle (logs + info + optional event log) with a preview. Nothing is uploaded automatically.
- Release health is assessed through beta cohort reports and consented exports, not production telemetry.

## 9. Performance regression process

1. Every PR runs unit/contract/E2E; performance benches run nightly on a self-hosted Windows runner.
2. A regression > 10% on a guarded metric fails the nightly and opens a ticket with the trace and commit range.
3. Release candidates run the full matrix (reference, low-end, high-DPI, battery) and attach results to the release checklist.
4. Budget changes require an ADR note and product sign-off; silent relaxation is not allowed.
5. The dev overlay and diagnostic snapshot are kept in sync with any new metric.

## 10. Release gates

- [ ] 5-min idle CPU within target on reference, within guardrail on low-end.
- [ ] Roam frame pacing ≥ 95% ≤ 16.7 ms (reference) and ≥ 90% (low-end).
- [ ] Startup p95 within budget, 20 cold + 20 warm runs.
- [ ] 8-hour soak: no crash, no > 10 MB growth, state valid, timer drift ≤ 1 s/hour.
- [ ] Working set within budget with Den closed/open.
- [ ] Sleep/hidden CPU within budget; Rive paused.
- [ ] No frame stall > 50 ms in the 2-minute roam capture.
- [ ] Network trace shows only the update host.
- [ ] Fault injection suite passes (renderer kill, kill -9, asset failure, corruption, display loss).
- [ ] Degradation ladder verified manually (FX off, 30 Hz, static fallback).

## 11. Open risks

| Risk | Status | Mitigation |
| --- | --- | --- |
| Transparent-window DWM artifacts during motion | Unknown until S1 | Stage-mode fallback; compatibility mode; S1 gates the motion driver |
| Rive Canvas2D misses frame budget on low-end GPUs | Unknown until S3 | WebGL2 swap; FX off; 30 Hz; static sleep |
| Electron baseline memory grows across majors | Re-measure each major | Budget revision via ADR; Den laziness |
| GPU counters are noisy/vendor-specific | Known | Report ranges, use PresentMon as primary; do not gate on a single noisy sample |
| Always-on-top windows and fullscreen games | Known platform limit | Hide-in-fullscreen setting; documented |

---

**Next:** [Experience spec →](../03-design/experience-spec.md)
