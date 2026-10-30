---
name: Mochi
description: A calm Windows desktop pet whose companion window (the Den) is written in warm cream paper and one precious orange.
colors:
  paper: "#f7f2e9"
  card: "#fffdf8"
  ink: "#2a2622"
  mushroom: "#776c5f"
  branch-line: "#e4dacb"
  toast-crust: "#e07a2b"
  crust-soft: "#f5e4d2"
  crust-bold: "#7c4c1c"
  sand-track: "#ece1d2"
  stat-tile: "#faf4e9"
  icon-cream: "#f3e7d6"
  bedtime-green: "#6e9a6a"
  issue-rust: "#b4544c"
  warn-copper: "#a14112"
  paper-night: "#221d18"
  card-night: "#2b2520"
  ink-night: "#f0e8dc"
  mushroom-night: "#a3968a"
  line-night: "#3d342c"
  crust-bright: "#e89b60"
  ember-soft-night: "#48301c"
  warn-copper-night: "#e08d5b"
  crust-glow: "#ecc9a3"
  track-night: "#332b24"
  brand-ink: "#8a5420"
  banner-wash: "#fbf0dd"
  banner-edge: "#ecd6b4"
  banner-ink: "#6c4a22"
  recovery-wash: "#fbeae7"
  recovery-edge: "#ecc7c1"
  recovery-ink: "#7d3b34"
  crust-deep: "#2b1d0f"
  soft-hover: "#eed7b8"
  soft-hover-night: "#52402f"
  dot-done: "#c98d55"
  dot-rest: "#c4b6a4"
  meter-glow: "#e9a26a"
  check-ink: "#b0702f"
  crust-halo: "rgba(217, 140, 69, 0.25)"
  crust-halo-air: "rgba(217, 140, 69, 0.18)"
  crust-halo-deep: "rgba(217, 140, 69, 0.35)"
  crust-halo-strong: "rgba(217, 140, 69, 0.55)"
  bar-fill: "#d36f1f"
  night-side: "rgba(22, 19, 15, 0.55)"
  scroll-thumb: "#ded1bf"
  hc-void: "#000000"
  hc-surface: "#0a0a0a"
  hc-raised: "#141414"
  hc-border: "#ffffff"
  hc-text: "#ffffff"
  hc-muted: "#bbbbbb"
  hc-accent: "#ffd700"
  pet-cream: "#f3e7d6"
  pet-ink: "#2a2622"
  scarf-moss: "#7FA05E"
  scarf-moss-deep: "#5F8047"
  scarf-sky: "#6FA0D8"
  scarf-sky-deep: "#4E7FB8"
  scarf-aurora-a: "#7EC8A9"
  scarf-aurora-b: "#9A7FD1"
typography:
  title:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "24px"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.02em"
  modal-title:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 650
  body:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "13px"
    fontWeight: 550
  brand:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    letterSpacing: "-0.01em"
  brand-mark:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "17px"
    fontWeight: 700
  caption:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "12px"
    fontWeight: 400
  eyebrow:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "11px"
    fontWeight: 650
    letterSpacing: "0.09em"
  timer:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "33px"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  timer-large:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "42px"
    fontWeight: 650
    letterSpacing: "-0.03em"
    fontFeature: "tnum"
  stat:
    fontFamily: "\"Segoe UI\", system-ui, -apple-system, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    letterSpacing: "-0.02em"
rounded:
  card: "18px"
  modal: "16px"
  control: "10px"
  field: "9px"
  chip: "999px"
  icon: "12px"
  tile: "12px"
  pad: "8px"
  soft: "6px"
  cap: "4px"
  # Art-only radii: these exist only inside the hand-drawn cosmetic glyph
  # shapes (scarves, mug, bed). Never use them for UI chrome.
  art-2: "2px"
  art-3: "3px"
  art-5: "5px"
spacing:
  card-pad: "18px 20px 20px"
  grid-gap: "18px"
  row-pad: "12px"
components:
  card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  button-primary:
    backgroundColor: "{colors.toast-crust}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  button-primary-hover:
    backgroundColor: "{colors.crust-bright}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "9px 15px"
  pill:
    backgroundColor: "{colors.crust-soft}"
    textColor: "{colors.crust-bold}"
    rounded: "{rounded.chip}"
    height: "26px"
  eyebrow-label:
    textColor: "{colors.mushroom}"
  nav-item-active:
    backgroundColor: "{colors.crust-soft}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
---

# Design System: Mochi — the Den

## Overview

**Creative North Star: "The Paper Den"**

The Den is a paper den — a desk corner made of cream paper scraps, ruled hairline lines, and ink handwriting. Mochi's fur (the pet's own cream `#f3e7d6` and ink `#2a2622`) is the material the UI borrows: swatches, tiles, and icons are drawn from what the pet wears. Warmth comes from *tonal* paper-on-paper layering, not decoration; nothing flat-white, nothing clinical. The one loud thing in the room is the orange (Toast Crust `#e07a2b`), which carries every active, ongoing, alive signal — it is the timer's sweep, the running switch, the worn accessory. It never decorates.

Feel: **playful and bright**, but small. Roundness (18px cards, 999px chips), bouncy micro-motion (80–200ms, the pet's own easing), and tabular timer digits give it life; the calm comes from what it never does — it never shouts, never judges, never steals focus. The Den follows the OS light/dark preference; the night Den is the same den at dusk (paper `#221d18`, crust-still-orange `#e89b60`).

**Key Characteristics:**
- Paper on paper — cream cards (`#fffdf8`) floating on cream paper (`#f7f2e9`), separated by soft shadows, not lines
- One voice — a single orange given all "active" meaning, everywhere, in any theme
- Pet-derived palette — cosmetic colors are the pet's own cream/ink plus its worn accessories (moss, sky, aurora scarves)
- System type, tabular digits — Segoe UI everywhere; every countable number (timer, stats, meters) uses `font-variant-numeric: tabular-nums`
- Soft geometry — nothing sharper than a 9px corner; controls round (10px), cards rounder (18px), chips fully round
- Motion in the pet's vocabulary — durations 80–400ms on `cubic-bezier(0.2, 0.8, 0.2, 1)`; never faster than 80ms, never slower than 400ms

## Colors

Paper-warm neutrals carry the room; one orange carries the meaning.

### Primary
- **Toast Crust** (`#e07a2b` light / `#e89b60` in the dark theme): THE active voice. The timer ring's sweep, primary buttons, meters' fill, the running switch, round-dot current, the worn accessory ring. Never used for text on cream — its text partner is always the card cream or Crust Bold.
- **Toast Crust brightening** (`#e89b60`): the hover state — the accent stepped toward white, matching the pet's bubble-button hover. Never as resting background.

### Secondary
- **Crust Soft** (`#f5e4d2` light / `#48301c` in the dark): the accent's quiet partner — soft buttons, active nav, worn-accessory halos, phase "is-work" chips.

### Tertiary
- **Crust Bold** (`#7c4c1c`): the only sanctioned text on Crust Soft (pills, soft buttons, session tags).
- **Property colors** (the pet's wardrobe): **Scarf Moss** (`#7FA05E`/`#5F8047`), **Scarf Sky** (`#6FA0D8`/`#4E7FB8`), **Aurora** (`#7EC8A9`→`#9A7FD1`). These appear ONLY in the pet and in the CSS-drawn cosmetic icons — never in UI chrome.

### Neutral
- **Paper** (`#f7f2e9` light / `#221d18` dark): the den's floor; page background and scroll rail border.
- **Card Cream** (`#fffdf8` light / `#2b2520` dark): every card, input fill `#fffefa`, the switch thumb.
- **Ink** (`#2a2622` light / `#f0e8dc` dark): all primary text and focus outlines — keyboard visibility is ink-black, 2px, offset 2px.
- **Mushroom** (`#776c5f` light / `#a3968a` dark): secondary text (subtitles, tips, captions). Passes 4.5:1 — it must never be dimmed further by opacity tricks.
- **Branch Line** (`#e4dacb` light / `#3d342c` dark): hairline rules — card borders, setting-row separators, ghost button borders.
- **Sand Track** (`#ece1d2` light / `#332b24` dark): switch off-track, meters, muted chips, odd session rows.
- **Bedtime Green** (`#6e9a6a`): the one success/int-status hue ("Mochi is running" dot).
- **Issue Rust** (`#b4544c`): validation errors only. **Warn Copper** (`#a14112` / `#e08d5b` dark): cautionary tips (hotkey conflicts).

### Named Rules
**The One Voice Rule.** Toast Crust appears only where something is active, running, or worn — never as decoration, never on more than ~10% of a screen. Its rarity is the point.

**The Property-Color Rule.** Moss, sky and aurora belong to the pet. If a UI element wears a scarf color, the pet must be able to wear it too.

## Typography

**Display/Body Font:** Segoe UI (with `system-ui`, `-apple-system`, sans fallback) — Windows-native, the app uses no webfonts.

**Character:** One family, weight-carried hierarchy. Numbers always tabular — a timer must never jiggle. No italics anywhere; emphasis is achieved with weight 550–650 and color, never with case-shouting except the 11px eyebrows.

### Hierarchy
- **Title** (650, 24px, -0.02em): the page greeting ("Good evening."). One per screen.
- **Timer** (650, 33px — 42px on the Focus tab, -0.03em, tabular): the ring's remaining time; the largest text in the Den, by design.
- **Stat** (650, 20–22px, tabular): "Today"-card counts.
- **Body** (400–650, 13–13.5px, 1.45–1.55): card copy, tips at 12.5px in Mushroom.
- **Label** (550, 13px): setting labels and button text.
- **Eyebrow** (650, 11px, +0.09em tracking, uppercase): card section names ("TODAY", "COMPANION"). The smallest voice; never for body text.
- **Fine print** (11–12px): captions, kbd, tag text. Keep above the WCAG-relevance floor and never combine with opacity.

### Named Rules
**The Tabletop Rule.** Every number that ticks — timers, meters, stats, XP — uses `font-variant-numeric: tabular-nums`. A jittering digit is a bug.

## Layout

The Den is a fixed 980×700 window (min 820×580): a **216px paper sidebar** (brand mark, five text nav items, a status foot pinned bottom) beside a scrolling main column (padding 26px 30px 40px). Content grids in **two columns** at a 1.1–1.3 : 0.9 ratio, a wide card left and a `.stack` of narrow cards right, 18px gutters. Below **900px** the grid falls to a single column and the sidebar slims to 176px. Insights (and the Locker) center themselves at 840px max width. Spacing rhythm: card padding 18/20px, card-head 14px, setting-row 12px vertical, button-row 8px gaps — three quiet steps, no grand gestures.

## Elevation & Depth

Depth is tonal and ambient, not structural — paper floating above paper. No hard drop contrasts; every shadow is warm-black at very low alpha.

- **Card rest** (`0 10px 28px rgba(58,45,32,0.05)`): every card, always.
- **Focus press** (`translateY(1px)`): buttons sink 1px when pressed — the only "move down" in the system.
- **Thumb chip** (`0 1px 3px rgba(42,38,34,0.25)`): slider thumbs and switch thumbs only.
- **Toast** (`0 14px 32px rgba(42,38,34,0.24)`): the dark notice slab.
- **Modal** (`0 24px 60px rgba(20,15,10,0.35)`): the reset dialog only; deepest thing in the Den.
- **Status halos** (`0 0 0 3px <crust-soft or moss>`): worn cosmetics, the current round dot, the "is-live" status dot — attention rings, not elevation.

### Named Rules
**The Lift-By-Tone Rule.** Depth comes from soft warm shadows and tonal paper steps. Never add a border to increase depth, and never a shadow darker than rgba(…,0.35).

## Shapes

Generous roundness is the system's signature: cards 18px, buttons/controls 10px, text fields 9px, pills/chips/toggle-tracks 999px, cosmetic icons 10–12px. Bar fronts keep small caps rounding (chart bars 4px top). Borders are 1px Branch Line — hairlines, never solid gray frames. The rounded silhouette recurs at every scale (brand mark 12px, chips 999px, the timer ring itself is a circle) so the Den and the pet's round body agree with each other.

## Components

### Buttons
- **Shape:** softly rounded rectangles (10px).
- **Primary (Toast Crust):** accent background, card-cream text (`#2b1d0f` in light as shipped — keep the dark-ink-on-crust feel), padding 9px 15px, weight 600. Hover: brightened `#e89b60`. Pressed: sinks 1px. Disabled: 45% opacity, `not-allowed` cursor.
- **Ghost:** transparent on Branch Line border, ink text. Hover: fills with Sand Track.
- **Soft (Crust Soft):** accent's quiet partner, Crust Bold text; hover deepens to `#eed7b8` (dark: `#52402f`).
- **Danger (small):** for destructive openers only ("Reset everything…"), deliberately small to slow the hand.
- **Focus:** 2px ink outline, offset 2px — on every button, no exceptions.

### Switch (toggle)
- **Track:** 42×24, fully rounded; off = Sand Track, on = Toast Crust. **Thumb:** 18px Card Cream with the thumb chip shadow.
- **Focus:** the track receives the ink outline around it, never the invisible input.

### Cards / Containers
- **Corner Style:** 18px.
- **Background:** Card Cream on Paper, 1px Branch Line border.
- **Shadow Strategy:** card rest (see Elevation).
- **Internal Padding:** 18px 20px 20px; card head (uppercase eyebrow + optional tag) then content.
- **Setting rows:** 12px vertical rhythm, Branch Line top border between rows, first row unruled.

### Inputs / Fields
- **Style:** 1px Branch Line stroke, Card Cream tint (`#fffefa`), 9px radius, padding 8px 10px, 13px.
- **Focus:** 2px Toast Crust outline, transparent border — the only Crust-on-cream outline pairing.
- **Error:** Issue Rust border + `#fdf3f2` fill; the message below in Issue Rust 12px with `role="alert"`.
- **Number input:** 84px, tabular digits.

### Chips / Pills
- **Style:** 999px, 4–11.5px/5–10px padding; rest = Sand Track + Mushroom text; active/live = Crust Soft + Crust Bold. Session tags ("completed") wear Crust Soft; neutral ones wear Branch Line.

### Navigation
- **Style:** text-only items, 13.5px Mushroom on transparent, 10px radius, 9px/12px padding.
- **Hover:** translucent Sand Track wash. **Active:** Crust Soft background, ink text, weight 650, `aria-current="page"`. No icons — the Den's nav is handheld and typographic.

### The Ring (signature component)
The focus timer: a conic-gradient disc where Toast Crust sweeps around a 400ms-linear background transition, an inner Card Cream disc (`inset 0 0 0 1px` line), and the time inside in tabular digits. It is the Den's signature: the pet's world expressed as a timer.

### Cosmetic Tile (signature component)
A Locker tile: 40px CSS-drawn icon swatch on Icon Cream (pet's own full-strength cream in any theme), label + one-line status, and a Wear/Take-off button that fills Toast Crust when worn, with a 3px Crust Soft halo around the tile. Locked tiles dim by tile treatment, not text opacity — the "Level N" reason must stay readable.

## Do's and Don'ts

### Do:
- **Do** use Toast Crust for state, never decoration; pair it with card-cream or Crust Bold text.
- **Do** keep all countable numbers tabular (`font-variant-numeric: tabular-nums`).
- **Do** keep keyboard visibility ink-black (2px, offset 2px) on every interactive element; Crust outlines on cream for text fields only.
- **Do** draw cosmetic icons and Locker swatches from the pet's own palette (`pet-cream`, `pet-ink`, the scarf colors) at full strength, in any theme.
- **Do** use the motion vocabulary: 80ms press, 120–200ms state, 300–400ms entrances, always on the pet's easings; pronounce tab changes as a 180ms 6px rise.
- **Do** keep light and dark as the same den at dusk: same structure, same roles, hue-matched (`#e07a2b` → `#e89b60`).

### Don't:
- **Don't** introduce a second accent or a blue/link color; the accent family and Bedtime Green are the entire chorus.
- **Don't** dim text with opacity to signal "unavailable" — retheme the tile instead; Mushroom is already at its readability floor.
- **Don't** add pure white or pure black; the palette starts at `#fffdf8` and ends at `#221d18`.
- **Don't** sharpen a corner below 9px or add square corners to anything round.
- **Don't** animate anything <80ms or >400ms, and never without respecting the reduced-motion kill-switch (`styles.css` scope).
- **Don't** put a `.eyebrow`-styled span where a real heading is needed — structure is not a style.
