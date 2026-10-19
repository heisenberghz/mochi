# Product Requirements Document — Mochi

| Field | Value |
| --- | --- |
| Status | Approved for build |
| Version | 1.0 |
| Date | 2026-10-19 |
| Owner | Product |
| Target release | v1.0 (Windows) |
| Related | [Requirements](requirements.md) · [Roadmap](../05-plan/roadmap.md) · [Risk register](../05-plan/risk-register.md) |

---

## 1. Summary

Mochi is a desktop companion for Windows: a small, beautifully animated pet that lives in a corner of the screen, reacts to you, and quietly supports a focus practice. It is always visible when you want it, never in the way when you do not, and it makes completing focused work feel good.

The product is deliberately **not** a productivity dashboard. It is a character with a light layer of focus tooling underneath. The pet is the reason to keep it open; the timer and insights are the reason it earns its place.

**The bet:** a warm, low-demand, high-craft presence increases the likelihood that someone starts and finishes focused work, and makes the app pleasant enough to keep installed.

## 2. Problem

Knowledge workers already know they should focus. The failure is rarely information — it is friction, isolation, and recovery:

- **Starting friction.** Opening a timer app is a context switch. Many people abandon Pomodoro tools because the tool itself becomes another dashboard to maintain.
- **Drift without awareness.** Long sessions blur. A gentle, ambient cue can bring attention back without a modal or a shame-inducing streak warning.
- **Reward deficit.** Completing a block of work often produces no moment of closure. A small celebration creates a punctuation mark.
- **Attention tax.** Existing desktop pets are often cute but intrusive: they steal focus, block clicks, drain battery, or nag. Existing focus apps are effective but sterile and easy to close.

The opportunity is a single artifact that is **ambient, charming, and useful** — closer to a desk toy than a productivity suite.

> These are product hypotheses, not validated market claims. Validation plan is in [§10](#10-success-metrics-and-validation).

## 3. Vision and promise

> **A tiny companion that makes focused work feel less lonely — and never makes you feel behind.**

The promise to the user:

1. **It is always there, but never in the way.** No stolen focus. No blocked clicks. No taskbar clutter.
2. **It feels alive.** Movement has weight, timing, and personality; it reacts to you and to the time of day.
3. **It helps without nagging.** One gentle nudge beats five notifications. Silence is a feature.
4. **Your data stays yours.** No account, no cloud, no behavioral profiling. Everything works offline.
5. **It gets out of the way.** One click to hide, one hotkey to bring it back, and a clean uninstall.

## 4. Principles

| Principle | Implication | Anti-pattern we reject |
| --- | --- | --- |
| **Ambient by default** | The pet occupies a corner, not the center. No persistent panels. | Full-screen mascots, bouncing alerts, always-open dashboards. |
| **Warmth over gamification** | Rewards are small, earned, and diegetic (a happy wiggle, a new scarf). | Loot boxes, guilt streaks, loss-aversion mechanics. |
| **One nudge, then silence** | Notifications are rate-limited and context-aware. | "You haven't focused in 3 days" push notifications. |
| **User control is visible** | Hide, pause, mute, reduce motion, and quit are always one action away. | Hidden settings, unclosable windows, dark-pattern retention. |
| **Craft is the feature** | Frame pacing, easing, copy, and install experience are product scope. | "We'll polish it later" for a product whose value is feel. |
| **Local-first** | No account required. No network required for any core feature. | Cloud sync before it is needed, telemetry-by-default. |

## 5. Users

### Primary persona — "Maya," the context-switching designer

- 27–35, product designer or marketer, Windows laptop + external monitor.
- Works in 30–90 minute bursts, frequently interrupted by Slack.
- Has tried Pomodoro apps and Forest-style apps; abandoned them because they were either too sterile or too punitive.
- Wants: a low-effort ritual, a visual anchor, and a reason to take breaks.
- Fears: another app that judges her or adds maintenance.

### Secondary persona — "Devon," the deep-work engineer

- 30–45, senior IC, 6–10 hours at the desk, two monitors, keyboard-first.
- Cares about performance, battery, and not being interrupted.
- Wants: a tiny presence that does not cost resources, a fast timer via hotkey, and stats that are honest.
- Fears: jank, memory leaks, an app that steals focus mid-build.

### Tertiary persona — "Priya," the freelance generalist

- 35–50, runs her own practice, switches between client work and admin.
- Needs gentle structure and a sense of company while working alone.
- Wants: lightweight streaks, a pretty desk companion, and no subscription.
- Fears: losing her data, complicated setup, another account.

### Explicit non-user for v1

Teams, enterprise IT, users who want app blocking or surveillance-based coaching. v1 is a single-user, local-first desktop product.

## 6. Jobs to be done

| When… | I want to… | So that… | Product answer |
| --- | --- | --- | --- |
| I sit down to start work | begin a focus block without opening a dashboard | I actually start | Tray/hotkey start, pet reacts, bubble confirms |
| I drift after 20 minutes | be brought back gently | I recover the block | Context-aware nudge, never more than one per block |
| I finish a block | feel a moment of closure | the work feels worth it | Celebration animation, XP, streak update |
| I take a break | be reminded to move | I do not burn out | Break phase, stretch suggestion from Mochi |
| I am in flow | not be interrupted | I stay in flow | Roaming pauses, notifications suppressed |
| I close my laptop | trust that my progress is safe | I do not lose my streak | Atomic persistence, crash recovery, resume prompt |
| I am not working | have the pet be quiet | it does not become noise | Sleep state, quiet hours, hide to tray |
| I want it gone | remove it cleanly | I stay in control | Hide, pause, quit, uninstall with data choice |

## 7. Experience narrative

**First run.** Mochi drops into the bottom-right corner with a soft bounce, looks around, and waves. A small speech bubble says: *"Hi, I'm Mochi. Want to focus for 25 minutes?"* Two quiet actions: **Start** and **Just say hi**. No account, no tour, no permissions dialog beyond the OS notification prompt when the first focus session starts.

**A workday.** Mochi idles: breathing, blinking, occasionally looking toward the cursor. Every few minutes it stretches or pads a few steps along the bottom edge. When you start a focus session, it puts on tiny glasses, sits beside the timer, and stops roaming. At the halfway mark it might glance up at you; it does not speak unless you hover. When the block ends, it celebrates with a small confetti burst and a bubble: *"25 minutes. That's a good block."*

**A break.** Mochi stretches, suggests a glass of water, and wanders. If you ignore the break and keep typing, it does not nag; it simply waits.

**Evening.** After a configurable quiet hour, Mochi curls up and sleeps. The window stays, but rendering drops to a low-power loop. A click wakes it briefly, then it settles again.

**A bad day.** No focus sessions. Mochi is still there, maybe a little sleepy, never disappointed. The Den shows the truth without judgment: *"A quiet week. Want to try a 10-minute block?"*

## 8. Scope

### 8.1 Release scope

| Capability | v1.0 | v1.1 | v2 | Notes |
| --- | --- | --- | --- | --- |
| Transparent, always-on-top, draggable pet | ✅ Must | | | Core |
| Idle animation set: breathe, blink, look, stretch, walk, sleep, wake, wave | ✅ Must | | | Core |
| Behavior director (time, energy, context) | ✅ Must | | | Makes it feel alive |
| Petting/clicking reactions, drag reactions, snapping | ✅ Must | | | Core |
| Roaming along screen edge | ✅ Must | Advanced paths | | Keep v1 simple |
| Focus timer (Pomodoro) + idle detection | ✅ Must | | | |
| Break nudges + completion celebration | ✅ Must | | | |
| Stats: daily focus, sessions, streaks | ✅ Must | Richer charts | | |
| Den window (home, focus, insights, settings) | ✅ Must | Locker | | |
| Energy/mood model | ✅ Must | | | Light touch, not punitive |
| XP, levels, 3–5 unlockable accessories | ✅ Should | More cosmetics | | No purchases |
| Tray, hotkeys, launch at login | ✅ Must | | | |
| Multi-monitor + per-monitor DPI | ✅ Must | | | |
| Reduced motion / accessibility settings | ✅ Must | | | |
| Auto-update + signed installer | ✅ Must | | | |
| User-imported Rive pets / multiple pets | | | ✅ Could | Requires sandboxing and asset validation |
| Cloud sync / accounts | | | ❌ Won't (v2) | Local-first by design |
| App/website blocking, screen monitoring | ❌ Won't | | | Privacy and scope |
| AI chat companion | ❌ Won't | | | Different product |
| Mobile/macOS/Linux | ❌ Won't | | | Windows-first |

### 8.2 Feature detail

#### F1 — Presence

A frameless, transparent window that sits above normal windows, hides from the taskbar and Alt+Tab, and never takes focus on launch. It can be dragged anywhere, snaps to corners, remembers its position per monitor, and recovers gracefully when a monitor disappears.

**Why:** The pet must feel like part of the desktop, not an app window.

#### F2 — Idle animation set

A layered Rive state machine provides continuous breathing and blinking, random micro-gestures, a walk cycle, sleep/wake, waving, focus posture, celebration, and a dangling drag pose. Motion is characterful at 12–24 fps for gestures and smooth at 60 fps for locomotion.

**Why:** Lifelike idle motion is the core delight; it is also the hardest thing to fake with static art.

#### F3 — Interaction

- **Hover:** subtle attention (head turn toward cursor), optional hint bubble after a delay.
- **Click/pet:** happy reaction, small mood boost, rate-limited.
- **Drag:** pick up, dangle, drop with a soft settle; snap to corners within a threshold.
- **Double-click:** open the Den.
- **Right-click:** native context menu (start/pause focus, nap, settings, hide, quit).
- **Hotkeys:** toggle pet, start focus, open Den.

**Why:** Direct manipulation creates ownership and makes the pet feel physical.

#### F4 — Behavior and mood

Mochi has energy (0–100), mood (0–100), and XP. Energy drains slowly while awake and recovers while sleeping. Mood rises with petting and completed focus, falls slowly with long neglect. Behavior selection weighs time of day, energy, mood, recent actions, and whether a focus session is active. No state is punishing; low energy means naps, not death.

**Why:** Variation is what makes a companion feel alive across weeks.

#### F5 — Focus timer

A Pomodoro-style timer with configurable focus/short break/long break durations, auto-start options, pause/resume, skip, and stop. It detects system idle and offers auto-pause after three minutes away. It survives sleep, crashes, and restarts. Starting a session suppresses roaming, changes the pet's posture, and silences nonessential notifications.

**Why:** The utility layer that justifies daily use.

#### F6 — Insights

Local-only daily aggregates: focus minutes, completed sessions, breaks taken, best day, current and longest streak. A simple 7-day/30-day view. No scores, no comparisons to other users.

**Why:** Progress should be visible without becoming a dashboard.

#### F7 — Den

A standard window with five destinations: **Home** (pet status + quick start), **Focus** (timer), **Insights** (stats), **Locker** (cosmetics), **Settings**. Accessible with keyboard, readable at 200% scaling, and fast to open (<300 ms warm).

#### F8 — System integration

Tray menu, optional launch at login, global hotkeys with conflict detection, notifications via Windows toast, theme following the OS, and a clean quit that flushes state.

#### F9 — Progression

Focus minutes earn XP. Levels unlock a small set of accessories (scarf colors, tiny glasses, a leaf hat) that are cosmetic only. No purchases, no loot boxes, no limited-time pressure.

#### F10 — Lifecycle

Signed installer, background updates that never interrupt a focus session, opt-in diagnostics export, and a privacy policy that fits on one page.

## 9. Out of scope

- **Surveillance features:** app usage tracking, website blocking, keystroke or screen capture, window-title reading.
- **Social features:** leaderboards, shared streaks, friends, public profiles.
- **Accounts and cloud sync** in v1 (local export is the escape hatch).
- **Monetization** in v1. If cosmetics are sold later, they must be direct-purchase and non-random.
- **Multiple pets or user-authored pets** in v1; the Rive contract is designed to make this possible later.
- **Mobile, macOS, Linux** in v1. The architecture keeps the domain portable, but no work is planned.
- **AI-generated dialog.** Bubble copy is authored, deterministic, and reviewed.

## 10. Success metrics and validation

Because Mochi is local-first with no telemetry by default, metrics come from two sources: **local product analytics the user can inspect/export** and an **opt-in beta research cohort**. No silent behavioral tracking.

### 10.1 North-star and guardrails

| Metric | Definition | v1 beta target | Guardrail |
| --- | --- | --- | --- |
| **Weekly focus blocks** | Completed focus phases per active user per week | ≥ 4 median | Never optimize by nagging; notification cap is a hard constraint |
| **Activation** | Installs that complete one focus block within 24h | ≥ 60% | Onboarding must remain ≤ 2 clicks |
| **D7 retention** | Users opening Mochi on day 7 after install | ≥ 35% | Uninstall survey, no re-engagement spam |
| **D30 retention** | Users opening Mochi on day 30 | ≥ 20% | |
| **Companion engagement** | Days with ≥ 1 direct pet interaction (hover excluded) | ≥ 50% of active days | Interactions must never be required to "keep the pet alive" |
| **Crash-free sessions** | Sessions without main/renderer crash | ≥ 99.5% | Any regression blocks release |
| **Perceived performance** | Startup to visible pet, p95 | ≤ 1.5 s cold | See [NFRs](requirements.md#non-functional-requirements) |
| **Satisfaction** | Beta NPS after 2 weeks | ≥ 40 | Qualitative interviews each phase |

### 10.2 Instrumentation rules

- Local event names are documented in [Data & persistence](../02-architecture/data-and-persistence.md#8-diagnostics-and-event-log). Events contain no content, window titles, or file paths.
- Sending diagnostics is **explicit, per-export**, and shows the payload before upload.
- Metrics dashboards are built from consented beta exports, not from production telemetry.

### 10.3 Validation plan

| Hypothesis | Test | Pass signal |
| --- | --- | --- |
| Ambient presence increases session completion | A/B within beta: pet visible vs. tray-only timer | +10% relative completion, not at cost of D7 |
| A single gentle nudge is welcome | Diary study, 10 users, 2 weeks | ≥ 7/10 describe it as helpful, not nagging |
| The pet is the retention driver | Uninstall + interview | Pet named as top-2 reason to keep |
| Drag/hover feel natural | Moderated usability, 8 users | ≥ 7/8 discover drag without instruction |
| Focus mode does not feel punitive | Interview after missed session | No shame language; users report control |

## 11. Assumptions

1. Users will tolerate a ~100–140 MB Electron app for a high-craft desktop companion. **Validate in beta; monitor uninstall reasons.**
2. A 25-minute Pomodoro default is the right first ritual; 10-minute and 50-minute presets cover outliers.
3. Petting is a meaningful reward even without progression. **Validate via interaction telemetry (consented).**
4. Users prefer no account and no sync over cross-device continuity in v1.
5. A single well-authored character is enough for v1; customization can wait.
6. Windows notifications are acceptable if frequency is low and the user opted in.

## 12. Dependencies

| Dependency | Owner | Risk if late |
| --- | --- | --- |
| Character design + first `.riv` asset | Design | Blocks animation integration and all feel testing |
| Code-signing certificate | Product/Finance | Blocks public release; SmartScreen warnings harm activation |
| Windows 11 + Windows 10 test machines / VMs | Eng | Multi-DPI and update testing gaps |
| Privacy policy + support page | Product | Blocks store/installer release |
| Beta cohort (15–25 users) | Product | Weakens validation |

## 13. Open questions

| ID | Question | Current proposal | Decision owner | Needed by |
| --- | --- | --- | --- | --- |
| O-1 | Final character and name | Mochi, blob-cat with scarf | Design + Product | End of Phase 0 |
| O-2 | Update hosting | Public GitHub Releases for beta; object storage if private | Eng | Phase 3 |
| O-3 | Code signing | Azure Trusted Signing or standard OV/EV cert | Product + Eng | Phase 3 |
| O-4 | Windows 10 support tier | Supported but not performance-gated | Product | Phase 1 |
| O-5 | Sound default | On, quiet, with a visible mute control | Design | Phase 1 |
| O-6 | Localization | English only in v1; strings externalized | Product | Phase 2 |
| O-7 | Cosmetics monetization | None in v1; revisit after retention data | Product | Post-launch |

## 14. Release criteria

v1.0 ships only when all of the following are true:

- [ ] All **P0** functional requirements in [Requirements](requirements.md) pass their acceptance criteria.
- [ ] All NFR budgets are met on the reference machine and a low-end laptop, measured per [Test strategy](../05-plan/test-strategy.md#9-performance-testing).
- [ ] No open P0/P1 defects; P2 defects have documented workarounds.
- [ ] Installer is signed, installs per-user without admin, and uninstalls cleanly (with a data-retention choice).
- [ ] Auto-update from the previous beta to release candidate is verified on a clean VM, including a rollback path.
- [ ] Privacy policy, support link, and open-source license notices are shipped in-app.
- [ ] Accessibility: keyboard-only Den flows, reduced-motion mode, and screen-reader labels verified.
- [ ] The pet feels good: internal playtest sign-off from Product + Design on all 8 core animations.

---

**Next:** [Requirements and acceptance criteria →](requirements.md)
