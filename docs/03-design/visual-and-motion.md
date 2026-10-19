# Visual and Motion System

| Field | Value |
| --- | --- |
| Status | Awaiting character sign-off (O-1) |
| Version | 1.0 |
| Date | 2026-10-19 |
| Related | [Experience spec](experience-spec.md) · [Rive contract](rive-authoring-contract.md) · [PRD](../01-product/prd.md) |

Mochi's visual language is **warm minimalism with a pulse**: soft paper surfaces, one confident accent, generous space, and a character with enough physicality to feel alive without becoming a cartoon. The design must survive being looked at for eight hours.

## 1. Art direction

### 1.1 References in words

- A well-made desk toy: matte, rounded, pleasant to hold.
- Japanese stationery: warm paper, restrained color, precise spacing.
- A children's book illustration that adults can leave on their desk.
- Not: glassmorphism dashboards, neon gradients, gamified RPG chrome, corporate blue, clip-art mascots.

### 1.2 Principles

| Principle | Application |
| --- | --- |
| **Warmth over brightness** | Off-white paper, warm ink, apricot accent; no pure white or pure black. |
| **One accent at a time** | Apricot is the action color; sage is success/break; sky is focus/info; blush is celebration. Never all at once. |
| **Soft geometry** | 12–20 px radii, rounded icon terminals, no hard 90° cards inside the Den. |
| **Quiet hierarchy** | Type size and weight do the work; borders are 1 px and low contrast; shadows are rare. |
| **Character first** | On the pet surface, the character is the only illustration; no background decoration. |
| **Craft in the details** | Tabular numerals, optical alignment, consistent 4 px spacing, no clipped shadows. |

## 2. Character design: Mochi

### 2.1 Silhouette and construction

- **Shape:** a marshmallow-cat blob, wider at the base, with a large head that reads at 16 px in the tray icon.
- **Measurements:** 200 × 220 DIP artboard; body ~148 × 122; head ~112 × 96; ears ~26 × 30; tail curled to the right.
- **Features:** two dot eyes with a single highlight, a small triangular nose, a `w` mouth, whiskers optional (they add noise at small sizes; keep two short ones).
- **Scarf:** apricot, slightly oversized, one loose end that follows through on motion. The scarf is the only saturated element in the idle state.
- **Palette in art:** body `#F3E7D6`, shadow `#E4D2BB`, inner ear `#E8B7A6`, scarf `#E9A15C`, ink `#2A2622`, highlight `#FFFDF8`.
- **Outline:** none in normal mode (shape contrast and shadow do the work); 2 px ink outline in high-contrast mode.
- **Contact shadow:** a CSS ellipse under the feet, 120 × 18, ink at 12%, blur 6 px. It never moves independently of the pet's vertical bob.

### 2.2 Personality through shape

- Idle: weight settled, tail slow, ears neutral.
- Curious: head tilt 4–8°, one ear forward, eyes track the cursor.
- Focus: tiny round glasses, body upright, tail still; breathing slows from 3.6 s to 4.4 s.
- Sleep: curled into a 0.82-scale oval, tail over nose, eyes closed, slow 5 s breath.
- Celebrate: squash 92% → stretch 106% → settle, ears up, scarf lift, ≤ 40 particles.
- Drag: body elongates 8%, limbs hang, ears back, scarf trails.
- Wave: one paw up, 2 cycles, head tilt, scarf bounce.

### 2.3 Accessories

| Item | Attach point | Rules |
| --- | --- | --- |
| Scarf (default) | `attach_neck` | Always present; color variants swap the fill only |
| Glasses | `attach_face` | Visible during focus regardless of equipped cosmetic; never obscures eyes |
| Leaf hat | `attach_head` | Sits at 12° tilt; no clipping with ears |
| Bed | `attach_ground` | Appears only in sleep, replaces the contact shadow |
| Tiny mug | `attach_paw_right` | Visible during breaks; steam 2 s loop, disabled in low power |
| Aurora scarf | `attach_neck` | Gradient with 3 stops; must remain legible in high contrast (falls back to sage) |

Accessories are cosmetic and must not change the silhouette enough to break the hit ellipse. If an accessory extends beyond the 168 × 200 hit region in a core state, the [hit region table](rive-authoring-contract.md#6-hit-regions) is updated with the art.

### 2.4 Tray icon

- 16/20/24/32 px variants.
- Simplified head + ears silhouette in ink on transparent; apricot dot for focus, moon notch for sleep.
- At 16 px, no whiskers, no scarf detail, 1 px minimum feature.
- High-contrast variant uses a solid ink fill with a 1 px light outline.

## 3. Color tokens

Tokens are semantic, not raw hex, in code (`--surface`, `--text-muted`, `--accent`). The values below are the v1 palette.

### 3.1 Light theme (default)

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#F7F2E9` | App/Den background |
| `--surface` | `#FFFDF8` | Cards, bubble, inputs |
| `--surface-2` | `#F1EADF` | Sidebar, hover rows |
| `--border` | `#E4DACB` | 1 px borders, dividers |
| `--border-strong` | `#CBBBA5` | Focused inputs, high-emphasis dividers |
| `--text` | `#2A2622` | Primary text |
| `--text-muted` | `#756B5F` | Secondary text (≥ 4.5:1 on bg) |
| `--text-faint` | `#9A8E80` | Disabled/decorative only (not body) |
| `--accent` | `#D98C45` | Primary action, focus progress |
| `--accent-hover` | `#C67A35` | Hover/pressed |
| `--accent-soft` | `#F6E2CC` | Selected rows, badges |
| `--sage` | `#6F9B7F` | Success, break, completed |
| `--sky` | `#7397B4` | Info, focus phase label |
| `--blush` | `#D98F89` | Celebration, mood |
| `--danger` | `#B4544C` | Destructive actions, errors |
| `--focus-ring` | `#2A2622` | 2 px ring, 3:1 against surfaces |

### 3.2 Dark theme

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#171412` | Background |
| `--surface` | `#211C18` | Cards, bubble |
| `--surface-2` | `#2A241F` | Sidebar, hover |
| `--border` | `#3A322B` | Borders |
| `--border-strong` | `#5A4C3F` | Focused inputs |
| `--text` | `#F4EDE3` | Primary text |
| `--text-muted` | `#B7A99A` | Secondary text |
| `--text-faint` | `#7D7164` | Disabled/decorative |
| `--accent` | `#F0B079` | Primary action |
| `--accent-hover` | `#F5C08C` | Hover |
| `--accent-soft` | `#3A2A1D` | Selected rows |
| `--sage` | `#8FBE9F` | Success |
| `--sky` | `#9CBFD9` | Info |
| `--blush` | `#E3A6A0` | Celebration |
| `--danger` | `#E08B83` | Errors |
| `--focus-ring` | `#F4EDE3` | Focus ring |

### 3.3 High contrast

- Text and background reach ≥ 7:1; borders ≥ 3:1; no color-only status.
- Cards use solid `--surface` with a 2 px `--border-strong`.
- Pet gains an ink outline and a solid contact shadow.
- Charts use patterns (solid/dashed) in addition to color.
- Gradients (aurora scarf, celebration) are replaced by flat colors.

### 3.4 Rules

- Never place body text on `--accent` at small sizes; primary buttons use ink text on apricot only at ≥ 14 px semibold, verified ≥ 4.5:1.
- Semantic colors are not used decoratively (no red for "cute").
- Theme switching is instant (no cross-fade longer than 120 ms) to avoid a flash.
- The pet's art palette adapts to dark theme via the Rive `theme` property; the character stays warm, the background is transparent.

## 4. Typography

| Role | Family | Size / line | Weight | Notes |
| --- | --- | --- | --- | --- |
| Display / greeting | Fraunces Variable | 28–36 / 1.15 | 500–600 | Warm serif; used sparingly |
| Section title | Inter | 18–22 / 1.3 | 600 | |
| Body | Inter | 14–16 / 1.5 | 400 | |
| UI label | Inter | 13–14 / 1.4 | 500 | |
| Caption | Inter | 12 / 1.4 | 500 | Tracking +0.01em |
| Timer numerals | Inter tabular | 48–64 / 1.0 | 500 | `font-variant-numeric: tabular-nums` |
| Bubble | Inter | 14 / 1.45 | 400 | Max 3 lines |

- Both fonts are bundled as subset WOFF2 (SIL OFL); no remote font requests.
- Fallback stack: `Inter, "Segoe UI Variable", "Segoe UI", system-ui, sans-serif`; display: `Fraunces, Georgia, serif`.
- Body text is never smaller than 12 px; 14 px is the default for controls.
- Numerals in stats and timer are tabular to prevent jitter.
- Line length in the Den is capped at 72 characters.

## 5. Space, shape, and elevation

| Token | Value |
| --- | --- |
| Base unit | 4 px |
| Scale | 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 |
| Den sidebar | 232 px |
| Den title overlay | 40 px |
| Den content max | 840 px |
| Den gutter | 32 px (24 px at ≤ 960 px) |
| Card padding | 24 px (20 px compact) |
| Radius sm / md / lg / pill | 8 / 12 / 20 / 999 px |
| Border | 1 px |
| Shadow soft | `0 2px 8px rgba(42,38,34,.08)` |
| Shadow lifted | `0 8px 24px rgba(42,38,34,.12)` |
| Shadow bubble | `0 10px 30px rgba(42,38,34,.16)` |

- Shadows are warm-tinted, never gray-blue.
- Nested cards are avoided; use dividers and spacing instead.
- The Den uses a 12-column grid for Insights and Locker; Home and Focus use a 2-column editorial layout (content + status rail) above 1000 px, single column below.
- No glassmorphism or backdrop blur; the pet floats over the desktop, the Den is opaque paper.

## 6. Motion language

### 6.1 Timing tokens

| Token | Value | Use |
| --- | --- | --- |
| `motion-instant` | 80 ms | Press feedback, checkbox |
| `motion-fast` | 120 ms | Bubble exit, hover tint |
| `motion-base` | 200 ms | Den hover, tab switch |
| `motion-enter` | 300 ms | Card enter, Den view transition |
| `motion-slow` | 400 ms | Large panel reveal (rare) |
| `ease-standard` | `cubic-bezier(.2,.8,.2,1)` | Most UI |
| `ease-enter` | `cubic-bezier(.16,1,.3,1)` | Elements arriving |
| `ease-exit` | `cubic-bezier(.4,0,1,1)` | Elements leaving |
| `spring-pet` | stiffness 180, damping 18 | Pet drop/settle |
| `spring-snap` | stiffness 260, damping 26 | Corner snap |

### 6.2 Animation timing

| Animation | Duration | Notes |
| --- | --- | --- |
| Breathing (idle) | 3.6 s loop | 2.5% vertical scale, 1.5% chest expansion |
| Breathing (focus) | 4.4 s loop | Calmer, shallower |
| Breathing (sleep) | 5.0 s loop | Deep, slow |
| Blink | 120 ms closed + 90 ms open | Every 2.5–7 s, double-blink 8% of the time |
| Tail sway | 4.2 s loop | Overlapping phase offset from body |
| Ear flick | 600 ms | Random, cooldown 45 s |
| Walk cycle | 0.9 s stride | Two steps per cycle; foot contact synced to 70 DIP/s |
| Wave | 1.5 s one-shot | Anticipation 200 ms, 2 waves, settle |
| Sleep-in | 600 ms | Curl + eye close |
| Wake | 1.2 s | Stretch, blink, sit up |
| Celebrate | 2.5 s | Squash-stretch, scarf lift, particles ≤ 40 |
| Drag dangle | loop | 1.2 s sway, no foot contact |
| Drop settle | 250 ms | Spring, contact shadow squash |
| Snap | 180 ms | Ease-out cubic, no overshoot |
| Bubble in/out | 160 / 120 ms | 8 px rise + fade; reduced motion = fade only |
| Den view change | 220 ms | 8 px slide + fade; reduced = fade 120 ms |

### 6.3 Principles in practice

- **Anticipation:** before a wave, a 60 ms weight shift; before a jump, a 90 ms squash.
- **Follow-through:** scarf and tail lag 2–4 frames behind the body.
- **Overlap:** ears, tail, and scarf never move in perfect sync.
- **Squash and stretch:** kept subtle (≤ 8%) except celebration (≤ 14%).
- **No linear motion** for entrance/exit; only progress rings are linear in time.
- **Foot contact:** the walk cycle's contact frames align with the window's velocity; no moonwalking.
- **Idle is never static:** at least one secondary layer moves at all times, even in sleep (breathing).
- **Micro-gestures are random but not twitchy:** no gesture repeats immediately; intervals 4–12 s.

### 6.4 Reduced motion

| Normal | Reduced |
| --- | --- |
| Window roaming | No roaming; pet stays in place |
| Drop-in bounce | Fade + 4 px rise, 150 ms |
| Confetti/particles | None; a static sparkle glyph may appear for 1 s |
| Squash/stretch | ≤ 2%; cross-fade between poses |
| Tail/scarf follow-through | Reduced amplitude, no lag |
| Bubble rise | Fade only, 120 ms |
| Den slides | Fade only, 120 ms |
| Blink | Every 5–8 s, 80 ms |

Reduced motion follows the OS setting by default (`prefers-reduced-motion`), with an explicit override in Settings. The setting also disables the pet's window movement, not just CSS transitions.

## 7. Sound design

Sound is optional, subtle, and off by default until the first interaction? **Decision pending (O-5).** Proposed default: sound **on** at 60% volume, with a visible mute control in the tray and the first bubble offering "Sound on/off." Sounds are short, warm, and never musical loops.

| Cue | Length | Character | Trigger |
| --- | --- | --- | --- |
| Soft chime | 350 ms | Two-note marimba, gentle | Focus phase complete |
| Tiny chirp | 180 ms | Muted, playful | Wave/level-up |
| Purr | 900 ms loop | Low, warm, barely audible | Petting while idle |
| Footstep | 90 ms | Soft felt tap, alternating pitch | Walk contact frames (optional; off in low power) |
| UI tick | 40 ms | Almost imperceptible | Button press (optional, off by default) |

- All cues are mixed to a consistent perceived loudness; no sudden peaks.
- No sound during sleep, quiet hours, or when the user is in a focus phase (except completion).
- Every sound has a visual equivalent; muting never removes information.
- Audio files are license-cleared and bundled locally; no streaming.
- Windows volume and output device changes are respected automatically.

## 8. Den visual specification

### 8.1 Home

- Greeting (`Good morning, Maya` if a name is set; otherwise `Good morning`) in Fraunces 32.
- Left column: pet status card (energy/mood bars with text labels), "Start focus" primary button, preset chips (10/25/50).
- Right rail: today's focus minutes, streak, last session, a small line-art Mochi illustration.
- One primary action; no more than three cards above the fold.

### 8.2 Focus

- Centered 220 px timer ring, 10 px stroke, sand track, apricot progress, tabular 56 px numerals.
- Phase label (`Focus · Round 2 of 4`) above, controls below.
- Preset editor in a disclosure panel, not a modal.
- Auto-start toggles with plain-language descriptions.

### 8.3 Insights

- 7/30-day range toggle, bar chart with rounded tops, no gridlines except a baseline.
- Summary row: total focus time, sessions, best day, current/longest streak.
- Bars use sage for completed days, accent-soft for zero days; today outlined.
- Accessible table view toggle; values announced per bar.
- Empty state: line-art Mochi asleep + "No focus blocks yet. A 10-minute one counts."

### 8.4 Locker

- 3-column grid of cosmetic cards, preview on hover/focus, equipped badge.
- Locked cards show `Level 5` and a lock icon; no prices, timers, or currency.
- Selecting equips immediately; a "Default scarf" option is always available.

### 8.5 Settings

- Sections: General, Pet, Focus, Shortcuts, Updates, Privacy & Data, About.
- Auto-save; 400 ms debounce; inline "Saved" text fades after 1.5 s.
- Destructive actions (reset, delete data) are outlined danger buttons with confirmation dialogs.
- Shortcut capture uses a key recorder with conflict detection and a reset link.
- About shows version, channel, licenses, privacy policy, support link, and a "Copy diagnostics" button.

### 8.6 Title bar

- 40 px overlay with native Windows controls; app name at left, current state at right.
- Draggable empty area; all controls `no-drag`.
- No custom minimize/maximize/close glyphs; native controls keep accessibility and Snap Layouts behavior.

## 9. Illustration and empty states

- Line-art Mochi poses in ink at 12% opacity for empty/loading states; no stock illustrations.
- Empty states always include one concrete action.
- Error illustrations are the same line art with a small bandage/scarf detail; never a red exclamation triangle.
- Loading uses a 3-dot breathing animation (reduced motion: static dots), not a spinner.

## 10. Visual QA checklist

- [ ] Pet reads clearly on light, dark, busy, and photographic wallpapers; no halo or rectangle.
- [ ] Character silhouette is recognizable at 200 px and in the 16 px tray icon.
- [ ] All text meets WCAG AA in both themes; muted text still ≥ 4.5:1.
- [ ] No pure black/white surfaces; shadows are warm and consistent.
- [ ] Timer numerals do not jitter (tabular).
- [ ] 200% scaling: no clipped text, no overlapping controls, timer ring remains centered.
- [ ] High-contrast mode: all states distinguishable without color; outline present.
- [ ] Reduced motion: no large movement, no confetti, no roaming.
- [ ] Every animation has anticipation/settle; no linear entrances.
- [ ] Scarf/tail follow-through does not clip outside the artboard.
- [ ] Sound cues are balanced and have visual equivalents.
- [ ] Light/dark switch does not flash or recolor the pet incorrectly.

---

**Next:** [Rive authoring contract →](rive-authoring-contract.md)
