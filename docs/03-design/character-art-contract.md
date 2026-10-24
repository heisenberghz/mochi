# The Character Art Contract

| Field | Value |
| --- | --- |
| Version | 1.1 |
| Date | 2026-10-24 |
| Status | **Active** — the drawing follows this, and the tests hold it to it |
| Supersedes | v1.0 (the scarf was part of the character; now it is a cosmetic) |
| Companion | `src/shared/art-anchors.ts` — the same numbers, in code |

This is the contract between the drawing and the code. It says where every part of Mochi
lives, so a redraw has a target and the artwork and the code cannot quietly drift apart.

That drift already happened once. The hit region used to be four hand-typed numbers, the art
drifted away from them, and nothing noticed. The anchors below live in
`src/shared/art-anchors.ts` and both sides read them.

---

## 1. The character

**Mochi is a small, real-looking cat.** Cream-coloured, soft-shaded, with the proportions of
an animal rather than a blob: ears that own their shape, a tail that tapers, paws that touch
the ground. It should read as "a friendly cat" in a single glance at 200 px — **soft-real**,
not photoreal: real proportions and shading, still friendly and a little round.

### Soft-real rules

1. **Real proportions.** Distinct ears with inner-ear colour, a graceful tapered tail that
   leaves the body at the tail root, two visible paws plus **two far paws** behind the body
   (dimmer) so the walk cycle has all four feet.
2. **Shading is a gradient between palette tokens, never a new hue.** The body takes the
   body → shadow gradient, an ambient-occlusion ellipse under the head, a lit rim along the
   top, and the deep fur tone (`furDeep`) for pads, whiskers and folded-over fur.
3. **Glossy eyes.** Each eye carries two highlights — one large, one small — so the pupils
   read as wet glass rather than flat ink.
4. **No default scarf.** The scarf was removed from the base art; it lives on as three
   opt-in cosmetics (moss, sky, aurora). By default the neck seam is bare.

### Proportions

| Part | Shape | Spans | Notes |
| --- | --- | --- | --- |
| Head | A rounded, slightly wider-than-tall shape, soft at the cheeks | x 48–152, y 38–118 | Centred on the head anchor |
| Ears | Two triangles on the head | tips at y 34 | Inner ear in the inner-ear colour |
| Body | A rounded pear, wider at the bottom | x 52–148, y 112–210 | Sits on the ground |
| Neck | The seam where the head meets the body | y 108–124 | Bare by default; a scarf sits here |
| Tail | Leaves the body and curls up and right, tapering to a lit tip | root at (156, 160) | Stays inside x = 200 |
| Paws | Two near ovals resting at y 212, two far paws at y 206 | Ground contact | Far paws sit behind the body |
| Sleep curl | A second pose: a squat oval, head tucked at its left, tail wrapped | drawn in the `sleep-curl` group | Shown only while asleep |

### The face

The face lives on the head, not in the middle of the body.

| Feature | Where |
| --- | --- |
| Eyes | y 76, at x 80 and x 120 (highlight upper-left of each) |
| Nose | (100, 88) |
| Mouth | y 94 |
| Blush | (72, 87) and (128, 87) |
| Whiskers | Two per side, in the deep fur tone, quiet |

### Colours

Straight from the design system's art palette, so the pet and the Den are one family:

| Token | Value | Used for |
| --- | --- | --- |
| Body | `#F3E7D6` | The main coat |
| Body, lit | `#FBF3E6` | The rim light, the tail tip |
| Deep fur | `#CBB69C` | Whiskers, pads, shading under the head and tail |
| Shadow | `#E4D2BB` | Grooves, the far paws, the tail's under-stroke |
| Inner ear | `#E8B7A6` | Inner ear, blush |
| Ink | `#2A2622` | Eyes, nose, mouth |
| Highlight | `#FFFDF8` | Eye highlights, chest fluff |
| Moss | `#8FAE7C` | Leaf hat, moss scarf |
| Sky | `#7FA3C7` | Sky scarf |
| Aurora light / dark | `#7EC8A9` / `#9A7FD1` | Aurora scarf wash |
| Warm accent | `#D98C45` | The mug |

Everything else in the drawing is a shade derived from these — a mid-stop on a gradient, a
deep edge on a band — not a new hue.

---

## 2. The anchors

These are numbers the drawing must hit and the code may rely on.

| Anchor | Position | What hangs off it |
| --- | --- | --- |
| `character` | (100, 140) | The line the pet turns around |
| `head` | (100, 78) | The eyes, and the head's centre |
| `body` | (100, 158) | The belly |
| `scarfKnot` | (100, 120) | The scarf's knot, when one is worn |
| `headAttach` | (100, 44) | A leaf hat |
| `faceAttach` | (100, 76) | Glasses |
| `pawAttach` | (146, 176) | A mug, in the right paw |
| `groundAttach` | (100, 216) | A bed |
| `tailRoot` | (156, 160) | Where the tail leaves the body |
| `earTip` | y 34 | The highest point of the pet |

The artboard is **200 × 220**, and no visible part of the pet may leave it in any state.

The drift list from v1.0 (face 32 px low, knot 31 px low, ground 5 px short, shadow 7 px
short, paw 5 px short) was closed by the first redraw and stays closed — the tests keep it
closed.

---

## 3. The layers

Drawn back to front, so the tail is behind the body and the accessories sit on top:

| # | Layer | What is in it |
| --- | --- | --- |
| 1 | `ground` | The contact shadow, a bed |
| 2 | `tail` | The tail and its outline |
| 3 | `body` | The body and the belly, the far paws behind it |
| 4 | `scarfBack` | Reserved — the behind-body half of a scarf, when one is worn |
| 5 | `head` | The head and the ears |
| 6 | `face` | Eyes, nose, mouth, blush, glasses |
| 7 | `scarfFront` | Reserved — the band and knot at the neck, when a scarf is worn |
| 8 | `accessory` | A hat, a mug, a scarf — anything the player equips |
| 9 | `effects` | The Zzz, the sparkles |
| 10 | `outline` | The ink outline, shown in high contrast only |

The scarf layers are reserved, not always present: with no scarf worn the neck is bare and
the layer is empty. Each scarf cosmetic is drawn as its own `.accessory` group placed
between the body and the head, so the band sits under the chin.

**No text in the artboard.** The Zzz is three drawn shapes.

---

## 4. The accessories

Each needs somewhere to live, and the anchors give it one. Accessories are hidden by
default (`.accessory { display: none }`) and shown when equipped.

| Accessory | Where it goes | How |
| --- | --- | --- |
| Scarf moss | The neck, y 108–124 | Its own group: band, knot at the scarf anchor, hanging end |
| Scarf sky | The neck, y 108–124 | Same shapes, the sky colour |
| Scarf aurora | The neck, y 108–124 | Same shapes, the aurora wash |
| Glasses | `faceAttach` (100, 76) | Two lenses and a bridge across the face, worn by default |
| Leaf hat | `headAttach` (100, 44) | Sits on top of the head, between the ears, with a vein line |
| Mug | `pawAttach` (146, 176) | A real mug — body, handle, steam — held in the right paw |
| Bed | `groundAttach` (100, 216) | A rounded mattress under the pet |

The drawing has to leave room for these even when they are not being worn — a hat needs
clear space above the head, and the right paw needs to be a paw rather than part of the
body's outline.

---

## 5. What the code reads

| The code | Reads | From |
| --- | --- | --- |
| The click target | `ANCHORS` and the hit regions | `src/shared/geometry.ts` |
| The drift guard | `ART` and `ANCHORS` | `src/shared/art-anchors.ts` |
| The art itself | Everything above | `src/renderer/src/pet/PetSprite.tsx` |

If the drawing changes, the anchors change, and the click target follows. If the drawing
drifts from the anchors, the drift guard says so and the smoke run fails.

---

## 6. Changing it later

This is a contract, not a law. When you polish the character:

1. Change the drawing.
2. If a part moved, change its anchor in `src/shared/art-anchors.ts` too.
3. The tests will tell you if the click target no longer matches.

Nothing else in the app needs to know.
