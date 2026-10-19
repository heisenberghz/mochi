# Risk Register

| Field | Value |
| --- | --- |
| Status | Living document |
| Version | 1.0 |
| Date | 2026-10-19 |
| Owner | Engineering lead + Product |
| Review cadence | Weekly during build; at every milestone; after beta |

Scoring: **L**ikelihood and **I**mpact on a 1–5 scale; **Score = L × I**. Scores ≥ 15 are red (must have an active mitigation and an owner), 8–14 amber, ≤ 7 green.

## 1. Top risks (detailed)

### R-01 — Transparent-window GPU/DWM artifacts

| | |
| --- | --- |
| L / I / Score | 4 / 5 / **20 (red)** |
| Owner | Engineering lead |
| Trigger | Black/gray flashes, rectangles, stale textures, or tearing during drag/roam on reference or beta hardware |
| Mitigation | S1 tests transparency/motion on Intel, NVIDIA, AMD, and RDP; `hasShadow:false`, fixed size, no backdrop blur; stage-mode fallback; compatibility mode (`disableHardwareAcceleration`) documented; visual QA over busy/photographic wallpapers |
| Contingency | Enable stage mode (window does not move); if artifacts persist, offer software compositing; if still broken, scope a native layered window spike before release |
| Status | Open until S1 closes |

### R-02 — Character/Rive asset late or below the quality bar

| | |
| --- | --- |
| L / I / Score | 4 / 5 / **20 (red)** |
| Owner | Design + Product |
| Trigger | No approvable `.riv` by end of week 1; repeated contract mismatches; animation reel feels stiff |
| Mitigation | Contract-first authoring; placeholder blob artboard in week 1; weekly design review; golden poses and validator early; budget for an external Rive animator if the in-house designer is blocked |
| Contingency | Ship with a reduced animation set (idle/blink/sleep/walk/wave) and add focus/celebrate/drag in v1.1; do not ship a static sticker |
| Status | Highest schedule risk |

### R-03 — Click-through fast-click race

| | |
| --- | --- |
| L / I / Score | 3 / 4 / **12 (amber)** |
| Owner | Engineering |
| Trigger | First-click success < 99% in S1/beta; users report clicks passing through the pet |
| Mitigation | 8 DIP expanded hit zone; toggle on first forwarded mousemove; force interactive during drag/menu; watchdog; first-click E2E at 800 DIP/s |
| Contingency | Implement native `WM_NCHITTEST` helper behind `HitTestPort`; keep the product API unchanged |
| Status | Validate in S1 |

### R-04 — Motion stutter / foot sliding

| | |
| --- | --- |
| L / I / Score | 3 / 4 / **12 (amber)** |
| Owner | Engineering + Design |
| Trigger | Roam frame pacing < 95%; visible foot slide; DWM lag during `setBounds` |
| Mitigation | 60 Hz drift-corrected driver; 30 Hz fallback; speed/facing binding; contact-frame sync; S1 recording |
| Contingency | Stage mode; reduce roam frequency; stationary-only mode if the platform cannot move smoothly |
| Status | Validate in S1/S3 |

### R-05 — Code signing / SmartScreen blocks adoption

| | |
| --- | --- |
| L / I / Score | 4 / 4 / **16 (red)** |
| Owner | Product + Engineering |
| Trigger | No certificate by week 5; SmartScreen "unknown publisher" on beta downloads; antivirus false positive |
| Mitigation | Decide O-3 in week 3; Azure Trusted Signing or OV/EV cert; sign installer + executables; submit to Microsoft for reputation; publish checksums and a support page; staged beta |
| Contingency | Delay public release rather than ship unsigned; run a private signed beta while reputation builds |
| Status | External lead time; start early |

## 2. Full register

| ID | Risk | L | I | Score | Owner | Mitigation | Trigger / contingency |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-01 | Transparent-window GPU/DWM artifacts | 4 | 5 | 20 | Eng lead | S1, compatibility mode, stage fallback, visual QA | Any visible artifact → stage mode; persistent → native window spike |
| R-02 | Rive asset late / weak | 4 | 5 | 20 | Design/Product | Contract-first, placeholder, weekly review, external animator budget | Miss week-1 asset → reduce scope to 5 states for v1 |
| R-03 | Click-through race | 3 | 4 | 12 | Eng | Hysteresis, force-interactive, watchdog, E2E | < 99% first-click → native hit-test helper |
| R-04 | Motion stutter / foot slide | 3 | 4 | 12 | Eng/Design | Drift-corrected 60 Hz, 30 Hz fallback, contact sync | Guardrail miss → stage mode / stationary |
| R-05 | Signing / SmartScreen | 4 | 4 | 16 | Product/Eng | Decide O-3 early, sign, reputation, checksums | No cert by week 5 → delay stable, keep beta private |
| R-06 | Update failure or bricking | 2 | 5 | 10 | Eng | Signature verification, atomic NSIS, VM tests, no downgrade, last-known-good | Failed update → keep current version, retry backoff; bad release → fix forward + reinstall guide |
| R-07 | State corruption / data loss | 2 | 4 | 8 | Eng | Checksums, backup, quarantine, migrations, 2 s checkpoint | Both files corrupt → quarantine + defaults + notice; beta reports → hotfix |
| R-08 | Mixed-DPI / multi-monitor bugs | 4 | 3 | 12 | Eng | DIP-only math, clamp, display events, matrix | Off-screen/incorrect size → hotfix; add display diagnostic export |
| R-09 | Battery drain / fan noise | 3 | 3 | 9 | Eng | Pause hidden/sleep, low-power mode, 30 Hz roam, battery budget | On-battery CPU > guardrail → force low power; disable roam by default on battery |
| R-10 | Accessibility gaps | 3 | 3 | 9 | Design/Eng | WCAG AA, keyboard, NVDA, reduced motion, high contrast from Phase 1 | RC audit failure → block release until fixed |
| R-11 | Scope creep (economy, social, AI) | 4 | 3 | 12 | Product | PRD non-goals, change control, backlog | New feature request → backlog unless it replaces a P0 |
| R-12 | Rive runtime change/deprecation | 2 | 3 | 6 | Eng | Pinned versions, adapter isolation, contract tests | Breaking upgrade → stay pinned; swap to WebGL2 only via ADR |
| R-13 | Windows 10 variance | 3 | 2 | 6 | Eng | Best-effort tier, VM matrix, documented limitations | Core flow broken → mark unsupported or fix before stable |
| R-14 | Notification fatigue / trust loss | 3 | 3 | 9 | Design | Hard caps, quiet hours, no re-engagement, one toast per phase | Beta complaints → reduce to visual-only default |
| R-15 | Exclusive fullscreen covers pet | 4 | 2 | 8 | Product | Hide-in-fullscreen setting, documented limitation | User reports → guidance + setting; no promise of overlay in exclusive fullscreen |
| R-16 | Rive contract drift | 3 | 4 | 12 | Eng/Design | CI validator, shared contract, PR reel, binary versioning | Validator red → block merge; accidental rename → revert asset |
| R-17 | Team capacity / illness | 3 | 4 | 12 | Product | 15% buffer, parallel workstreams, scope cut list ready | Behind by > 1 week at M3 → cut Locker/cosmetics and P1 polish |
| R-18 | Docs/implementation divergence | 3 | 3 | 9 | Eng lead | ADR/spec updates in the same PR, docs lint, milestone review | Divergence found → update docs before next phase gate |
| R-19 | Privacy claim becomes a trap | 2 | 4 | 8 | Product | No telemetry v1, ADR-0009, network trace test, clear policy | Any future telemetry → explicit opt-in + new ADR + prominent notice |
| R-20 | Alt+F4 / zombie process | 2 | 3 | 6 | Eng | `closable:false`, single-instance lock, tray quit, E2E | Zombie report → check `before-quit`/tray lifecycle, hotfix |
| R-21 | Antivirus false positive | 3 | 3 | 9 | Eng | Sign, submit false positives, avoid packers, reproducible builds | Detection → vendor submission + signed update |
| R-22 | Export contains sensitive data | 2 | 4 | 8 | Eng/Product | Preview, allowlist, path minimization, no auto-upload | Leak report → hotfix, notify, review redaction |

## 3. Assumption log

| ID | Assumption | Confidence | Validation | If wrong |
| --- | --- | --- | --- | --- |
| A-1 | Users tolerate a ~100–140 MB Electron app for a high-craft pet | Medium | Beta uninstall reasons + interviews | Investigate a lightweight shell (Tauri/native) for v2 |
| A-2 | 25-minute default is the right first ritual | Medium | Activation and preset usage (consented) | Change default to 15 or 10 min |
| A-3 | Petting is meaningful without progression | Medium | Interaction data + interviews | Strengthen progression or reduce interaction emphasis |
| A-4 | Local-only beats cross-device sync in v1 | High | Beta interviews | Add export/import before sync |
| A-5 | One character is enough for v1 | Medium | D30 / cosmetic engagement | Prioritize cosmetics and pet variants |
| A-6 | Low-frequency Windows toasts are acceptable | Medium | Beta feedback | Default to visual-only, opt-in toasts |
| A-7 | Always-on-top above maximized windows is sufficient | High | S1/manual QA | Hide-in-fullscreen + documentation |
| A-8 | The behavior engine can feel alive with 2 Hz decisions | Medium | Playtest reel | Increase tick rate or move micro-selection into Rive |

## 4. Spike gates

| Spike | Gate | If it fails |
| --- | --- | --- |
| S1 shell feel | No artifacts, first-click ≥ 99%, ≥ 95% frames ≤ 16.7 ms, ignore=true after failure paths | Enable stage mode; if still failing, re-evaluate shell (ADR-0001) before Phase 1 |
| S2 Rive pipeline | Offline load, view model binding, 8 states, validator passes | Block animation integration; fallback to sprites would require a new ADR |
| S3 perf baseline | Idle/roam/sleep within guardrails on reference | Cut FX, lower roam frequency, stage mode; if still failing, revisit Electron |
| S4 packaging | Signed install/update/uninstall on clean VMs | Delay release; do not ship unsigned |

## 5. Kill / pivot criteria

These are explicit, pre-agreed triggers to change direction rather than grind:

| Signal | Threshold | Response |
| --- | --- | --- |
| Beta D7 retention | < 20% with > 40% uninstalls citing resource use | Re-evaluate the shell (Tauri/native) and pet scope; pause feature work |
| Beta activation | < 40% complete a first block within 24 h | Rework onboarding/value prop before scaling; no new features |
| Click-through first-click | < 95% after mitigation | Native hit-test helper becomes a release blocker |
| Roam frame pacing | < 85% after 30 Hz/stage fallback | Ship stationary-only; cut roaming from v1 |
| Asset quality | Design/Product cannot sign off after two rounds | Bring in an external Rive animator or reduce animation scope |
| Crash-free sessions | < 99% in beta | Stop feature work; fix reliability before release |

## 6. Review process

- Weekly: update L/I, add new risks, close resolved ones, assign owners.
- At each milestone: re-score the top five, confirm spike gates, and record decisions in the ADR log.
- After beta: add field risks (support themes), review kill criteria, and decide whether to delay stable.
- A risk with score ≥ 15 requires a named owner and a written contingency; "monitor" is not a mitigation.
