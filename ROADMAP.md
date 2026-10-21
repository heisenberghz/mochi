# Mochi — Working Roadmap

> This is the **live** roadmap. It replaces nothing in `docs/` — that folder stays as the
> original product specification. This file is the one we actually build from, and it gets
> updated after every piece of work so you can always see where we are.
>
> **Last updated:** 2026-10-20 · **Repo:** `D:\pet` · **Branch:** `main`

---

## How to read this

- Each **Stage** is a milestone with a clear "done" meaning.
- Each **Item** is one commit. You review the diff, then I commit. Nothing lands unreviewed.
- **FR-xxx** codes are the requirement IDs from `docs/01-product/requirements.md` so you can
  trace any line of work back to the original spec.
- The **Status log** at the bottom records what was actually done. I append to it after every
  execution so this file always tells the truth.
- **No time estimates.** The order is set by risk, not by calendar.

---

## 1. Where we actually are

The whole spec (~4,900 lines) and the entire first working slice landed in **one commit**
(2026-10-19). So the code looks finished but the spec is far ahead of it.

Measured against all 88 functional requirements in the spec:

| Area | Requirements | Done | Partly | Missing |
| --- | --- | --- | --- | --- |
| Window / OS | 18 | 7 | 7 | 4 |
| Animation & behaviour | 14 | 2 | 9 | 3 |
| Interaction | 10 | 1 | 7 | 2 |
| Focus engine | 13 | 1 | 5 | 7 |
| Data & settings | 10 | 1 | 6 | 3 |
| Den UI | 9 | 2 | 3 | 4 |
| Packaging & updates | 8 | 1 | 0 | 7 |
| Accessibility | 6 | 2 | 3 | 1 |
| **Total** | **88** | **17** | **40** | **31** |

**The good news:** the architecture is genuinely sound. The domain layer is pure and
testable, the main process owns state, the renderers are dumb projections, and the window
behaviours (transparent, click-through, drag, tray, single-instance) are all correct. What
is missing is depth, not direction.

### 1.1 What the previous execution actually did

Not laziness, and not a broken repo. **It delivered the happy path of every requirement and
stopped — without leaving a single breadcrumb.**

I grepped the whole source for `TODO`, `FIXME`, `XXX`, `HACK`, `stub`. **Zero.** Anyone who
knows they skipped work leaves a marker. This left none.

But it *did* write these, and they are the interesting part:

```ts
store.ts:103        // Try the backup; if both fail, start clean.
store.ts:120        // Windows can reject a replace while a scanner holds the file.
controller.ts:904   // Autostart is best effort; the setting remains visible in the Den.
```

The author **knew about both failure modes** — the corrupt-state path and the failed-rename
path — and chose simpler behaviour than the spec requires. Those aren't oversights. They're
deliberate simplifications made without a marker.

### 1.2 The pattern

| | What lives there |
| --- | --- |
| **17 done** | Things one shot can produce from a description: window flags, click-through, drag threshold, tray menu, IPC plumbing, a JSON file, a CSS pet |
| **31 missing** | Things needing something external (a signing cert, hosting, a designer) **or** cross-subsystem integration — Insights needs stats → aggregates → persistence; Locker needs cosmetics → unlock rules → XP |
| **40 partial** | Everything that has to survive a restart, a crash, a suspend, a clock change, an edge case |

**Root cause:** the spec is 92 engineer-days for two engineers. Trying to close all 88
requirement rows in one commit forces breadth over depth.

Concretely: *"start a timer"* exists, *"recover a timer after a crash"* doesn't. *"Show the
pet"* exists, *"the pet keeps living while hidden"* doesn't.

---

## 2. Decisions we made

### 2.1 Rive → we keep the SVG + CSS renderer

The spec mandates Rive (a binary `.riv` file authored in a proprietary editor). The code
ships a hand-drawn inline SVG animated with CSS keyframes.

**We keep the SVG + CSS renderer.** Reasons:

- Rive is blocked on a designer we don't have. It was the single biggest risk in the
  original plan — the risk register literally says "highest schedule risk".
- The SVG + CSS version already does **all eight states**, honours reduced motion, and runs
  fully offline with zero assets, zero WASM, zero CDN.
- The **behaviour contract** (the eight state names and the pet's properties) stays exactly
  as specified, so Rive can still be dropped in later as a renderer swap.
- The art measures better against the Rive contract than you'd expect: artboard size and
  character centre X match exactly, ear tips are within 1px. Only the face and scarf anchors
  are off, and those are art fixes, not code fixes. The SVG work isn't throwaway.

We write `ADR-0010` to supersede `ADR-0002` and `ADR-0004` and record this properly.

### 2.2 `roadmap.md` is the requirement catalogue, not our schedule

`docs/05-plan/roadmap.md` was written for 2 engineers + 1 designer over 8 weeks. We're one
person. So we use it for **what to build** and this file for **what order**. The original
estimates stay untouched in `docs/` — we just add a "Solo track" note pointing here.

### 2.3 Bugs before features

Correctness is **subtractive** — it removes breakage. Features are **additive** and can be
built any time. So the stages go: fix what's wrong → make it feel alive → add the rest →
ship it.

---

## 3. What we are deliberately NOT building

A spec is a contract with the future team, not a checklist to complete. These are
**reductions**, not deletions — each can be reinstated later.

| Requirement | What we do instead | Why |
| --- | --- | --- |
| FR-ANI-13 Rive asset degradation | Nothing — there's no Rive asset to degrade | Moot after the SVG decision |
| NFR-MAINT-03 Rive contract validation in CI | Nothing — no `.riv` to validate | Moot |
| NFR-COMPAT-02 Windows 10 22H2 support tier | Windows 11 only; Windows 10 is best-effort with no guarantee | We can't verify a test matrix we don't own |
| FR-OPS-07 Portable ZIP | NSIS installer only | One packaging target we can actually verify end-to-end |
| FR-DEN-05 "every preference, searchable" (~30 settings) | 12–15 settings that all work, grouped; no search box | 12 good beats 30 half-done |
| FR-ANI-03 Six idle micro-behaviours | Three really good ones: look-around, stretch, ear-flick | Depth over breadth |
| FR-WIN-06 / ADR-0006 Eight per-state hit ellipses | Two: the body ellipse and a slightly larger one for the focus glasses | Per-state is over-built for a blob |
| IPC envelope `correlationId` / `retriable` | Typed error codes only | Local IPC between two renderers we control — correlation IDs are cargo cult |
| Playwright E2E | Extend the existing smoke harness instead | It already launches real Electron and drives a real session. Better return |
| FR-DAT-08 Diagnostic event log (30 days / 5 MB) | A rotating local log only; no separate event log | Two log systems is one too many |
| FR-DEN-08 Dark theme for the pet art | Den follows the OS light/dark; the pet keeps its light palette | The blob is a physical object, not UI chrome. Re-authoring its palette is low value |

---

## 4. The stages

### Stage 1A — Close the live holes
*Security first (they're open right now and cost almost nothing), then the three ways your
saved data can be destroyed, then the write cadence.*

#### Security (open today, cheap to close)
- [ ] **Block navigation and popups.** No `will-navigate` or `setWindowOpenHandler` is
      registered anywhere, so nothing stops a renderer from navigating away. (NFR-SEC-03)
- [ ] **DevTools off in the Den** for packaged builds. It's currently on. (NFR-SEC-01)
- [ ] **Tighten the production CSP.** The current policy allows any `ws://` host.
      (NFR-SEC-02)

#### Data loss (three real ways your file can be destroyed)
- [ ] **Never truncate the good file.** When the atomic rename fails, the code writes
      straight onto the primary — which can destroy your only good copy. (FR-DAT-02)
- [ ] **Never overwrite a newer schema.** A file from a future version is skipped, then the
      next save replaces it. A downgrade silently destroys data. (FR-DAT-04)
- [ ] **Quarantine instead of silently starting from zero.** When both files are unreadable
      the code currently discards them with no notice and no way to get them back.
      (FR-DAT-03)

#### Write cadence
- [ ] **Flush at most 2 seconds after a change**, not every 30 seconds, so a force-kill
      can't lose much. (FR-DAT-10, NFR-REL-03)
- [ ] **Flush when the pet is hidden**, not just on quit. (FR-DAT-10)
- [ ] Unique temp file name, `fsync` before rename, retry the rename instead of falling
      back to a destructive write. (FR-DAT-02)

#### Also in 1A
- [ ] **A small rotating local log** in `userData/logs` — no personal data, no network — and
      an install id so exports can be traced. (FR-OPS-06, NFR-PRIV-02)
- [ ] **Zod validates every message** in both directions. Zod is already installed and has
      **never been imported anywhere**. (NFR-SEC-04)
- [ ] **Typed error codes** so the renderer can branch on what went wrong.
- [ ] **Unknown settings keys rejected**, not silently ignored. (FR-DAT-09)

---

### Stage 1B — Make the timer trustworthy
*The thing users actually touch.*

- [ ] **Monotonic clock** so a system clock change can't stretch or shrink a block.
      (FR-FOC-04)
- [ ] **Suspend doesn't count.** Close the lid for 30 minutes mid-block → same time left on
      wake. Also handle lock and unlock. (FR-FOC-07, FR-WIN-16)
- [ ] **Auto-pause after 3 minutes of no input**, and offer Resume or End when you come
      back. (FR-FOC-05, FR-FOC-06)
- [ ] **Persist the running session** so a crash or force-kill can offer "Resume block"
      instead of losing the whole thing. (FR-FOC-08)
- [ ] **"Today" means today.** Blocks and minutes reset at local midnight, and a block
      running across midnight splits between the two days. (FR-FOC-13)
- [ ] **Partial credit.** End a block at 60% → prorated XP, no session count, streak
      untouched. At 40% → nothing. (FR-FOC-11)
- [ ] **Skip** a phase from the pet menu, tray and Den. (FR-INT-07, FR-FOC-01)
- [ ] **Focus durations become editable** with limits (5–120 / 1–30 / 5–60 / 2–8), saved
      between restarts, and a change during a session applies to the next phase.
      (FR-FOC-02)
- [ ] **Break XP and mood awards** for completed phases and breaks.
- [ ] **Store schema v2 with a real migration chain** — v1 files upgrade automatically and
      running the upgrade twice changes nothing. (FR-DAT-04)
- [ ] **The welcome message can't be stolen** — the Den opening first currently consumes the
      pet's welcome bubble.
- [ ] **The pet stops freezing when hidden.** Hiding it currently pauses its whole brain.
- [ ] **Reduced motion stops the window moving**, not just the CSS. Right now the pet still
      walks across your screen with reduced motion on. (FR-ANI-12, NFR-A11Y-02)
- [ ] **The pet stays off the taskbar.** The window's vertical position is never clamped to
      the bottom of the work area. (FR-WIN-09, AC-04)
- [ ] **Corner snap glides** over ~180 ms instead of teleporting. (FR-WIN-08)
- [ ] **Walking speed matches the spec** (60–90 px/s). The speed constant exists in the code
      but is never used. (FR-ANI-04)

---

### Stage 1C — Boundaries and polish
- [ ] **Hit region derived from the art** instead of hand-typed numbers, with a live check
      that warns if the CSS and the hit region ever drift apart. (FR-WIN-06, FR-WIN-10)
- [ ] **Reduced-motion rule for the speech bubble fixed** — the rule never matches anything
      because the bubble is a sibling of the sprite, not a child. (FR-A11Y-02)
- [ ] **Scarf animation bug fixed** — the scarf swings ~85 px off its anchor because of a
      `transform-box` mistake.
- [ ] **Timing brought in line with the motion spec** — blink becomes random (2.5–7 s) instead
      of a fixed 5.4 s, plus a real ear flick. (FR-ANI-02)
- [ ] **Focus duration editor** in the Den with inline validation errors. (FR-FOC-02)
- [ ] **Pause reason shown** — "paused because you went idle / locked / slept".
- [ ] **Real daily numbers** — blocks, minutes and streak read from disk, not from memory.
- [ ] **Skip button** on the focus view.
- [ ] **"Settings" added to the tray menu**. (FR-WIN-13)
- [ ] **Behaviour priority and a watchdog** — a celebration can no longer stomp on a walk,
      and a behaviour that never ends can no longer get stuck with no way out.
      (FR-ANI-08, FR-ANI-11)

---

### Stage 2 — Feel Alive
*Turn "a blob that moves" into "a pet". This is the difference between a demo and Mochi.*

- [ ] **Idle micro-behaviours** — look-around, stretch, ear-flick — picked from a catalog on
      a 4–12 second timer so the pet never looks frozen. (FR-ANI-03)
- [ ] **Per-state poses fixed to match the spec** — sleep curls into a proper oval, the body
      stretches when carried, the tail goes still during focus, the celebration squash is
      right, the scarf bounces when waving.
- [ ] **Energy and mood drive the art** — droopy eyes when tired, a smile when happy. The
      renderer currently ignores both numbers.
- [ ] **Offline catch-up** — if you were away 12 hours, Mochi recovers properly and doesn't
      celebrate about it. (FR-ANI-10)
- [ ] **Mood decay and awards** match the spec.
- [ ] **Level up actually does something** — a wave, a bubble, and something new to wear.
- [ ] **Locker** — cosmetics unlock by level, no pressure mechanics. (FR-DEN-06)
- [ ] **Drop settle and snap animations**, walk cycle at 0.9 s matched to speed.
- [ ] **Speech bubble behaves** — max one unasked bubble every 5 minutes, 6 per hour, always
      disappears in 4–8 seconds. (FR-INT-04, FR-INT-05)
- [ ] **Poke reacts within 100 ms**, and hovering makes Mochi look at your cursor.
      (FR-INT-01, FR-INT-06)
- [ ] **High contrast mode** for the pet and the Den. (FR-A11Y-05)

---

### Stage 3 — The Product
*Everything the spec promises that isn't a pet behaviour.*

- [ ] **Insights tab** — 7-day and 30-day minutes, sessions, breaks, current and longest
      streak, recent sessions, and an honest empty state. (FR-DEN-02, FR-DEN-04)
- [ ] **Full settings** — the spec lists about thirty preferences across six groups. Today
      there are five. We ship 12–15 that all work, grouped.
- [ ] **Completion toast** plus a sound, with quiet hours honoured. (FR-FOC-10)
- [ ] **Global hotkeys** — `Ctrl+Alt+P` / `F` / `D`, failing gracefully on conflict.
      (FR-WIN-14)
- [ ] **"Bring Mochi here"** and **hide in fullscreen**. (FR-WIN-18, FR-WIN-17)
- [ ] **Export your data** and **reset** with confirmation. (FR-DAT-05, FR-DAT-06)
- [ ] **Keyboard and screen-reader pass** on the Den, with Escape handling and focus
      management. (FR-DEN-07, NFR-A11Y-01)
- [ ] **Dark theme for the Den**, following the OS. (FR-DEN-08)
- [ ] **View transitions** in the Den, and the bubble gets an exit animation.

---

### Stage 4 — Ship It
*Turn it from "runs on my machine" into "installable, updatable, and verifiable".*

- [ ] **CI** — lint, typecheck, test, build, on every push.
- [ ] **ESLint** with a rule that blocks the domain layer from importing Electron, React or
      Node I/O. (NFR-MAINT-01)
- [ ] **electron-builder NSIS installer** — per-user, no admin rights required.
- [ ] **A real app icon** at every DPI, not just the 16px tray dot.
- [ ] **Auto-update** with staged rollout and signature checking.
- [ ] **Security hardening** — Electron fuses, ASAR integrity, IPC fuzzing.
      (NFR-SEC-05, NFR-SEC-06)
- [ ] **Performance harness** — CPU, memory and frame pacing measured against the spec's
      budgets, with the idle and battery numbers actually proven.
- [ ] **Fault injection** — renderer crash, corrupt state, display unplugged, failed update.
- [ ] **Visual QA** — light, dark and busy wallpapers, 100–200% scaling, two monitors.
- [ ] **About, licences, privacy policy and known limitations.**

---

### Parked — only if a designer appears
- [ ] **Rive renderer** — replace the SVG with a real `.riv`, build the view-model bridge, and
      add the contract validator CI would use.

---

## 5. Explicitly not doing
- macOS or Linux — the original spec says not planned.
- Selling cosmetics — none in v1.
- Rebinding hotkeys in the UI — the original spec's own post-v1 backlog.
- Languages other than English — English only for v1.

---

## 6. Status log

*Newest first. I add an entry after each piece of work.*

### 2026-10-20 — Stage 1A started

**A1 — security hardening** *(working tree, not committed)*
- Both windows now refuse navigation and popups. Allow-listed `https` links open in
  the browser; everything else is dropped.
- The Den no longer keeps DevTools on in packaged builds.
- Every renderer permission request is denied.
- The production CSP no longer allows any `ws://` host.
- **Side fix:** development mode had been silently broken — `script-src 'self'` was
  blocking Vite's inline React-refresh preamble, so hot refresh never worked.
- 31 tests passing (was 17). typecheck, build and smoke all green.

**A2 — the primary state file can no longer be truncated** *(working tree, not committed)*
- `save()` used to fall back to writing **straight onto** `state.json` when the rename
  failed. That was how the only good copy could be destroyed.
- Now: a unique temp name with the `wx` flag, `fsync` before the rename, the rename
  retried with backoff, and if it still fails **the previous file is left exactly as it
  was** while the new content stays in the temp file. Nothing is lost either way.
- Stale temp files from a crash are cleaned up on startup.
- 54 tests passing (23 new). typecheck, build and smoke all green.

**A3 — unreadable data is kept, and a newer Mochi is never overwritten** *(working tree, not committed)*
- Corrupt state used to be silently discarded and replaced with defaults. Now the file is
  **moved aside** as `state.corrupt-<timestamp>-<name>.json` and kept — never deleted — so
  the user can still get at whatever was in it.
- The Den now says what happened and offers an **Open folder** button. No more silent data
  loss.
- A file written by a **newer** Mochi is left completely alone: the app runs read-only and
  refuses to save over it, so a downgrade can never destroy data it does not understand.
- Verified end to end: a corrupted `state.json` was quarantined with its contents intact
  and the banner appeared in the Den; a `version: 99` file came out byte-for-byte
  unchanged after a full app run.
- 64 tests passing (10 new). typecheck, build and smoke all green.

**A4 — the saved state is never more than two seconds behind** *(working tree, not committed)*
- Pet state was written only every 30 seconds, and hiding the pet did not write at all. A
  force-kill could lose half a minute of progress.
- Writes are now debounced by 500 ms with a hard 2-second ceiling, and are written straight
  away on quit, suspend, hide, focus commands, settings changes and the welcome flag.
- A state that is byte-for-byte what is already on disk costs **no disk write at all** — the
  pet's energy drifts every tick, and rewriting that twice a second forever would be
  pointless I/O.
- Verified end to end: killed the app with no clean exit and the state was still on disk;
  planted a name and an XP total, relaunched, and both came back intact (with the level
  correctly recomputed from XP).
- 77 tests passing (13 new). typecheck, build and smoke all green.

**B1 — the focus timer, rebuilt as pure domain logic** *(working tree, not committed)*
- The timer now runs on a **monotonic clock**, so changing the system clock can no longer
  stretch or shrink a session.
- Pausing now records **why** it is paused: user, idle, lock, suspend, or recovered.
- "Today" now means today. The counters roll over at local midnight, and minutes are
  credited to the day they were actually spent on — a block running across midnight is split
  between the two days.
- **Streaks** are counted from the daily totals, and only move on the first completed block
  of a day.
- **Skip** a phase from the pet menu, tray or Den: no XP, no session, no streak.
- **Partial credit**: ending a block early keeps the minutes; at half or more it counts,
  below that it does not, and either way it is not a completed block.
- Starting while a break is waiting now starts the **break**, instead of throwing the break
  away and starting a new block of work.
- The timer can be **saved and restored**, and a restored session comes back **paused** —
  never running, because the monotonic clock starts again with the process.
- The product limits (focus 5–120 minutes and so on) are now checked at the boundary where
  the user can be told why a value was refused, instead of inside the domain where they
  silently changed what the code did.
- 105 tests passing (28 new). typecheck, build and smoke all green.

**B2 — the store schema v2 with a real migration chain** *(working tree, not committed)*
- The saved file now has a **focus section** — the timer's configuration, daily totals, a
  session history and the active session that can be recovered after a crash.
- A file from the current build is **upgraded automatically** instead of being discarded.
  Previously any file whose version was not exactly `1` was skipped, and the next save
  overwrote it.
- The migration is **sequential, pure and idempotent**: running it twice changes nothing,
  and running it on an already-current file changes nothing.
- The file as it was **before** the migration is kept as `state.pre-v1.bak`, so the old
  version can still be read if the migration turns out to be wrong.
- Every field is sanitised on the way in: impossible pet numbers, out-of-range focus
  settings, a rubbish session history and a nonsense active session are all corrected
  rather than trusted.
- An active session always comes back **paused**, never running — the same rule the timer
  applies, so the two can never disagree.
- Verified end to end: a real version 1 file on disk was upgraded to version 2 with the
  name, XP, placement and welcome flag all intact, the old file kept, and the level
  recomputed from XP.
- 127 tests passing (22 new). typecheck, build and smoke all green.

**B3 — the timer is wired to the store, and the Den can finally drive it** *(working tree, not committed)*
- The running session is **saved and restored**. A crash or a force-kill no longer loses
  the block: it comes back paused, with its remaining time intact, and Mochi offers to
  pick it up.
- The session length is **editable in the Den** — focus, short break, long break and rounds
  — with the limits (5–120 / 1–30 / 5–60 / 2–8) checked before anything is saved, and the
  reason shown next to the field that caused it.
- A change made **during** a session applies to the next phase, not the one in progress.
- The Den now has a **Skip** button, and **End session** keeps the minutes you actually
  focused rather than throwing them away.
- The Den shows **why** the session is paused — you paused it, you went away, the computer
  was locked, it was asleep, or it was saved when Mochi closed.
- The Den's numbers are now real: **minutes focused today** and the **current streak**,
  read from the saved data instead of from memory.
- **The smoke test now runs in two phases.** The first leaves a session running; the second
  launches the app again and checks that the session came back paused with its time intact
  and its configuration unchanged. This is the first automated proof that a session
  survives a restart.
- **Bug found and fixed along the way:** moving the cursor away from the pet *while
  dragging it* made the window go click-through, so the pointerup never arrived and the
  pet was left stuck in the carried pose for fifteen seconds. The window now stays
  interactive for as long as a drag is in progress.
- 138 tests passing (11 new). typecheck, build and smoke all green.

**B4 — sleeping, locking and going quiet no longer steal focus time** *(working tree, not committed)*
- **Suspending stops the session where it was** and it picks up from there when the machine
  wakes. Whatever happened while it slept is not focus time, and the pause is what keeps
  it that way — no deadline arithmetic, and it makes no difference whether the monotonic
  clock runs during sleep.
- **Locking pauses the session too**, and unlocking leaves it paused with a "carry on?"
  bubble rather than quietly restarting it.
- **Three minutes of no input pauses a work phase**, so a session cannot tick away with
  nobody there. The question — carry on, or end it — is asked **when you are back**, not
  while you are still away. A break is never interrupted.
- Two new settings, both documented and both with a default: **pause when the computer is
  locked** (on) and **carry on by itself** after an idle pause (off).
- **The speech bubble can now offer two things**, so "carry on or end it" is a real choice
  rather than a guess.
- **The pet only sits in focus posture during a running work phase.** It used to hold the
  pose through breaks and pauses too, which the spec does not ask for and which left it
  looking busy when nobody was working.
- **The smoke test drives the power events** and checks the session keeps its exact
  remaining time across a sleep and a lock: waking up and unlocking consumed **zero**
  milliseconds.
- 138 tests passing. typecheck, build and smoke all green.

### 2026-10-20 — Second pass: full doc audit, diagnosis, and re-plan
- Read all 20 documents in `docs/` and every line of source, via three parallel audits.
- Measured the code against all 88 functional requirements: **17 done, 40 partial, 31 missing**.
- **Diagnosed the previous execution:** it delivered the happy path of every requirement and
  stopped, leaving zero `TODO`/`FIXME` markers despite writing comments that show it *knew*
  about the corrupt-state and failed-rename paths it chose to simplify away.
- Found **35 real bugs**, including two that can destroy your saved data and three security
  holes that are open right now.
- **Revised the plan** — split Stage 1 into 1A/1B/1C, security first, and cut four things
  I'd previously proposed as over-engineering (the IPC envelope machinery, the store
  checksum, Playwright, and the per-state hit ellipses).
- Added a **"deliberately not building"** list — 11 spec items we're reducing on purpose,
  each with a reason.
- **Next up: Stage 1A, security first.** Block navigation, kill Den DevTools in production,
  tighten the CSP. Then the three data-loss bugs.

### 2026-10-20 — First pass: project audit and plan
- Read the key documents and all source.
- Confirmed the architecture is sound and the window behaviour is correct.
- Found 9 real bugs on top of the missing requirements.
- Decided: keep the SVG + CSS renderer, write `ADR-0010`.
- Decided: `docs/05-plan/roadmap.md` stays as the requirement catalogue; this file is the
  execution plan.
- Created this file.
