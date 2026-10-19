# Requirements and Acceptance Criteria

| Field | Value |
| --- | --- |
| Status | Approved for build |
| Version | 1.0 |
| Date | 2026-10-19 |
| Related | [PRD](prd.md) · [Architecture](../02-architecture/overview.md) · [Test strategy](../05-plan/test-strategy.md) |

This document is the build contract. A requirement is done only when its acceptance criterion is demonstrated by the listed verification method **and** the change is covered by an automated test where the method is `U`, `I`, or `E`.

## How to read this document

- **Priority:** `P0` blocks v1.0; `P1` ships in v1.0 unless explicitly waived; `P2` is v1.1+; `Dropped` is documented for traceability.
- **Verification:** `U` unit · `I` integration · `E` E2E/Playwright · `M` manual QA · `P` performance harness · `S` security review.
- **Normative keywords:** as defined in [RFC 2119](https://www.rfc-editor.org/rfc/rfc2119).
- Numeric constants are defined once in [System constants](../02-architecture/overview.md#8-system-constants). Values here are acceptance thresholds, not independent tunables.

## Functional requirements

### Window and operating-system integration

| ID | Pri | Requirement | Acceptance criterion | Verify |
| --- | --- | --- | --- | --- |
| FR-WIN-01 | P0 | The pet window MUST be always-on-top of normal and maximized application windows. | With a maximized Explorer window focused, the pet remains visible; `win.isAlwaysOnTop()` is true; level is `screen-saver`. | E, M |
| FR-WIN-02 | P0 | The pet window MUST have a fully transparent background with no native frame or shadow. | A screenshot over a colored desktop shows the desktop color between the pet's pixels; no rectangular fill, border, or shadow; `transparent`, `frame:false`, `hasShadow:false`. | E, M |
| FR-WIN-03 | P0 | The pet MUST NOT appear in the taskbar, Alt+Tab, or window switchers. | `skipTaskbar:true`, `minimizable:false`, `maximizable:false`, `fullscreenable:false`; Alt+Tab never lists Mochi. | E, M |
| FR-WIN-04 | P0 | Showing, launching, or clicking the pet MUST NOT steal keyboard focus from the foreground app. | With Notepad focused, relaunching Mochi leaves the caret in Notepad; clicking the pet leaves the Notepad caret active; foreground window handle is unchanged; the pet window is non-focusable and shown with `showInactive()`. | E, M |
| FR-WIN-05 | P0 | The transparent area MUST pass clicks and wheel input to applications underneath. | Clicking 20 px outside the pet's hit region activates the window below; `setIgnoreMouseEvents(true, {forward:true})` is active when the cursor is outside the hit region. | E, M |
| FR-WIN-06 | P0 | The pet MUST become interactive only while the cursor is over its hit region, with hysteresis to prevent flicker. | Moving onto the pet makes it hoverable/clickable within 100 ms; leaving by more than 8 DIP restores click-through within 150 ms. No more than one toggle per 50 ms. | E |
| FR-WIN-07 | P0 | The pet MUST be draggable by direct pointer manipulation, with a drag threshold separating drag from click. | A press-and-move of ≥ 4 DIP moves the window 1:1 with the cursor (± 2 DIP); a press-and-release under 4 DIP and under 400 ms triggers a poke, not a move. | E, M |
| FR-WIN-08 | P0 | A dropped pet MUST snap to a screen corner when within 48 DIP, with a settle animation, and MUST remember its position. | Dropping 30 DIP from a corner animates to the corner in 120–220 ms; relaunch restores the same monitor and corner. | E |
| FR-WIN-09 | P0 | Mochi MUST roam within the current display's work area without covering the taskbar or leaving the screen. | During 10 minutes of roam, window bounds never intersect the taskbar or exceed `display.workArea`; window fully remains on one display. | E, M |
| FR-WIN-10 | P0 | Window position and size MUST be correct under mixed per-monitor DPI (100–200%). | Moving between a 100% and 150% display keeps the pet at 320×360 DIP and the hit region aligned within 4 DIP; no blurry scaling. | M |
| FR-WIN-11 | P0 | The app MUST handle display add/remove/metrics changes without losing the pet. | Disconnecting the display containing the pet moves it to the primary display's nearest corner within 500 ms. | E, M |
| FR-WIN-12 | P0 | The app MUST be single-instance; a second launch MUST surface the existing Den and pet. | Launching `Mochi.exe` twice produces one process tree and the Den opens; no duplicate tray icons. | E |
| FR-WIN-13 | P0 | A tray icon MUST expose show/hide, focus controls, Den, settings, and quit. | Left-click toggles pet visibility; right-click opens the native menu with all items and correct enabled/disabled state. | M |
| FR-WIN-14 | P0 | Global hotkeys MUST toggle the pet, start/pause focus, and open the Den, and MUST fail gracefully on conflict. | Defaults `Ctrl+Alt+P`, `Ctrl+Alt+F`, `Ctrl+Alt+D`; if a registration fails, a one-time notification explains the conflict and Settings shows it as unbound. | E, M |
| FR-WIN-15 | P1 | Launch-at-login MUST be optional, default off, and MUST start with the pet visible but unfocused. | Enabling writes a login item; after sign-in the pet appears without stealing focus; disabling removes it. | M |
| FR-WIN-16 | P0 | Suspend, resume, lock, unlock, and session-end events MUST be handled without corrupting state or counting suspended time. | A 30-minute suspend during a focus block leaves remaining time unchanged (or pauses), and state is flushed before suspend. | I, M |
| FR-WIN-17 | P1 | Mochi SHOULD hide automatically in exclusive-fullscreen apps if the user enables "Hide in fullscreen". | Setting on: pet hides within 1 s of an exclusive-fullscreen game and returns on exit. Detection limitation is documented. | M |
| FR-WIN-18 | P1 | A second monitor MUST be usable via "Bring Mochi here" from the tray/Den. | The pet moves to the display containing the cursor, clamped to the work area, and remembers that display. | E |

> **Platform limitation:** an always-on-top window cannot be guaranteed above *exclusive* fullscreen applications on Windows. The product must communicate this via the "Hide in fullscreen" setting rather than promise otherwise. See [Desktop shell → Known Windows constraints](../02-architecture/desktop-shell.md#10-known-windows-constraints).

### Animation and behavior

| ID | Pri | Requirement | Acceptance criterion | Verify |
| --- | --- | --- | --- | --- |
| FR-ANI-01 | P0 | The pet MUST support these visual states: `idle`, `walk`, `sleep`, `wake`, `wave`, `focus`, `celebrate`, `drag`. | Each state can be forced via a debug command and visually matches the [Rive contract](../03-design/rive-authoring-contract.md); the active state is reported in diagnostics. | E, M |
| FR-ANI-02 | P0 | In `idle`, the pet MUST never appear frozen: breathing is continuous, blinks occur every 2.5–7 s, and secondary motion (tail/ears) is present. | 60-second observation contains ≥ 8 blinks and continuous chest movement; no static frame longer than 1 s. | M |
| FR-ANI-03 | P0 | Idle micro-behaviors MUST vary over time and not repeat immediately. | In a 5-minute session, at least 3 distinct micro-behaviors occur (look, stretch, ear flick, sit); the same behavior is not selected twice in a row. | U, M |
| FR-ANI-04 | P0 | The pet SHOULD wander along the bottom edge every 90–240 s when eligible, moving at 60–90 DIP/s. | Roam occurs within the window; direction matches travel; walk cycle plays without foot sliding beyond 10% perceived slip; roaming does not occur during focus, drag, or sleep. | E, M |
| FR-ANI-05 | P0 | The pet MUST sleep after 10 minutes of no user input, or after 5 minutes of idle during configured quiet hours, and wake on input/click. | After 10 min OS idle (5 min in quiet hours), state becomes `sleep` within 30 s; input wakes it to `wake` → `idle`; sleep pauses nonessential rendering. | I, M |
| FR-ANI-06 | P0 | `wave` MUST play as a one-shot greeting on first run, return from hidden, and level-up. | Wave completes within 1.5 s and returns to `idle`; never loops. | M |
| FR-ANI-07 | P0 | During a focus session, the pet MUST enter the `focus` posture and MUST NOT roam or initiate nonessential chatter. | Starting focus sets state within 500 ms; window x-position changes by 0 DIP for the duration (unless dragged); no bubbles except user-initiated or phase transitions. | E |
| FR-ANI-08 | P0 | Completed focus phases MUST trigger `celebrate`, rate-limited and interruptible. | Celebration plays after each completed phase, not more than once per 10 s; dragging cancels it cleanly. | E |
| FR-ANI-09 | P0 | Dragging MUST use a distinct dangling pose and settle smoothly on drop. | State is `drag` within 100 ms of threshold; release returns to `idle`/`wake` with a ≤ 250 ms settle; no snap-through of window edges. | M |
| FR-ANI-10 | P0 | Energy and mood MUST evolve over time and MUST NOT create punishing or irreversible states. | Energy drains while awake and recovers while asleep; after 24 h offline, energy recovers up to 100 and mood decays by at most 4; no state requires payment or daily login. | U |
| FR-ANI-11 | P0 | High-priority events MUST preempt low-priority behaviors without leaving the state machine stuck. | A randomized 10,000-event fuzz test never produces an unknown/idle-stuck state; poke during sleep wakes within 1 s. | U, I |
| FR-ANI-12 | P0 | Reduced-motion mode MUST remove window roaming and large movements while preserving state legibility. | With reduced motion on: no window movement from behavior, no confetti, transitions ≤ 150 ms; sleep/idle still distinguishable. | E, M |
| FR-ANI-13 | P0 | A missing or invalid Rive asset MUST degrade gracefully rather than blank the window. | Renaming the `.riv` in a test build shows a static silhouette + tooltip "Animation unavailable"; error is logged; app remains interactive. | E |
| FR-ANI-14 | P1 | Behavior selection MUST be deterministic under an injected clock and seed. | Same seed + event script produces identical behavior sequence across 100 runs. | U |

### Interaction and communication

| ID | Pri | Requirement | Acceptance criterion | Verify |
| --- | --- | --- | --- | --- |
| FR-INT-01 | P0 | Clicking/petting the pet MUST produce an immediate reaction and a small mood increase, rate-limited. | Reaction begins ≤ 100 ms; mood +1 per interaction, max +8/day; no reaction spam when clicking 10×/s. | E, U |
| FR-INT-02 | P0 | Double-click MUST open the Den within 300 ms warm. | Double-click opens/focuses the single Den instance; timer state is preserved. | E |
| FR-INT-03 | P0 | Right-click MUST open a native context menu whose items reflect current state. | Menu shows Start focus (or Pause/Resume/Skip while active), Take a break, Open Den, Settings, Hide, Quit; no dead items. | M |
| FR-INT-04 | P0 | A speech bubble MUST be used for short, contextual messages and MUST NOT block clicks outside itself. | Bubble text ≤ 80 characters, auto-dismisses in 4–8 s, is screen-reader announced, and does not expand the window's interactive area beyond its bounds. | E, M |
| FR-INT-05 | P0 | Bubble frequency MUST be capped. | No more than one unsolicited bubble per 5 minutes and 6 per hour; user-initiated bubbles exempt. | U, E |
| FR-INT-06 | P1 | Hovering MUST produce a subtle attentive reaction (look toward cursor) without a bubble. | Head/eye direction changes within 200 ms when cursor is within 240 DIP; no reaction when reduced motion is on. | M |
| FR-INT-07 | P0 | The context menu and tray MUST allow pausing/resuming/skipping an active focus session correctly. | Commands update the timer within 250 ms and the Den reflects the same state on next paint. | E |
| FR-INT-08 | P0 | Hidden mode MUST be reversible from tray and hotkey, and MUST preserve session state. | Hiding during focus keeps the timer running; restore shows the pet with the correct phase. | E |
| FR-INT-09 | P0 | Pet interaction MUST never be required to keep progress or avoid negative consequences. | Missing 30 days produces no penalty beyond small mood decay; XP/streak never decreases. | U |
| FR-INT-10 | P1 | Scrolling over the pet MUST NOT zoom or resize the window. | Wheel events over the pet scroll nothing and do not alter scale. | E |

### Focus engine

| ID | Pri | Requirement | Acceptance criterion | Verify |
| --- | --- | --- | --- | --- |
| FR-FOC-01 | P0 | The user MUST be able to start, pause, resume, skip, and stop a focus session from the pet menu, tray, hotkey, and Den. | All four entry points converge on one authoritative state within 250 ms. | E |
| FR-FOC-02 | P0 | Durations MUST be configurable within safe bounds and validated. | Focus 5–120 min, short break 1–30, long break 5–60, rounds 2–8; invalid values rejected with inline error; persisted only if valid. | U, E |
| FR-FOC-03 | P0 | The timer MUST execute work → short break → work → … → long break with configurable auto-start. | With 2 rounds and 1-minute test durations, the phase sequence matches the configured cycle exactly. | U, E |
| FR-FOC-04 | P0 | Timer accuracy MUST be monotonic and drift-resistant. | Over a 60-minute block, displayed remaining time differs from a reference stopwatch by ≤ 1 s; system clock changes do not lengthen/shorten the phase. | U, E |
| FR-FOC-05 | P0 | The timer MUST auto-pause after 180 s of system idle during a work phase. | Simulated 181 s idle pauses the session and records reason `idle`; no XP is awarded while paused. | I |
| FR-FOC-06 | P0 | On resume after idle, the user MUST be offered resume or abandon (configurable to auto-resume). | A bubble/tray action appears once; choosing abandon records the partial session without breaking the streak (if ≥ 50% complete). | E |
| FR-FOC-07 | P0 | System suspend MUST NOT count toward focus time. | 30-minute suspend during a 25-minute block resumes with the pre-suspend remaining time; no completion fires during suspend. | I |
| FR-FOC-08 | P0 | An interrupted app (crash, kill, power loss) MUST recover an active session without awarding unearned completion. | After kill -9 and relaunch, the Den offers "Resume block (paused)" with remaining time saved at last tick (± 2 s); no XP awarded until completion. | I, E |
| FR-FOC-09 | P0 | Starting a focus session MUST suppress roaming and nonessential notifications. | No roam events during the phase; update prompts are deferred; only phase transitions and explicit user actions may notify. | E |
| FR-FOC-10 | P0 | Phase completion MUST notify the user with one toast and one pet celebration, honoring quiet mode. | Toast appears once; mute suppresses sound but not the visual; quiet hours suppress toast but keep a subtle in-pet cue. | M |
| FR-FOC-11 | P0 | Achievements MUST be awarded by deterministic rules. | 1 XP per completed focus minute; partial sessions ≥ 50% award prorated XP but no session count; streak increments on the first completed session of a local day. | U |
| FR-FOC-12 | P1 | Only one session may exist at a time, across all surfaces. | Starting focus from the Den while active is a no-op with an explanatory, non-blocking message. | U, E |
| FR-FOC-13 | P0 | Focus history MUST be attributed to the correct local date, including sessions crossing midnight and DST. | A session 23:50–00:15 counts 10 min on day 1 and 15 min on day 2; DST transitions do not create negative or duplicate days. | U |

### Data, settings, and preferences

| ID | Pri | Requirement | Acceptance criterion | Verify |
| --- | --- | --- | --- | --- |
| FR-DAT-01 | P0 | Settings and pet progress MUST persist across restarts and updates. | Change 10 settings, restart, kill, and update; all valid values persist; schema version is current. | E |
| FR-DAT-02 | P0 | Writes MUST be crash-safe and atomic. | Killing the process during 100 rapid setting changes leaves a loadable state or a valid backup; no zero-byte file. | I |
| FR-DAT-03 | P0 | Corrupt state MUST be recovered without silent data loss. | Truncated primary + valid backup restores backup; both corrupt → quarantine both, start defaults, show a one-time explanation and path to the files. | I |
| FR-DAT-04 | P0 | Schema migrations MUST be sequential, tested, and idempotent. | Fixture for each historical schema migrates to current; running the migrator twice is a no-op; pre-migration backup exists. | U |
| FR-DAT-05 | P1 | The user MUST be able to export their data and diagnostics as local files. | Export produces a readable JSON with version, no secrets, and a timestamped filename; diagnostics preview shows the payload before saving. | E |
| FR-DAT-06 | P1 | Reset MUST require explicit confirmation and offer "keep my stats". | Reset progress clears pet/XP/stats but preserves settings if chosen; action is logged; no undo needed. | E |
| FR-DAT-07 | P0 | Core functionality MUST work fully offline. | With networking disabled, launch, focus, animations, stats, settings, and drag all work; only update checks fail quietly. | E, M |
| FR-DAT-08 | P0 | Data retention MUST be bounded. | Daily aggregates retained indefinitely; diagnostic event log capped at 30 days / 5 MB; no unbounded arrays in state. | I |
| FR-DAT-09 | P0 | The store MUST reject unknown or out-of-range values rather than apply them. | Fuzzing 10,000 malformed states never crashes; invalid fields fall back to last-known-good/default per field where safe. | U |
| FR-DAT-10 | P0 | State MUST be flushed on quit, suspend, and hide-to-tray. | ≤ 2 s of settings changes are lost on forced kill; normal quit loses none. | I |

### Den UI

| ID | Pri | Requirement | Acceptance criterion | Verify |
| --- | --- | --- | --- | --- |
| FR-DEN-01 | P0 | The Den MUST open as a single instance within 300 ms warm and 1.2 s cold. | Measured p95 over 20 launches; repeated clicks focus the existing window. | E, P |
| FR-DEN-02 | P0 | The Den MUST contain Home, Focus, Insights, Locker, and Settings. | All destinations reachable via sidebar and keyboard; active destination is indicated and announced. | E, M |
| FR-DEN-03 | P0 | Timer controls MUST be fully usable from the Den and reflect external changes live. | Start/pause from tray updates Den within 250 ms; no stale controls. | E |
| FR-DEN-04 | P0 | Insights MUST show 7-day and 30-day focus minutes, sessions, breaks, and current/longest streak. | Values match fixtures for seeded data; empty state is informative and non-judgmental. | E, U |
| FR-DEN-05 | P0 | Settings MUST expose every user-visible preference, grouped and searchable. | A settings inventory test asserts each key has a control; changed values apply without restart unless marked. | E |
| FR-DEN-06 | P1 | Locker MUST show unlocked/locked cosmetics without pressure mechanics. | Locked items show level requirement; no countdowns, currency, or purchase UI. | M |
| FR-DEN-07 | P0 | The Den MUST be usable with keyboard only and at 200% scaling. | Full flow with Tab/Enter/Escape; no clipped text or unusable controls at 200% / 1024×700. | E, M |
| FR-DEN-08 | P1 | The Den MUST follow the OS light/dark theme, with a manual override. | Toggling OS theme updates within 1 s when set to System; manual override persists. | E, M |
| FR-DEN-09 | P0 | Critical information MUST NOT exist only in the pet bubble. | Every bubble message has an equivalent in Den/tray history or is purely decorative. | M |

### Packaging, updates, and lifecycle

| ID | Pri | Requirement | Acceptance criterion | Verify |
| --- | --- | --- | --- | --- |
| FR-OPS-01 | P0 | The installer MUST be a signed, per-user NSIS package requiring no admin rights. | Installs to `%LOCALAPPDATA%`, no UAC prompt, signature valid, `appId` consistent with notifications. | M |
| FR-OPS-02 | P0 | Auto-update MUST check in the background and never interrupt a focus session. | Check 10 s after launch and every 6 h; download in background; install prompt deferred until focus is idle; quit-install path available. | E, M |
| FR-OPS-03 | P0 | A failed or tampered update MUST NOT brick the app. | Invalid signature/download leaves the current version running and logs the failure; last-known-good remains launchable. | M |
| FR-OPS-04 | P0 | Uninstall MUST remove program files and offer to keep or delete user data. | Default keeps data with a clear note; explicit delete removes the data directory; no orphan startup entries. | M |
| FR-OPS-05 | P0 | The app MUST expose version, build channel, licenses, privacy policy, and support link. | All present in Settings → About; links open in the default browser after allowlist validation. | M |
| FR-OPS-06 | P0 | Crash logs MUST be local, rotated, and free of sensitive content. | Logs in `userData/logs`, ≤ 5 MB, 7 files; no window titles, file contents, or tokens. | S, I |
| FR-OPS-07 | P1 | The app SHOULD offer a portable ZIP build without installer. | ZIP launches with a local data directory when `--portable`; no registry writes. | M |
| FR-OPS-08 | P0 | The app MUST set a Windows AppUserModelID so toasts are attributed correctly. | Notifications show "Mochi" and the correct icon in Action Center. | M |

### Accessibility

| ID | Pri | Requirement | Acceptance criterion | Verify |
| --- | --- | --- | --- | --- |
| FR-A11Y-01 | P0 | The Den MUST meet WCAG 2.2 AA for contrast, focus, and target size. | Automated axe scan: 0 critical/serious issues; manual contrast check ≥ 4.5:1 for body text. | E, M |
| FR-A11Y-02 | P0 | A reduced-motion setting MUST be honored by the pet and the Den. | No roaming/large motion; Den transitions ≤ 150 ms; preference persists and can follow OS setting. | E, M |
| FR-A11Y-03 | P0 | Interactive pet actions MUST have keyboard-accessible equivalents. | Start/pause, open Den, hide/show, and mute reachable via global hotkeys and/or tray without pointer. | M |
| FR-A11Y-04 | P0 | Bubbles and status changes MUST be announced without stealing focus. | `role="status"`/`aria-live="polite"` present; screen-reader announcement occurs once per message, not for decorative animation. | M |
| FR-A11Y-05 | P1 | A high-contrast mode MUST be available for the Den and bubble. | Toggle meets 7:1 body contrast; borders remain visible; tested with Windows high-contrast theme. | M |
| FR-A11Y-06 | P0 | Color MUST NOT be the only indicator of state. | Focus/sleep/break states have text or icon equivalents in Den and tray tooltip. | M |

## Non-functional requirements

### Performance and efficiency

Budgets apply to the **reference machine** (4-core/8-thread CPU, 16 GB RAM, integrated GPU, 1920×1080 @ 100%) and the **low-end machine** (2-core, 8 GB, 1366×768). Measurement method is in [Performance & reliability](../02-architecture/performance-and-reliability.md#4-measurement-methodology).

| ID | Pri | Requirement | Budget | Verify |
| --- | --- | --- | --- | --- |
| NFR-PERF-01 | P0 | Idle CPU (pet visible, awake, no roam) | ≤ 1.2% of one core, 5-min average (guardrail 1.5%) | P |
| NFR-PERF-02 | P0 | Roaming CPU | ≤ 3.5% of one core, 2-min average | P |
| NFR-PERF-03 | P0 | Working set (all processes) | ≤ 280 MB with Den closed; ≤ 380 MB with Den open; ≤ 420 MB peak | P |
| NFR-PERF-04 | P0 | GPU utilization, idle | ≤ 8% on integrated graphics | P |
| NFR-PERF-05 | P0 | Startup to pet visible | ≤ 1.5 s cold p95; ≤ 800 ms warm p95 | P, E |
| NFR-PERF-06 | P0 | Roam frame pacing | ≥ 95% of frames within 16.7 ms; no stall > 50 ms | P |
| NFR-PERF-07 | P0 | IPC round-trip (invoke) | p95 ≤ 5 ms, p99 ≤ 15 ms | P |
| NFR-PERF-08 | P0 | Main-process event-loop lag | p95 ≤ 20 ms, p99 ≤ 50 ms | P |
| NFR-PERF-09 | P1 | Installer / installed size | ≤ 130 MB / ≤ 400 MB | P |
| NFR-PERF-10 | P0 | Memory growth over 8-hour soak | ≤ 10 MB after warm-up; no monotonic trend | P |
| NFR-PERF-11 | P0 | Battery behavior | Sleep/hidden stops animation rendering; on-battery idle CPU ≤ 0.8% | P, M |
| NFR-PERF-12 | P0 | Update check MUST NOT block startup or interaction | First check ≥ 10 s after `ready-to-show`; all work async | E |

### Reliability and recovery

| ID | Pri | Requirement | Budget / criterion | Verify |
| --- | --- | --- | --- | --- |
| NFR-REL-01 | P0 | Crash-free sessions (beta) | ≥ 99.5% | Telemetry (consented) / logs |
| NFR-REL-02 | P0 | Renderer crash recovery | Pet or Den recreated within 3 s; domain state intact | I |
| NFR-REL-03 | P0 | Maximum state loss on forced kill | ≤ 2 s of changes | I |
| NFR-REL-04 | P0 | Unhandled promises/rejections | 0 in a 1-hour fault-injection run | I |
| NFR-REL-05 | P0 | Shutdown | Flushes state, unregisters hotkeys/tray, exits ≤ 2 s | E |
| NFR-REL-06 | P0 | Update rollback | A failed update leaves the previous version launchable; verified on VM | M |

### Security and privacy

| ID | Pri | Requirement | Acceptance criterion | Verify |
| --- | --- | --- | --- | --- |
| NFR-SEC-01 | P0 | Renderers MUST be sandboxed with context isolation and no Node integration. | `sandbox:true`, `contextIsolation:true`, `nodeIntegration:false` on every `BrowserWindow`; test asserts options. | E, S |
| NFR-SEC-02 | P0 | A strict CSP MUST be enforced in production. | No `unsafe-eval`; `wasm-unsafe-eval` only where required; remote origins blocked; violations logged in dev. | S |
| NFR-SEC-03 | P0 | Navigation and new windows MUST be blocked except allowlisted external links. | `will-navigate` prevented; `setWindowOpenHandler` denies; only `https://` allowlist opens via `shell.openExternal`. | E, S |
| NFR-SEC-04 | P0 | Every IPC payload MUST be validated at the receiving boundary. | Unknown channel, malformed payload, or wrong sender is rejected and logged; fuzz suite has zero crashes. | U, S |
| NFR-SEC-05 | P0 | Electron fuses MUST disable unused capabilities in production. | `RunAsNode` off, `NODE_OPTIONS` off, `--inspect` off, ASAR integrity on. | S |
| NFR-SEC-06 | P0 | Installer and updates MUST be code-signed and signature-verified. | Windows signature valid; updater rejects unsigned/tampered artifacts. | M, S |
| NFR-SEC-07 | P0 | No remote code or remote UI at runtime. | All HTML/JS/assets packaged; Rive files bundled and version-pinned. | S |
| NFR-SEC-08 | P1 | Dependency vulnerabilities MUST be triaged before release. | `npm audit` high/critical = 0 unreviewed; exceptions documented with expiry. | S |
| NFR-PRIV-01 | P0 | No network requests by default except update metadata. | Network trace during a 30-minute session shows only the update endpoint; no analytics. | S, M |
| NFR-PRIV-02 | P0 | No PII or content in logs or exports. | Log review checklist passes; paths minimized; no window titles/keystrokes. | S |
| NFR-PRIV-03 | P0 | Diagnostics upload MUST require explicit consent and preview. | No upload path exists without user action; preview shown before send. | S, M |
| NFR-PRIV-04 | P0 | Idle detection MUST use duration only. | `powerMonitor` idle time only; no input content, no hooks, no screen capture. | S |
| NFR-PRIV-05 | P0 | A data inventory MUST be published in-app. | About/Privacy lists stored fields, location, retention, deletion. | M |

### Accessibility, maintainability, compatibility

| ID | Pri | Requirement | Criterion | Verify |
| --- | --- | --- | --- | --- |
| NFR-A11Y-01 | P0 | Den meets WCAG 2.2 AA | axe: 0 critical/serious; manual keyboard pass | E, M |
| NFR-A11Y-02 | P0 | Reduced motion honored | No window roam, no confetti, ≤ 150 ms transitions | E |
| NFR-A11Y-03 | P0 | Screen-reader semantics | Landmarks, labels, live regions verified with NVDA | M |
| NFR-MAINT-01 | P0 | Domain layer MUST NOT import Electron, React, or Node I/O. | ESLint boundary rule fails CI on violation | U |
| NFR-MAINT-02 | P0 | Domain test coverage | ≥ 90% lines for behavior, focus, persistence migrations | U |
| NFR-MAINT-03 | P0 | Rive contract validation | CI fails if artboard, state machine, view model, or properties drift | E |
| NFR-MAINT-04 | P0 | IPC channel inventory | Snapshot test fails on undocumented channel/schema change | U |
| NFR-MAINT-05 | P0 | Docs/ADR hygiene | Behavior-changing PR updates the affected spec or ADR | Review |
| NFR-MAINT-06 | P1 | Build reproducibility | `npm ci` + lockfile builds the same artifact inputs on CI | CI |
| NFR-COMPAT-01 | P0 | Windows 11 22H2+ fully supported | Full test matrix passes | M |
| NFR-COMPAT-02 | P1 | Windows 10 22H2 best effort | Core flows pass; known limitations documented | M |
| NFR-COMPAT-03 | P0 | Scaling 100/125/150/200% | Pet and Den correct, no clipping | M |
| NFR-COMPAT-04 | P0 | Mixed-DPI multi-monitor | Position/size/hit region correct within 4 DIP | M |
| NFR-COMPAT-05 | P0 | No admin rights required | Install, run, update, uninstall as standard user | M |
| NFR-COMPAT-06 | P0 | Fully offline core | No network needed for any core flow | E |

## Cross-cutting acceptance criteria

| ID | Criterion | Applies to |
| --- | --- | --- |
| AC-01 | A new user can complete onboarding and start a focus block in ≤ 3 interactions and ≤ 30 s. | FR-INT, FR-FOC, FR-DEN |
| AC-02 | No interaction ever traps the user: hide, pause, mute, and quit are reachable within two actions from the pet. | All |
| AC-03 | Killing the app at any point never loses a completed focus session or corrupts settings. | FR-DAT, FR-FOC |
| AC-04 | The pet never covers a system dialog, taskbar, or notification area in a way that blocks interaction. | FR-WIN |
| AC-05 | Every animated state is distinguishable in a still screenshot (for reduced-motion and accessibility). | FR-ANI |
| AC-06 | The app remains usable when notifications are disabled at the OS level. | FR-FOC, FR-DEN |
| AC-07 | The app remains usable when the pet window fails to load its animation. | FR-ANI-13 |
| AC-08 | All user-facing strings are externalized and free of developer jargon. | FR-DEN, FR-INT |

## Out-of-scope requirements (explicitly dropped)

| Requirement | Reason |
| --- | --- |
| Cloud sync and accounts | No server in v1; privacy-first local model. Revisit only with clear user demand. |
| App/website blocking | Requires broad OS permissions and conflicts with the "never in the way" principle. |
| Screen or keystroke monitoring | Privacy violation; idle duration is sufficient. |
| Multiple simultaneous pets | Window/resource multiplication and unclear value in v1. |
| User-supplied `.riv` assets | Security and contract-validation burden; design the loader for v2, do not ship it. |
| In-app purchases | No monetization in v1. |
| Auto-hide in all fullscreen apps | No reliable Win32 signal without a native helper; opt-in best effort only. |

## Traceability

| PRD feature | Requirements |
| --- | --- |
| F1 Presence | FR-WIN-01…18 |
| F2 Idle animations | FR-ANI-01…14 |
| F3 Interaction | FR-INT-01…10, FR-WIN-05…08 |
| F4 Behavior/mood | FR-ANI-02…12, FR-DAT-01, FR-INT-09 |
| F5 Focus timer | FR-FOC-01…13, FR-DAT-07…10 |
| F6 Insights | FR-DEN-04, FR-DAT-05, FR-FOC-11/13 |
| F7 Den | FR-DEN-01…09 |
| F8 System integration | FR-WIN-12…18, FR-OPS-08, FR-A11Y-03 |
| F9 Progression | FR-ANI-06, FR-FOC-11, FR-DEN-06, FR-INT-09 |
| F10 Lifecycle | FR-OPS-01…08, NFR-SEC-01…08 |

---

**Next:** [Architecture overview →](../02-architecture/overview.md)
