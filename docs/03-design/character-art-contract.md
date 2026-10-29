# The Character Art Contract

| Field | Value |
| --- | --- |
| Version | 2.0 |
| Date | 2026-10-29 |
| Status | **Active** — the drawing follows this, and the tests hold it to it |
| Supersedes | v1.1 (the soft-real gradient cat; now the pixel-grid sprite) |
| Companion | `src/shared/art-anchors.ts` — the same numbers, in code |

This is the contract between the drawing and the code. It says where every part of Mochi
lives, so a redraw has a target and the artwork and the code cannot quietly drift apart.

That drift already happened once. The hit region used to be four hand-typed numbers, the art
drifted away from them, and nothing noticed. The anchors below live in
`src/shared/art-anchors.ts` and both sides read them.

---

## 1. The character

**Mochi is an 8-pixel-grid sprite.** She is drawn as whole grid cells — a cell spans 8 art
pixels — with a one-cell ink outline ring around the silhouette, flat shading steps instead
of gradients, and big glossy toy eyes. Chosen from the A/B mockup round: candidate B,
"Pixel Mochi".

The art is **generated**, not hand-drawn:

```
node scripts/build-pixel-mochi.mjs   →  writes assets/pet/mochi.svg
```

The generator computes the cells from the anchor geometry, so the drawing and the code
cannot drift apart by construction. Never draw on `assets/pet/mochi.svg` by hand — edit the
generator and re-run it.

### Sprite rules

1. **Whole cells.** Everything is one or more 8-px cells; the only off-grid shapes are the
   eye catches, the mug frame and a few accessory trims, drawn as free-size rects.
2. **One-cell ink outline.** The silhouette is ringed in a single row of ink cells, woven
   into each part's own cells — there is no separate outline layer.
3. **Flat shading steps.** Each tone is one flat fill from the palette: body, a light step,
   a shade step and a deep step. No gradients.
4. **Toy eyes.** Each eye is a 2×2 block of ink cells with two catches cut into it — one
   large, one small — so the pupils still read as wet glass.
5. **No default scarf.** The scarf lives on as three opt-in cosmetics (moss, sky, aurora).
   By default the neck seam is bare.

### Proportions (in cells; a cell is 8 art px)

| Part | Shape | Spans (art px) | Notes |
| --- | --- | --- | --- |
| Head | A wide, flat-topped round shape | x 48–152, y 40–120 | The flat top edge is where the ears weld on |
| Ears | Two slim triangles on the flat top | tips at y 8 | Inner ear in the inner-ear colour |
| Body | A squat pear, wider at the bottom | x 48–144, y 112–208 | Sits on the ground |
| Neck | The seam where the head meets the body | y 112–128 | Bare by default; a scarf sits here |
| Tail | A fat curl, two cells thick, no inner pores, hugging the body's right | root at (148, 148) | Reaches the right artboard edge; pale tip |
| Paws | Two near paws at y 192–208, two far paws behind the body (shade step) | feet at y 208 | Far paws dimmer so the walk has four feet |
| Sleep curl | A second pose: a squat oval, head tucked at its left, tail wrapped | drawn in the `sleep-curl` group | Shown only while asleep |

### The face

The face lives on the head, not in the middle of the body.

| Feature | Where |
| --- | --- |
| Eyes | y 72–88, at x 72–88 and x 112–128 (two catches in each: large upper-left, small lower-right) |
| Nose | (96–104, 88–96) |
| Mouth | y 96–104, a pixel M at x 88–112 |
| Blush | (60–68, 88–96) and (136–144, 88–96) |
| Whiskers | One cell per side, in the deep fur tone, just off the silhouette |

### Colours

Each tone is one flat cell fill from the design system's art palette, so the pet and the Den
are one family:

| Token | Value | Used for |
| --- | --- | --- |
| Ink | `#26160F` | The outline ring, eyes, nose, mouth |
| Body | `#F7C585` | The main coat |
| Body light | `#FFE9C4` | Highlights, the belly, the near paws |
| Body shade | `#DF9E5B` | The far paws, shaded fur |
| Body deep | `#B97E42` | Toes, whisker dots |
| Spark | `#FFF7EA` | The eye catches, the steam, the tail tip |
| Inner ear | `#F6906E` | Inner ear, blush |
| Moss / deep | `#7FA05E` / `#5F8047` | Leaf hat, moss scarf |
| Sky / deep | `#6FA0D8` / `#4E7FB8` | Sky scarf |
| Aurora light / dark | `#7EC8A9` / `#9A7FD1` | Aurora scarf wash |
| Warm accent | `#E07A2B` | The mug |
| Bed | `#FFF6E6` | The bed the pet naps in |

It is a pixel-sprite palette: every tone is one flat fill — no gradients — and nothing gets
drawn in a colour that is not one of these.

---

## 2. The anchors

These are numbers the drawing must hit and the code may rely on.

| Anchor | Position | What hangs off it |
| --- | --- | --- |
| `character` | (100, 140) | The line the pet turns around |
| `head` | (100, 80) | The middle of the two-cell-tall eyes, and the head's centre |
| `body` | (100, 160) | The belly |
| `scarfKnot` | (100, 128) | The scarf's knot, when one is worn |
| `headAttach` | (100, 24) | A leaf hat, perched between the ears |
| `faceAttach` | (100, 78) | Glasses |
| `pawAttach` | (153, 174) | A mug, held above the right paw |
| `groundAttach` | (100, 212) | A bed |
| `tailRoot` | (148, 148) | Where the tail leaves the body |
| `earTip` | y 8 | The highest point of the pet |

The artboard is **200 × 220**, and no visible part of the pet may leave it in any state.

The ground is **y 208** — the bottom edge of the paws — and the contact shadow is the row of
cells that starts there (its middle, `ART.shadow`, is y 212). The drift list from v1.0
(face 32 px low, knot 31 px low, ground 5 px short, shadow 7 px short, paw 5 px short) was
closed by the first redraw and stayed closed; the v2 redraw hit the anchors exactly, and the
tests keep it that way.

---

## 3. The layers

Drawn back to front, so the tail is behind the body and the accessories sit on top:

| # | Layer | What is in it |
| --- | --- | --- |
| 1 | `ground` | The contact shadow, a bed |
| 2 | `tail` | The tail (the fill carries both the `tail` and `tail-outline` classes: the ink ring under the body's own ring is what welds it) |
| 3 | `body` | The body ink ring, fill, shade step, rim light and belly; the far paws behind it |
| 4 | `scarfBack` | Reserved — the behind-band end cells of a scarf, when one is worn |
| 5 | `head` | The head ink ring and fill (the `head-shape` group), the ears, a hat |
| 6 | `face` | Eyes, nose, mouth, blush, whiskers, glasses |
| 7 | `scarfFront` | Reserved — the band, knot and hanging tail, when a scarf is worn |
| 8 | `accessory` | A hat, a mug, a scarf — anything the player equips |
| 9 | `effects` | The Zzz, the sparkles |

There is no separate `outline` layer: the ink ring is woven into the cells of each part, in
the same fill as the part itself, so it can never fall out of registration with the shape
it rings.

The scarf layers are reserved, not always present: with no scarf worn the neck is bare and
the layer is empty. Each scarf cosmetic is drawn as its own `.accessory` group placed
between the body and the head, with `scarf-back`, `scarf-band`, `scarf-knot` and
`scarf-tail` subgroups.

**No text in the artboard.** The Zzz is three drawn shapes.

---

## 4. The accessories

Each needs somewhere to live, and the anchors give it one. Accessories are hidden by
default (`.accessory { display: none }`) and shown when equipped.

| Accessory | Where it goes | How |
| --- | --- | --- |
| Scarf moss | The neck, cells rows 15–16 | Its own group: back, band, knot at the scarf anchor, hanging tail |
| Scarf sky | The neck, cells rows 15–16 | Same shapes, the sky colour |
| Scarf aurora | The neck, cells rows 15–16 | Same shapes, the aurora wash |
| Glasses | `faceAttach` (100, 78) | Square pixel frames around each eye plus a bridge, worn by default |
| Leaf hat | `headAttach` (100, 24) | Perched between the ears, above the flat head top |
| Mug | `pawAttach` (153, 174) | A pixel mug — body, ink frame, handle, steam — held above the right paw |
| Bed | `groundAttach` (100, 212) | A pale mattress row on the ground, ink-edged |

The drawing has to leave room for these even when they are not being worn — a hat needs
clear space between the ears, and the right paw needs to be a paw rather than part of the
body's outline.

---

## 5. What the code reads

| The code | Reads | From |
| --- | --- | --- |
| The click target | `ANCHORS` and the hit regions | `src/shared/geometry.ts` |
| The drift guard | `ART` and `ANCHORS` | `src/shared/art-anchors.ts` |
| The art itself | Everything above | `src/renderer/src/pet/PetSprite.tsx` |
| The blink, the wag, the scarf swing | The class hooks | `src/renderer/src/pet/pet.css` — the motion pivots are written in art coordinates and were moved with this redraw |

If the drawing changes, the anchors change, and the click target follows. If the drawing
drifts from the anchors, the drift guard says so and the smoke run fails.

---

## 6. Changing it later

This is a contract, not a law. When you polish the character:

1. Edit `scripts/build-pixel-mochi.mjs` (the cells, or the palette there) and re-run it.
2. If a part moved, change its anchor in `src/shared/art-anchors.ts` too.
3. The tests will tell you if the drawing, the classes or the click target no longer match.

Nothing else in the app needs to know.
