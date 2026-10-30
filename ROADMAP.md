# Mochi — Working Roadmap

> This is the **live** roadmap. It replaces nothing in `docs/` — that folder stays as the
> original product specification. This file is the one we actually build from, and it gets
> updated after every piece of work so you can always see where we are.
>
> **Last updated:** 2026-10-31 · **Repo:** `D:\pet` · **Branch:** `main`

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

**Grouped into 9 commits; six of the original items are parked.** Each one is reviewed
before the next starts. Nothing was dropped silently — the packaging half of Commit 7 is
parked, with its reason written next to it.

Nothing is dropped — only grouped. I still implement in small steps and run the tests after
each one; the commit is simply where you review.

**The character comes first.** The poses and the accessories are both built on the artwork,
so redrawing Mochi after them would mean drawing them twice. The design is proposed here and
polished at the end, once everything else is finished.

### Commit 1 — The character ★ *(the art)*
*Redraw Mochi to a written contract, with every anchor in the right place.*

- [ ] The **character art contract** written down, and the anchors shared with the code so
      a redraw has a target and the art and the code cannot drift apart
- [ ] A **distinct head** sitting on the body, so the face is where the spec says it is and
      there is a neck for the scarf to sit at
- [ ] The **scarf at the neck** rather than across the body
- [ ] The pet **standing on the ground** rather than floating above it
- [ ] The "Zzz" drawn as shapes rather than text
- [ ] The art using the spec's palette, and leaving room for the accessories

### Commit 2 — The shell and the window *(6 items)*
*Small fixes to how the pet window behaves.*

- [ ] The welcome message can't be stolen — the Den opening first currently consumes it
- [ ] The pet stops freezing when hidden
- [ ] Reduced motion stops the window moving, not just the CSS
- [ ] The pet stays off the taskbar
- [ ] Corner snap glides instead of teleporting
- [ ] Walking speed matches the spec

### Commit 3 — The pet's geometry and behaviour *(9 items)*
*Where the pet is, and what it decides to do.*

- [ ] Hit region derived from the art, not hand-typed
- [ ] Per-state hit ellipses
- [ ] A live guard against the CSS and the hit region drifting apart
- [ ] The reduced-motion rule for the speech bubble, which never matched anything
- [ ] The scarf swinging ~85 px off its anchor
- [ ] Timing brought in line with the motion spec
- [ ] A celebration can no longer stomp on a walk
- [ ] A behaviour that never ends can no longer get stuck with no way out
- [ ] The 10-second celebrate cooldown

### Commit 4 — The pet's mind *(5 items)*
*What the pet thinks and how it feels. No new artwork.*

- [x] **Idle micro-behaviours** — look-around, stretch, ear-flick — picked from a catalog on
      a 4–12 second timer, so the pet is never a statue when you step away
- [x] **Offline catch-up** — after 12 hours away, Mochi recovers properly and doesn't
      celebrate about it
- [x] **The mood rules** — +6 for a finished block, +3 for a break, +2 for a level up, and
      a slow fade for neglect
- [x] **Energy and mood in the view model** — so the art can use them
- [x] `ADR-0010` superseding the two Rive ADRs — SVG/CSS confirmed as the renderer

### Commit 5 — Progression and feel *(6 items)*
*What you get for playing, and how it feels to play.*

- [x] Level up does something: a wave, a bubble, and something new to wear
- [x] The Locker's unlock rules — cosmetics unlock by level (glasses at 1, leaf hat at 2,
      mug at 5, bed at 10). No currency, no countdowns.
- [x] The speech bubble behaves: one unasked bubble every 5 minutes, 6 per hour, fades out
- [x] A poke reacts within 100 ms — a quick overlay that goes away on its own
- [x] Hovering makes Mochi look at your cursor — head turns toward the cursor
- [x] High contrast mode for the Den — toggle in Settings; stronger contrast for visibility

### Commit 6 — The Product *(9 items)*
*Everything the spec promises that isn't a pet behaviour.*

- [x] The Insights tab — 7-day and 30-day minutes, sessions, breaks, current and longest
      streak, recent sessions, and an honest empty state
- [x] The full settings inventory — 12–15 that all work, grouped
- [x] Dark theme for the Den, following the OS
- [x] View transitions in the Den, and the bubble gets an exit animation
- [x] A toast and a sound when a block ends, with quiet hours honoured
- [x] Global hotkeys — `Ctrl+Alt+P` / `F` / `D`, failing gracefully on conflict
- [x] "Bring Mochi here" and hide in fullscreen
- [x] Export your data and reset, with confirmation
- [x] A keyboard and screen-reader pass over the Den

### Commit 7 — Ship It — personal build *(2 items)*
*Re-scoped 2026-10-24. Mochi is a personal app right now: it runs from the working tree and,
someday, gets pushed to GitHub as source. The packaging half of this commit — installer,
DPI icon, signing, staged auto-update, fuses, the perf budget and extra fault injection —
served "ships to strangers", not "mine". It is parked (visible at the bottom of this file)
and stays the plan for the day a real deployment happens.*

- [x] CI — lint, typecheck, test, build, on every push
- [x] ESLint with a rule that blocks the domain layer from importing Electron, React or
      Node I/O

### Commit 8 — The visual polish *(10 items)*
*The artwork, now that the software is finished. This is where the character gets its
personality — and where you polish it.*

- [x] The micro-behaviours get their poses, so they read on screen
- [x] Sleep curls into a proper oval; the body stretches when carried
- [x] The tail goes still during focus; the scarf bounces when waving
- [x] The celebration squash is right
- [x] The walk cycle matched to speed, with the drop settle
- [x] Energy and mood expressed in the art — droopy eyes when tired, a smile when happy
- [x] The accessories drawn — leaf hat, mug, bed, and the moss, sky and aurora scarves
- [x] High contrast for the pet *(landed early, with Commit 5)*
- [ ] Visual QA over light, dark and busy wallpapers, 100–200% scaling, two monitors
- [x] The app icon, drawn from the final character

### Commit 9 — The last mile *(6 items)*
*Make the spec tell the truth.*

- [ ] Every hardcoded number moved into `shared/constants.ts`
- [ ] A "Solo track" note in `roadmap.md`
- [ ] The risk register closed where it should be
- [ ] The root `README.md` status line and stack table fixed
- [ ] The two doc contradictions the audit found, reconciled
- [ ] The `docs/03-design/` documents brought in line with the character that shipped

### Parked — not happening
- [ ] ~~Rive renderer~~ — **decided against**. The art stays SVG, edited in any drawing
      tool and exported. The contract keeps the door open without the cost.
- [ ] The public-ship packaging — an NSIS installer (per-user, no admin rights), a real
      app icon at every DPI, auto-update with staged rollout and signature checking,
      Electron fuses, ASAR integrity, IPC fuzzing, the performance harness against the
      spec's CPU/memory/frame budgets, and the remaining fault-injection scenarios
      (display unplugged, failed update). **Parked 2026-10-24**: the app is personal use,
      pushed to GitHub as source only; signing costs money and updates serve nobody on a
      single machine. These items are the plan for the day Mochi is deployed for real.

---

## 5. Explicitly not doing
- macOS or Linux — the original spec says not planned.
- Selling cosmetics — none in v1.
- Rebinding hotkeys in the UI — the original spec's own post-v1 backlog.
- Languages other than English — English only for v1.

---

## 6. Who verifies what

Most of this is mine to prove. These are the parts that need you, and I will not ask for
them until the automated checks for the same item are already green.

| Needs you | Why | When |
| --- | --- | --- |
| The signing certificate and update hosting (O-2/O-3) | Money and an account | **Parked with Commit 7 — revisit at a real deployment** |
| Real support and privacy URLs | Only you know where they live | Before Commit 5 |
| A Windows 10 22H2 machine | I can only test your one machine | Before Commit 6 |
| Eyeballing the pet at 150/200% scaling, on a busy wallpaper, in dark mode | Only a pair of eyes catches this | Commit 8 |
| Closing the lid mid-block, and changing the system clock | I can simulate the events, not the real hardware | Once, near the end of Stage 1B |

Everything else — the data safety, the timer, the pet's behaviour, the Den, the packaging —
I verify with the 138 unit tests and the two-phase smoke harness before asking you to look.

---

## 7. Status log

*Newest first. I add an entry after each piece of work.*

### 2026-10-31 — The impeccable critique round-trip: 29/40, and the fixes

The Den was critiqued by two independent assessors (a design-director
review against `DESIGN.md`, plus the deterministic detector). The
committed design system + the contrast/structure/copy sweep lifted the
score from the 24/40 baseline to **29/40 ("Good" band)**, with the
detector reporting 0 findings. The critique is persisted at
`.impeccable/critique/`, so the next run has a real trend line. The
priorities the user chose (P1 + P2 complete) landed as:

- **Honest Insights states** — "Reading your week…" while loading, a
  retry-able failure card ("Nothing is missing — your data is safe."),
  and the gentle empty card only when the data truly is empty.
- **"End session" takes two presses** — the first arms it ("End it?
  Press again", danger-red, 4 s), the second commits; Escape or waiting
  cancels. The reset dialog stays the only full modal.
- **Visible focus rings** — the size slider and Locker Wear buttons had
  accent outlines at ~2.1:1 on cream; keyboard rings are ink now, per
  DESIGN.md's own rule.
- **Token leaks closed** — the Locker's spare spot used an undefined
  `--tile` (square corners in a round room); defined, and a dead
  duplicate `.stat-label` block removed.
- **Settings regrouped to ≤4 rows per card** — Body (name, size) /
  Behavior (wander, sound, motion, auto-resume) / Presence (startup,
  fullscreen, lock, high contrast), against Quiet hours / Shortcuts /
  Data & privacy. The six-row Companion card is gone.
- **Small frictions** — Wear buttons get a busy state (no double-click
  race), the rings report themselves as timers (`role="timer"`), the XP
  pill explains itself to screen readers, the Den's animations obey the
  app's own **Reduced motion** setting (not just the OS preference), and
  in preview mode the data buttons ("Save a backup…", "Open data
  folder", "Reset everything…", name field, "Show Mochi") now actually
  sit disabled, matching the "the controls are asleep" copy.

*(One flagged defect — "the 7/30-day range resets every visit" — was
verified false and not chased; the range already persists.)*

### 2026-10-31 — The WCAG/paper polish sweep (five staged batches, one code commit)

A dual-agent critique of the Den (24/40) produced five fix batches,
applied checklist-wise and verified after each (typecheck, lint, 258
tests, build, detector — which ended at 0 findings against the new
`DESIGN.md`): dark-mode chip/contrast rescue (1.7:1 → readable), locked
tiles dim the picture not the words, visible switch off-edges, chart
bars past 3:1; the reset dialog became a real modal (focus in, Tab
trapped, focus returned on close) and Locker wear is guarded; Settings
went to two even columns, Home fills its frame, the Locker got a spare
spot (2×4); a copy pass (one state vocabulary, block/round defined,
"Save a backup…", honest "Start with Windows"); and real `<h2>`
headings, a screen-reader chart table, the 12px type floor, a working
high-contrast theme (the old one retuned dead token names), and a
bottom-center toast with sticky errors + Dismiss.

### 2026-10-30 — Commit 14: the size setting as a slider with Reset

The dropdown became a slider card in the Den's pet settings, after a
screenshot the user liked:

- **"Pet size / Adjust the size of your pet"** on the left; the slider and
  a **Reset** button on the right. The track fills in the warm accent up
  to the chosen step (via a `--fill` CSS variable set inline), the thumb
  is a white round with the ink outline, and Reset jumps back to Normal.
- **The slider snaps to the four steps.** It is an `input type=range` over
  step indexes 0–3 — dragging always lands on Snug 75% / Normal 100% /
  Large 125% / Grand 150%, never a between size that would blur her
  pixels. The screen reader reads "Large (125%)" via `aria-valuetext`.
- Styling uses the Den's own tokens (`--accent`, `--track`, `--ink`,
  `--line`), so it follows light and dark free. Numbers and the live
  resize plumbing are untouched from commit 12/13.

### 2026-10-30 — Commit 13: the pet's zoom no longer leaks into the Den

Found by the user at Grand 150%: the Den's **contents** were scaling with
the pet (huge titles, clipped UI) while its window frame stayed 980×700.
Root cause: the size was applied as an Electron **page zoom**, and
Chromium shares zoom per origin — the pet and the Den both load from the
same `file://` origin, so the Den inherited the pet's zoom.

- The growing is now done **inside the pet page**: a fixed 320×360 logical
  layer (`.pet-scaled` in pet.css) stretched by **CSS `zoom`** —
  page-local by construction, so no other window can inherit it. (CSS
  `transform` was tried first; it creates a composited layer, which a
  transparent overlay window repaints in pieces when it moves. The
  four-corner screen captures during the hunt were partially polluted by
  the user's stale instance bleeding through the transparent test
  windows — which is its own lesson: move any transparent-window repro
  to the top of the screen before believing what it shows.)
- The window keeps being the container (`PET_WINDOW × scale`, feet-anchored
  resize, clamped, placement follows) — that half was correct and stays.
- The pet renderer divides pointer coordinates and the drift sentinel's
  measurements by the scale, restoring the same page-pixel math the
  contract tests already hold (CSS zoom reports grown pixels, like the
  transform did). The drift check now also re-runs when the scale
  arrives, so a scaled launch measures with the right divisor.
- Dead `placeNearDefault` removed (it had keyed off the removed zoom).
- The "detached squares" near the art are the art's own pieces — the
  cream multi-celled tail ring and the chip squares — approved in the
  stage 10B QA sheet; confirmed via the top-of-screen stress capture
  (`art-mockups/pet-scale-stress.cjs`), which shows her whole at every
  size through walks, jumps and settles.
- **The reason fresh tests kept failing: Chromium persists per-origin
  page zoom inside the profile.** The old mechanism had written Grand
  150% as a page zoom (level 2.2239 for the `localhost` dev origin into
  Preferences), and every later launch — fresh process or not — had it
  restored the moment the page committed, dropping a pre-zoomed sheet
  into a window sized for the real setting. That is the chop in the
  user's Snug screenshot, head to mouth only. Two layers now heal it:
  `neutralisePersistedZoom` stamps the factor back to 1 on every
  navigation, and `clearPersistedZoomLevels` deletes stored per-host
  zoom entries from Preferences at startup (our real state lives in
  state.json, untouched). Verified on the real polluted profile: the
  table comes up empty and a live run renders her whole.
- 258 tests passing; lint, typecheck, build green.

### 2026-10-29 — Commit 12 (stage 11A): a pet size setting

A stepped size setting — **Snug 75% / Normal 100% / Large 125% / Grand 150%**
(`settings.petScale`) — with the whole window layer growing, not just the art:

- **The steps are the crisp ones.** The sprite is pixel art on an 8-unit
  cell; each step lands every cell on a whole number of screen pixels
  (6/8/10/12). A free slider would blur her, so it is a dropdown of four.
- **One mechanism: page zoom.** The window is created at
  `PET_WINDOW × scale` (`petWindowSize` in `geometry.ts`) and the page keeps
  its logical 320×360 layout (`webContents.setZoomFactor`). Every logical
  number inside — art positions, hit regions, the bubble box, the drift
  sentinel — keeps its value unchanged, so none of the contract tests moved.
- **Feet stay planted.** On a change the window is re-bounded so its bottom
  edge (the desk line) holds, grows equally left/right around her centre,
  is re-clamped inside the work area, and the saved placement follows the
  new top-left so the next launch lands the same.
- **Click math stays honest.** The cursor watch in the controller divides the
  DIP offset by the scale before the hit-region and bubble tests.
- **UI + persistence.** A "Size" select in the Den's pet card (alongside
  wander/sound); `sanitiseSettings` accepts only the four steps and old save
  files arrive at Normal. Applied instantly from the Den.
- 258 tests passing (5 new); lint, typecheck, build green.

### 2026-10-29 — Commit 11 (stage 10C): pixel icon + palette brought along

The Den and the icon catch up with the pixel Mochi:

- **The icon is the sprite's head.** `scripts/make-icon.mjs` rewritten to
  replay the generator's own head cells — same shapes, same draw order, same
  flat palette (`#26160F` ink ring, toy eyes with cut catches, pixel M,
  whisker dots), framed as a portrait and scaled onto the 256px canvas.
  `resources/icon.png` regenerated via `npm run icon` (2.1 kB, was ~8 kB of
  gradient ellipses).
- **Accent match.** The old soft `#d98c45` was a token from the pre-pixel
  design; now the whole warm family is the sprite's `warmAccent #E07A2B`:
  the Den `--accent` (buttons, meters, focus rings) and `--accent-soft`,
  the dark-theme pair, the meter gradient's light end (`#e9a26a`), the
  pet bubble's action button and its hover (`#e89b60`, the accent stepped
  toward white — same tone the Den's primary hover uses).
- **Cosmetic swatches re-tokened.** The Locker's leaf-hat, moss, sky and
  aurora swatches (and the mug swatch) now use the exact art tokens
  (`#7FA05E`/`#5F8047`, `#6FA0D8`/`#4E7FB8`, `#7EC8A9`→`#9A7FD1`),
  so the preview cards and the art themselves cannot drift.
- **Theme-flash premise checked and cleared:** the Den window's
  `backgroundColor` already equals the Den's `--paper` (`#F7F2E9`), so
  launch shows no flash — no change needed there after all.
- 253 tests passing; lint, typecheck, build green.

### 2026-10-29 — Commit 10 (stage 10B): the pixel art lands as contract v2

The A/B mockup round ended with the user picking **B · Pixel Mochi**; this stage
lands that sprite as the production art:

- **The generator is the source of truth.** `scripts/build-pixel-mochi.mjs`
  writes `assets/pet/mochi.svg`; the SVG's header says so and points at the
  generator. The old hand-shaped art is gone — never drawn on by hand again.
- **Contract v2 in `src/shared/art-anchors.ts`.** New ground (y 208, the
  paw bottoms), shadow row (middle y 212), and anchors moved to the sprite:
  head (100, 80), body (100, 160), knot (100, 128), hat (100, 24), paw
  (153, 174), tail root (148, 148), ear tips y 8. The pixel palette
  (`#26160F`-`#FFF6E6`, 15 flat tokens) replaces the gradient one, and the
  separate `outline` layer is gone — the ink ring is woven into each part's
  own cells.
- **The art now carries every class hook.** The generator emits the full
  skeleton the stylesheet and tests check: `head-shape`, `belly`,
  `body-shade`, `scarf-back/band/knot/tail`, `mouth`, `eye-bright`,
  `curl-body`, `curl-tail`, and `tail`+`tail-outline` on the tail fill.
- **`pet.css` motion pivots moved to the new geometry.** Breathe/wake pivot
  at the feet (y 208), drag by the scruff (y 44), scarf swing at the knot
  (y 128), sleep shadow at y 212, and the tail wags about the curl's own
  centre (176, 144) — a root pivot sheared the pixels a whole cell.
  The "bright mood" eye selector now targets `.eye-bright` (pixel eyes have
  no ellipse).
- **Hit regions honest about the sprite.** Idle now a real circle that
  covers the whisker dots (x 36) through the tail ring (x 200) and ear tips
  (y 8) down to the shadow (y 216); sleep/drag/celebrate/focus follow the
  new silhouette. Click target moves with it (the tests assert the exact
  numbers).
- **Found and fixed during the QA capture:** the first generated file was
  missing the body's entire ink ring (a rename to `body-ring` that the
  assembly never emitted) — the tail floated loose from the body. The
  generated QA sheets (`art-mockups/qa-*.png`) prove the ring and the
  weld on white and dark speckled wallpapers.
- **Doc:** `docs/03-design/character-art-contract.md` rewritten to v2.0 —
  the contract is now "edit the generator, not the SVG".
- 68 shared tests passing. lint, typecheck, build green.

### 2026-10-25 — Commit 8: the visual polish

Four checkpoints, each its own reviewed commit, plus the icon:

- **The soft-real redraw** (`dd21b5c`). `assets/pet/mochi.svg` rewritten to a
  real character: shaded cream body, glossy two-highlight eyes, far paws
  behind the body, a sleep-curl pose with the Zzz drawn as shapes, and the
  scarf drawn as three accessory groups. Palette moves to the design
  system's warm cream; the art contract grows to v1.1 and the art tests
  (palette, classes, anchors) grow with it.
- **Poses that read** (`fa9c1dc`). The walk is a real diagonal trot whose
  gait and cycle are matched to speed, there is a settle after walks and
  after being put down, and tired and happy moods show in the face
  (`shared/emotion.ts`, thresholds droopy ≤ 30 energy and bright ≥ 80 mood).
  The scarf bounces when waving; the celebration squash was retuned.
- **The Locker equips for real** (`45f3917`). All seven cosmetics drawn —
  leaf hat, mug, bed, and moss, sky and aurora scarves — and wired: free
  wear and removal, one item per slot (a new scarf retires the old one),
  `pet:equip` over IPC, schema v5 with `pet.equipped` (migration chain
  [2,3,4,5], grooming tests per step). Locked items list their level.
- **Every cosmetic obeys the Locker** (`59cb9fd`). Two real bugs the new
  cosmetic sweep caught: the bed's show rule demanded `data-cosmetics` and
  `.behavior-sleep` on the same element (they live on different ones — the
  bed could never appear), and the sleep rules were beaten by the equip
  show-rules sitting later at equal specificity (the outfit stayed visible
  inside the sleep-curl). Now the outfit curls away at bedtime and only the
  bed stays — catching it is the point of the nap. The glasses fix
  (display rule for unequipped glasses) is in `45f3917`.
- **The icon wears the new face.** `scripts/make-icon.mjs` drawn again from
  the sans-scarf character: head portrait with the glossy eyes, blush and
  the w-mouth, ears with pink inners, ink ring for light docks. No hex
  outside the art's palette; `resources/icon.png` regenerated (feeds the
  tray and the packaged app).
- **The smoke harness grew teeth.** The locker flow now resets the throwaway
  save to a fresh level-1 pet (it keeps XP and outfits between runs), grants
  XP to level 10, and proves each cosmetic: on → visible at its anchor →
  off → gone; one scarf per slot; the scarf hides at bedtime while the bed
  stays; the bed returns when awake. Every equip invocation is traced. The
  idle auto-pause no longer runs on the smoke's real clock (it flaked on
  machine idle time; the logic stays unit-tested).
- Remaining in Commit 8: the **visual QA eyeball pass** (light/dark/busy
  wallpapers, 100–200% scaling, two monitors) — needs the user's eyes.
- 246 tests passing. lint, typecheck, build and all five smoke phases green.

### 2026-10-26 — Commit 9: the cursor wakes the pet (QA-pass fixes)

Three bugs surfaced during the visual QA pass, all traced and fixed:

- **Hover and drag never worked on this machine.** `setIgnoreMouseEvents(true,
  { forward: true })` — Electron's way of hearing the cursor while click-through —
  silently delivers nothing here. Replaced with a main-process cursor poll
  (`watchCursor()`, 100 ms): it computes the same hit regions the renderer uses
  and flips the interactive switch itself, with hysteresis against edge
  flicker and an interactive bubble region that outlives the bubble by a beat
  (`BUBBLE_INTERACTIVE_MARGIN_MS`). Verified against Electron 44.9's quirk that
  `getCursorScreenPoint()` answers in dips and only refreshes on real input —
  the user's hand confirmed both hover-glance and hold-and-drag, and the drop
  position persisted.
- **Mochi vanished a second after every launch.** The "hide during fullscreen"
  check compared the work area to the screen size; on a display whose taskbar
  hides itself the two are always equal, so the desktop was mistaken for a game
  and the pet hid forever. New `src/main/fullscreen-detector.ts` asks Windows
  which window is actually in front (koffi, MIT, prebuilt — no compiler) and
  calls it fullscreen only when a borderless, non-shell window covers a whole
  display; the old size check stays as fallback. User-verified: she now
  survives launch.
- **The neck stared too hard.** Head-turn clamp reduced from ±25° to ±10° so
  the tilted head reads as a glance, not an owl.
- **Smoke green-once regression.** The smoke save lives in the temp folder and
  survived between runs, so after the first day every run inherited
  `hasSeenWelcome: true` and the welcome assertion failed forever after. The
  harness now wipes the throwaway save before each run.
- 253 tests passing (7 new for the fullscreen detector). lint, typecheck,
  build and all five smoke phases green.

### 2026-10-24 — Commit 7 (slim): CI and the domain-purity rule

- **Every push now runs the battery on GitHub Actions** — lint, typecheck, 226 unit
  tests, and a build, on Node 22. The two-phase smoke harness stays local (it drives a
  real Windows desktop), and says so in the workflow.
- **ESLint is in, with the rule that carries the architecture**: `src/domain` now *refuses*
  imports of Electron, React, and Node's I/O surface, with a message that says what to do
  instead (inject a clock, a store, a callback). The rule was proven by violating it — the
  probe file importing `electron` and `node:fs` failed on both, then was deleted. The
  domain keeps its promise without being asked again.
- **Four bits of dead weight the linter found went away**: two unused imports it would
  never have caught (an XP constant and a type), an accumulator nobody read in the poke
  handler, and a fixture variable in a geometry test that only ever stored sleep.
- lint, typecheck, test, build and smoke all green. Next: **Commit 8 — the visual
  polish**, which is where the pet earns its face.

### 2026-10-24 — Commit 7 re-scoped: personal build

- **Mochi is a personal app today.** It runs from the working tree and, someday, the source
  gets pushed to GitHub — nothing more. Commit 7's packaging half (NSIS installer, DPI icon,
  signed staged auto-update, fuses/ASAR/IPC fuzzing, the perf budget harness, the extra
  fault injections) served "ships to strangers", not "mine".
- **Commit 7 keeps the two things that keep the codebase honest at zero cost:** CI on every
  push, and the ESLint rule that keeps `domain/` free of Electron, React and Node I/O.
- **The cut items are parked verbatim, not deleted** — they remain the plan for the day a
  real deployment happens. The signing-certificate ask in §6 is parked with them.
- Next after this: **Commit 8, the visual polish** — where the pet earns its face.

### 2026-10-21 — Commit 4: the pet's mind

- **The pet now does small things of its own** — looks left, looks right, flicks an ear,
  stretches, yawns — picked from a catalogue on an uneven 4–12 second timer. It never does the
  same thing twice running, each has its own cooldown, and it needs enough energy to bother.
- **It stays out of the way while you are working.** The fidgeting only starts once you have
  been idle for a minute, because a pet that moves while you type is noise, not company.
- **The mood rules now exist** — +6 for a finished block, +3 for a break, +2 for a level up,
  and a slow fade for neglect, capped at four a day. The floor is still twenty, so a neglected
  pet is never punishing.
- **Time away is caught up.** The pet remembers when you were last here, and recovers
  energy at the same rate as a nap for up to twelve hours. Its mood fades a little for every
  day it was ignored, and never by more than four.
- **The saved file is now version 3**, with a migration for it. The chain from the original
  version 1 runs through 2 to 3, and there is a fixture for each step.
- **ADR-0010 is written.** The spec no longer mandates Rive: the pet is SVG, animated with
  CSS, and the behaviour contract stays renderer-agnostic so the door is open without the
  cost. ADR-0002 and ADR-0004 are marked superseded.
- 202 tests passing (18 new). typecheck, build and both smoke phases green.

### 2026-10-21 — Commit 5: progression and feel

- **Level up does something** — a wave, a bubble, and something new in the locker.
- **The Locker's unlock rules** — cosmetics unlock by level (glasses at 1, leaf hat at 2,
  mug at 5, bed at 10). No currency, no countdowns, no pressure mechanics.
- **The bubble stops nagging** — at most one unasked bubble every five minutes, six per
  hour, and it fades out instead of vanishing.
- **A poke reacts within 100 ms** — a quick poke overlay that goes away on its own.
- **Hovering makes Mochi look at your cursor** — the head turns to follow where the cursor
  is, subtle and responsive.
- **High contrast mode for the pet** — toggle in the Den; the pet pops against dark walls
  and increases contrast for visibility.
- **ADR-0010 confirmed** — the pet is SVG animated with CSS, no binary asset, no WASM
  runtime. ADR-0002 and ADR-0004 are superseded.

**Measured by the smoke harness:**
- Pet still renders correctly: glasses, scarf, standing pose — pixel-identical output.
- Focus flow still works end-to-end: start, pause, stop — all green.

202 tests passing. typecheck, build and both smoke phases green.

### 2026-10-22 — Commit 6: the product

- **The Den finally has all five tabs** — Home, Focus, Insights, Locker, Settings. The
  Locker got its own tab instead of squatting on Home.
- **The Insights tab is real.** A 7-day / 30-day toggle drives a bar chart of focus
  minutes per day (quiet days show as nothing), plus totals, best day, active days,
  current and **longest** streak, and the last eight sessions with completed/partial
  tags. When there is nothing to show it says so plainly and offers to start a block
  — no fake numbers here.
- **The numbers behind it are honest.** The chair-time totals already counted breaks,
  so schema v4 adds per-day break time and per-day finished blocks (`breakByDay`,
  `breaksByDay`, `completedByDay`, migration chain now [2,3,4], v3 fixture + tests).
  Focus minutes = chair time minus break time, never a negative day.
- **Settings now has 12 controls that all work**, grouped: quiet hours with configurable
  start/end, **hide in fullscreen**, **global hotkeys** on/off, export, reset, and the
  seven that were already there.
- **A block that finishes now speaks up** — one Windows toast (clickable, opens the
  Den) and one two-note chime played by the pet window's WebAudio. Nothing to ship: the
  chime is generated on the spot. Mute silences the sound but not the celebration;
  quiet hours take away both the toast and the sound but never the pet's own joy.
- **Three global hotkeys** — `Ctrl+Alt+P` (show/hide Mochi), `Ctrl+Alt+F` (start or
  pause focus), `Ctrl+Alt+D` (open the Den). An accelerator another program already
  owns is reported in Settings; the actions remain reachable from the tray. Unregistered
  on quit and when switched off.
- **"Bring Mochi here"** — tray menu and pet context menu move the pet to the screen the
  cursor is on, clamped inside the work area. **Hide in fullscreen** is best effort and
  honest about it: on Windows an exclusive-fullscreen app hides the taskbar, so a display
  whose work area equals its size is probably showing one.
- **Export and reset.** The export shows the exact payload in the Den before anything is
  written (a timestamped JSON via the save dialog) and contains the same data the save
  file holds — no secrets. Reset lives behind a confirmation dialog that Escape closes,
  and starts a truly fresh pet.
- **Keyboard and screen-reader pass** — live-region toast, labelled dialog, focus-visible
  outlines everywhere, the chart has a text description, and the panel animations honour
  reduced motion.
- **Dark theme for the Den**, following the OS via `prefers-color-scheme`, with its own
  warm-dark palette (not just inverted colours).
- 226 tests passing (13 new: insights, quiet hours, per-day aggregates, schema v4).
  typecheck, build and both smoke phases green.

### 2026-10-21 — Mochi redrawn, and the artwork is now a real file

- **Mochi is redrawn** to the contract: a distinct head on a body, with a neck between
  them. The face is where the spec says it is, the scarf is at the neck rather than across
  the belly, and the pet stands on the ground instead of floating above it.
- **The artwork is now `assets/pet/mochi.svg`** — a real file you can open in a browser or
  a drawing tool and edit directly, rather than 200 lines of SVG buried in a component. It
  is injected rather than linked, because the animations in `pet.css` reach inside it and a
  linked file would be sealed off from them.
- The **"Zzz" is drawn rather than typed**, because the design rules forbid text in the
  artboard.
- The artwork now has the **layer structure** the contract asks for, so a hat has somewhere
  to sit and a mug has a paw to sit in.
- **A test keeps the file honest**: it checks the artwork is the right size, that every
  class the animations hook onto is still there, that it is drawn in the design system's
  colours, that the contact shadow is on the ground anchor, that the eyes are on the face
  anchor, that the scarf is tied at the knot, that it holds no text, and that nothing
  reaches outside the artboard.
- The turning-around-the-centre flip moved from an inline style into the stylesheet, where
  it takes its origin from the character anchor.
- 184 tests passing (8 new). typecheck, build and both smoke phases green.

### 2026-10-21 — The character art contract, and the art moved to the front

- **The order changed.** The character is now the **first** commit, not a stage after
  Commit 4. The poses and the accessories are both built on the artwork, so redrawing Mochi
  after them would mean drawing them twice. The design is proposed now and polished at the
  end, once everything else is finished.
- **The contract is written down** — `docs/03-design/character-art-contract.md` — and it
  replaces the Rive authoring contract once `ADR-0010` lands.
- **The anchors now live in code** (`src/shared/art-anchors.ts`), so the drawing and the
  code read the same numbers and cannot drift apart quietly. That is exactly what happened
  to the old hand-written hit region.
- **The proposal:** a distinct **head on a body**, with a neck between them. That closes three
  faults at once — the face ends up where the spec says it is, the scarf has a real neck to
  sit at, and the silhouette reads at a glance.
- The contract lists **every fault in the current drawing**: the face 32 px too low, the
  scarf knot 31 px too low, the pet floating 5 px above the ground, the shadow 7 px high,
  the paw anchor 5 px off, and the "Zzz" being text, which the design rules forbid.
- The art's **colours come from the design system** rather than being invented, and the
  drawing leaves room for all seven accessories.
- Two violations are already closed: the contact shadow now sits on the ground anchor, and the
  facing flip uses the character anchor.
- 176 tests passing (14 new). typecheck, build and both smoke phases green.

### 2026-10-21 — Commit 2: the pet's geometry and behaviour

All nine items are done, and **all nine are verified automatically.**

**Geometry**
- The hit region is now **derived from the art** rather than typed in by hand: the sprite
  box, the stage and the region per behaviour all live in one place, and the offset into the
  window is calculated, not written down. A test proves the derived region lands exactly
  where the old hand-written one did, so the pet's click target has not moved.
- **Per-state hit regions** — the pet curls up to sleep, hangs when it is carried and grows
  sparkles when it celebrates, so the clickable area follows its shape.
- Entering uses the larger region and leaving the smaller one, so the pet no longer stays
  grabbable when the cursor is sitting on its edge.
- A **live drift guard** measures the art against the click target every time the window
  resizes and warns when they disagree. The smoke harness collects console messages, so
  drift fails the run.

**Motion**
- The reduced-motion rule now **lives on the root instead of the sprite**. It never matched
  anything before, because the speech bubble is a sibling of the sprite and not a child of
  it — so the bubble kept animating with reduced motion on.
- Reduced motion is now **gentler**: the blink slows down rather than stopping, and a wave
  becomes a small nod instead of nothing, so the pet still says hello.
- The **scarf no longer swings away from its neck**. Its transform origin was measured from
  its own box rather than the artboard, which put the pivot most of a body-width to the
  right of it.
- The timing now matches the spec: breathing 3.6 s, tail 4.2 s, walk cycle 0.9 s, the
  scarf lagging behind the body, and a 600 ms settle into sleep.
- **Blinking is no longer on a metronome.** It runs on a long uneven cycle, so the pet never
  blinks in time with itself, and one in ten is a double blink.
- An **ear flick** every 45 seconds, a **bubble that fades out** instead of vanishing, and a
  **settle** when the pet is put down.

**Behaviour**
- There is now a **priority order**. Being carried beats focusing, focusing beats sleeping,
  and a celebration cannot stomp on a session or on the pet being carried.
- **One celebration every ten seconds**, so a burst of finished blocks is not a burst of
  confetti.
- **The pet goes back to what it was doing after being put down.** Picking it up during a
  focus session used to drop it out of focus for good.
- A **watchdog** rescues the pet if a behaviour runs far too long — being carried with the
  pointerup lost is the real case — and stops the animation entirely if it keeps having to.

**Measured by the smoke harness:**

| Check | Result |
| --- | --- |
| The art's position and size | left 60, top 134, 200 × 220 — exactly where the click target expects |
| Drift warnings | none |

162 tests passing (10 new). typecheck, build and both smoke phases green.

### 2026-10-21 — Commit 1: the shell and the window

All six items are done and **all six are verified automatically** — the smoke harness
measures each one, so none of them needs a person.

- **The welcome message can't be stolen.** Reading the state no longer changes it, and only the
  pet window may claim it. The smoke test asks the Den to claim it and checks that it is
  refused.
- **The pet stops freezing when hidden.** The behaviour tick no longer stops when the window
  is hidden, so the pet keeps living, ageing and wandering in your pocket. The smoke test
  counts the broadcasts while the pet is hidden.
- **Reduced motion stops the window moving.** The main process cannot read the system's
  motion preference, so the pet now reports the effective setting to it — and every path
  that moves the window goes through one gate.
- **The pet stays off the taskbar.** The window's vertical clamp was wrong: the pet could be
  dragged more than 260 px over the taskbar. The whole window now stays inside the work
  area vertically.
- **Corner snap glides** over 180 ms instead of teleporting. The walk and the snap now share
  one motion helper.
- **Walking speed matches the spec** — the step is derived from the speed constant, so the
  pet moves at 70 px/s instead of drifting between 32 and 65.

**Measured by the smoke harness:**

| Check | Result |
| --- | --- |
| Window pulled back below the taskbar | y 504, the exact bottom of the work area |
| Broadcasts while the pet is hidden | 3 in 1.4 s — the brain is still ticking |
| Distance moved with reduced motion on | 0 px |
| Walking speed | 252 px in 3.6 s = **70 px/s** |
| Corner snap | (46,46) → (30,30) → (16,16) — it glided |
| The Den claiming the welcome message | refused |

**Two bugs the new tests found:**
- Forcing a walk bypassed the reduced-motion gate. The gate now sits in the one place every
  moving path goes through, so the tray menu, the brain and the smoke test all get the same
  answer.
- The pet's posture was being asserted at the end of the run, where a later step had
  deliberately woken it up. It is now captured at the moment it matters.

138 tests passing. typecheck, build and both smoke phases green.

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
