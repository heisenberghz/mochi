---
target: the Den (Mochi companion window)
total_score: 29
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:D:\\pet\\src\\renderer\\src\\den\\DenApp.tsx"
target_fingerprint: "sha256:29c205fa415bbabdea72b341dc176a39a24c456dfa0ee142b71570f9930c54bd"
target_path: "D:\\pet\\src\\renderer\\src\\den\\DenApp.tsx"
timestamp: 2026-10-30T18-17-27Z
slug: src-renderer-src-den-denapp-tsx
---
# Design Critique — the Den (Mochi)

Method: dual-agent (A: ses_e71fb4c37ffe7csww4Bpo0n0el · B: ses_e71fb4c34ffe1CoXoLr2EomNCD)
Run notes: Electron desktop app; source-only design review (no screenshots). Live browser/CDP evidence skipped — no isolated instance available (single-instance lock uses the user's real profile at %APPDATA%\mochi). Deterministic CLI detect is the only automated evidence: 0 findings, exit 0, at both `src\renderer\src\den` directory and `DenApp.tsx` single-file scope. Pre-committed scoped ignore (`codex-grid-background=*` on `den.css`, glasses-icon art) present and non-operative.

## Design Health Score (Nielsen 0–4)

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Insights tab shows the true-*empty* card while data is still loading ("nothing has happened yet" — false claim mid-fetch); cosmetic wear button has no busy state |
| 2 | Match System / Real World | 3 | XP is explained only by hover `title`; otherwise in-character voice throughout |
| 3 | User Control and Freedom | 3 | Escape/dismiss/skip/pause all present; "End session" is a one-click irreversible path with no confirm or undo |
| 4 | Consistency and Standards | 3 | Focus-ring grammar drifts from DESIGN.md's own rule: `.size-slider`/`.cosmetic-toggle` use accent outlines (~2.1:1 on cream); `size-reset` is a bespoke button |
| 5 | Error Prevention | 3 | Reset is properly armed; but clearing a number field commits `Number("") = 0` to the config layer |
| 6 | Recognition Rather Than Recall | 3 | Text nav, shortcut list, pause-reason attribution; hover-only chart dates are the deficit |
| 7 | Flexibility and Efficiency | 2 | Global hotkeys exist but nothing inside the Den accelerates — no primary-action key, no arrow roving, Insights range resets to 7 every visit |
| 8 | Aesthetic and Minimalist Design | 3 | Token discipline is real (detector clean corroborates); the ring renders twice (Home + Focus) with the lesser caption on Focus |
| 9 | Error Recovery | 3 | Sticky toasts + dismiss, pause reasons, recovery banner; failure copy is generic ("That did not work. Please try again.") |
| 10 | Help and Documentation | 3 | Inline tips are task-focused (block/round defined, no-undo disclosed); all help is static prose |
| **Total** | | **29/40** | **Good band (28–35)** |

## Design Specificity Verdict

**Strongly authored.** The voice (`PAUSE_REASON`, `PAUSE_REASON`-style explanations, "Earned by being companions. Nothing else.") is bound to a character; cosmetic icons come from the pet's literal wardrobe; the Insights empty state enforces the anti-guilt contract from PRODUCT.md. The one generic surface: the Insights tab itself (plain bar chart + stat row — the only personality is the sr-only caption). The chart is the one place the Den forgets it lives with a pet.

## Overall Impression

The polish pass landed: contrast, dialog behavior, heading structure, and copy coherence are visibly built in, and the detector reports a completely clean tree. The remaining risk is concentrated in **state plumbing** — loading vs empty, ending vs erasing, in-flight wear vs dead window — not in visuals. Biggest opportunity: give session endings a remembered moment (the product's peak should be punctuated, in the Den as it already is in the pet window).

## What's Working

1. **`PAUSE_REASON` is the product thesis rendered as data** — deterministic, non-blaming, in-character status explanations.
2. **The reset dialog is a model destructive flow** — small opener, full focus lifecycle (move in, trap Tab, Escape, return), consequence-in-voice copy, "Keep my data" as openly protective cancel, "Save a backup…" colocated.
3. **Accessibility is structural** — sr-only chart table matching the picture day-for-day, locked tiles dim the icon not the words, high contrast retunes real tokens, Mushroom never dimmed below its floor.

## Priority Issues

1. **[P1] Insights loading state asserts a false absence.** While `insights === null` the empty card renders "There is nothing to show because nothing has happened yet" — for a returning user with weeks of data, then silently replaced. Fix: branch null → "Reading your week…" (live line or skeleton card) before data or true-empty. → `/impeccable harden`
2. **[P1] "End session" destroys a session in one unguarded click.** Ghost button adjacent to Skip; no confirm, no undo, no summary. Fix: two-step arm (inline confirm like the reset flow) + an ending moment on Home summarizing the block. → `/impeccable harden` (+ `/impeccable delight` for the summary)
3. **[P2] Focus ring grammar breaks the named rule and 3:1.** Accent outlines on `.size-slider:focus-visible` / `.cosmetic-toggle:focus-visible` at ~2.1:1 on cream; DESIGN.md says ink-black everywhere, Crust only on text fields. Fix: ink outlines (or a real Crust-Bold exception); fold `size-reset` into `.btn`. → `/impeccable harden`
4. **[P2] The system's own tokens leak.** `.cosmetic-spot` uses `border-radius: var(--tile)` but `--tile` is not defined in the Den — the spare spot renders square-cornered (DESIGN.md's "no square corners" Don't). Also a dead duplicate `.stat-label` block in den.css. → `/impeccable harden`
5. **[P2] Companion card carries six decisions (Settings holds ~15).** Chunking breach (≤4 per group exceeded 2×). Fix: regroup into Body (Name, Size) / Behavior (motion, sound, wander, resume) / Presence (startup, quiet hours) cards of 3–4 rows. → `/impeccable distill`

## Persona Red Flags

**Alex (Power User):** no intra-Den accelerators — primary timer needs Tab every time; no arrow-key roving in nav; Insights range resets every visit; double-click on "Wear" races (button disabled only by `!connected`, not by in-flight equip).

**Sam (Accessibility):** accent focus rings ~2.1:1 on cream (may never see focus on the size slider); the ring has no `progressbar` semantics (the meters do — the signature component is the one that doesn't); the app's own "Reduced motion" setting silences the pet but the Den still plays `panel-in` (CSS only honors the OS preference); XP meaning is hover-only.

**Riley (Stress Tester):** in Preview mode some controls look enabled but silently no-op or write to a ghost snapshot ("The controls are asleep" — some aren't); clearing a number field commits 0 while the true config stays 25; the raw-copy check (`Number("")`) hits the Focus config path directly.

## Minor Observations

- Every `title` attribute (XP pill, chart dates) is hover-only.
- The Insights chart has no visible date ticks; only the sr-only table knows which bar is which day.
- Toast is a single slot — one `say()` clobbers the one on screen.
- `highContrast` is session-only, not a stored setting.
- The finite wait between click and pushed snapshot on `equip` gives zero feedback.

## Questions to Consider

- Does ending a block have to be an erasure? What if the ring's last state were a small monument — the block summarized where the timer was?
- What if Home's "Current session" and Focus weren't two views of one timer but two jobs: glanceable status at home, the full control room on Focus?
- Would the Insights empty state feel like potential rather than emptiness if it drew a faint paper ghost of the chart instead of a reassurance paragraph?
