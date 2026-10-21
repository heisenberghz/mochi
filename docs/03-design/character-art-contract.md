# The Character Art Contract

| Field | Value |
| --- | --- |
| Version | 1.0 |
| Date | 2026-10-21 |
| Status | **Proposed** — the drawing is mine to propose, the polish is yours |
| Supersedes | The Rive authoring contract, once `ADR-0010` lands |
| Companion | `src/shared/art-anchors.ts` — the same numbers, in code |

This is the contract between the drawing and the code. It says where every part of Mochi
lives, so a redraw has a target and the artwork and the code cannot quietly drift apart.

That drift already happened once. The hit region used to be four hand-typed numbers, the art
drifted away from them, and nothing noticed. The anchors below live in
`src/shared/art-anchors.ts` and both sides read them.

---

## 1. The character

**Mochi is a small, round cat.** Cream-coloured, with one warm orange scarf and a soft
silhouette that should read as "a friendly creature" in a single glance at 200 px.

The current drawing is a single blob with the face crowded into its middle. The proposal
splits it into a **head on a body**, which fixes three problems at once: the face ends up
where the spec says it is, there is a **neck** for the scarf to actually sit at, and the
silhouette gains a shape you can read at a glance.

### Proportions

| Part | Shape | Spans | Notes |
| --- | --- | --- | --- |
| Head | A rounded square, softer at the cheeks | x 48–152, y 38–118 | Centred on the head anchor |
| Ears | Two triangles on the head | tips at y 34 | Inner ear in the inner-ear colour |
| Body | A rounded pear, wider at the bottom | x 52–148, y 112–210 | Sits on the ground |
| Neck | The seam where the head meets the body | y 108–124 | The scarf sits here |
| Tail | Leaves the body and curls up and right | root at (156, 160) | Stays inside x = 200 |
| Paws | Two small ovals at the bottom | resting at y 212 | Ground contact |
| Shadow | A soft ellipse under the paws | y 216, 120 × 18 | Ink at 12 % |

### The face

The face lives on the head, not in the middle of the body.

| Feature | Where |
| --- | --- |
| Eyes | y 76, at x 82 and x 118 |
| Nose | (100, 88) |
| Mouth | y 94 |
| Blush | (78, 88) and (122, 88) |

### The scarf

Around the **neck**, not across the body — a band from y 108 to 124, knotted at the scarf
anchor, with the loose end hanging down the chest to about y 168.

### Colours

Straight from the design system's art palette, so the pet and the Den are one family:

| Token | Value |
| --- | --- |
| Body | `#F3E7D6` |
| Body, lit | `#FBF3E6` |
| Shadow | `#E4D2BB` |
| Inner ear | `#E8B7A6` |
| Scarf | `#E9A15C` |
| Ink | `#2A2622` |
| Highlight | `#FFFDF8` |

The current drawing has a gradient from a cream to a warm tan. The proposal keeps that
gradient but anchors it on the three tones above, so it still has depth without inventing
colours the design system does not have.

---

## 2. The anchors

These are numbers the drawing must hit and the code may rely on.

| Anchor | Position | What hangs off it |
| --- | --- | --- |
| `character` | (100, 140) | The line the pet turns around |
| `head` | (100, 78) | The eyes, and the head's centre |
| `body` | (100, 158) | The belly |
| `scarfKnot` | (100, 120) | The scarf's knot |
| `headAttach` | (100, 44) | A leaf hat |
| `faceAttach` | (100, 76) | Glasses |
| `pawAttach` | (146, 176) | A mug, in the right paw |
| `groundAttach` | (100, 216) | A bed |
| `tailRoot` | (156, 160) | Where the tail leaves the body |
| `earTip` | y 34 | The highest point of the pet |

The artboard is **200 × 220**, and no visible part of the pet may leave it in any state.

### What the current drawing gets wrong

| Anchor | Spec | Current art | Off by |
| --- | --- | --- | --- |
| Artboard | 200 × 220 | 200 × 220 | exact |
| `character.centreX` | 100 | 100 | exact |
| `earTip` | y 34 | y 35 | 1 px |
| `head` | (100, 78) | the face is at about (100, 110) | **32 px low** |
| `scarfKnot` | (100, 120) | (100, 151) | **31 px low** |
| `body` | (100, 158) | belly at (100, 158) | exact |
| ground | y 212 | paws stop at y 207 | 5 px |
| `shadow` | y 216 | y 209 | 7 px |
| `pawAttach` | (146, 176) | the paw ends at x 141 | 5 px |

That is the list the redraw has to close.

---

## 3. The layers

Drawn back to front, so the tail is behind the body and the accessories sit on top:

| # | Layer | What is in it |
| --- | --- | --- |
| 1 | `ground` | The contact shadow, a bed |
| 2 | `tail` | The tail and its outline |
| 3 | `body` | The body and the belly |
| 4 | `scarfBack` | The piece of the scarf behind the body |
| 5 | `head` | The head and the ears |
| 6 | `face` | Eyes, nose, mouth, blush, glasses |
| 7 | `scarfFront` | The band and knot at the neck, the hanging end |
| 8 | `accessory` | A hat, a mug — anything the player unlocks |
| 9 | `effects` | The Zzz, the sparkles |
| 10 | `outline` | The ink outline, shown in high contrast only |

**No text in the artboard.** The current "Zzz" is three `<text>` elements, which the design
rules forbid. It becomes three drawn shapes.

---

## 4. The accessories

The design system lists seven. Each needs somewhere to live, and the anchors give it one.

| Accessory | Where it goes | How |
| --- | --- | --- |
| ScarfMoss, ScarfSky, AuroraScarf | The scarf | Recolour the `scarfFront` and `scarfBack` |
| Glasses | `faceAttach` (100, 76) | Two lenses and a bridge across the face |
| LeafHat | `headAttach` (100, 44) | Sits on top of the head, between the ears |
| Mug | `pawAttach` (146, 176) | Held in the right paw |
| Bed | `groundAttach` (100, 216) | Under the pet, behind it |

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
