# Glossary

Terms are listed alphabetically. If a document uses a term differently, the definition here wins until the document is corrected.

| Term | Definition |
| --- | --- |
| **ADR** | Architecture Decision Record. An immutable record of a decision, its context, alternatives, and consequences. See [ADRs](../04-adr/README.md). |
| **AppSnapshot** | The complete state projection sent to a renderer on bootstrap/resync: settings, pet, focus, UI, capabilities, revision. |
| **ASAR** | Electron's archive format for packaging app files. Mochi enables ASAR integrity validation so modified app files are rejected. |
| **Behavior** | A time-bounded activity expressed by the pet (idle micro-gesture, walk, sleep, wave, focus, celebrate, drag). Distinct from a **mode**. |
| **Behavior director** | The pure-TS scheduler that selects behaviors based on mode, time, energy, mood, focus state, recency, and seeded randomness. It is the pet's brain. |
| **Bubble** | The small HTML speech card above the pet. Max 80 characters, one action, auto-dismisses. All text lives here, not in the Rive artboard. |
| **Click-through** | The property that clicks in transparent areas pass to the application underneath. Implemented with `setIgnoreMouseEvents(true, {forward:true})` and a hit-test toggle. |
| **Contract version** | An integer that identifies the required Rive artboard/state machine/view-model interface. A breaking asset change bumps it. |
| **Correlation id** | A random id attached to an IPC error so a user-facing message can be matched to a local log entry without exposing internals. |
| **Degradation ladder** | The ordered fallbacks when budgets or rendering fail: FX off → 30 Hz → no roam → sleep low-power → static silhouette → timer-only. |
| **Den** | The main application window: Home, Focus, Insights, Locker, Settings. Standard framed window, not transparent. |
| **DIP** | Device-independent pixel. Electron's window and screen coordinates are DIPs; a 320×360 DIP window is physically larger at 150% scaling. |
| **Fallback silhouette** | The inline SVG pet shown if the Rive asset/WASM fails. The app never shows a blank transparent window. |
| **Focus phase** | One timed interval: work, short break, or long break. |
| **Focus session** | A sequence of phases (work → break → … → long break) with one configuration snapshot. Only one session exists at a time. |
| **Fuse** | An Electron build-time capability switch (e.g., disable `RunAsNode`, enable ASAR integrity). Production builds set all fuses per the security checklist. |
| **Hit region** | The window-space ellipse (plus bubble rect) that makes the pet interactive. Defined per Rive state; expanded by 8 DIP for entering hysteresis. |
| **Level** | The pet's progression tier, derived from XP. Thresholds: `10 × (n−1) × (n+5)` for `n ≥ 2`, capped at 20. |
| **Low power** | A rendering mode that disables FX/particles and reduces secondary motion, used on battery or when budgets are tight. Does not change semantics. |
| **Mode** | The macro-state of the pet: `boot`, `awake`, `focus`, `sleep`, `dragged`, `hidden`, `suspended`. Focus is a mode because it suppresses roaming and sleep. |
| **Motion driver** | The main-process 60 Hz loop (30 Hz fallback) that moves the pet window along a roam plan and publishes speed/facing. |
| **NSIS** | The Windows installer format produced by electron-builder. Mochi ships a one-click, per-user installer requiring no admin rights. |
| **Partial credit** | XP awarded for a work phase stopped at ≥ 50% completion: prorated minutes, no completion bonus, no session count, streak unchanged. |
| **Projection** | A read-only rendering of main's authoritative state in a renderer. The renderer may add ephemeral UI state but cannot own durable state. |
| **Protocol version** | The IPC envelope/schema version (`1` for v1). Renderer and main ship together; a mismatch triggers a restart state, not interpretation. |
| **Quiet hours** | A configurable window (default 22:00–07:00) where unsolicited bubbles/toasts are suppressed and sleep is biased. |
| **Reduced motion** | An accessibility mode that removes window roaming, confetti, and large motion; transitions ≤ 150 ms. Follows the OS preference by default. |
| **Revision** | A monotonically increasing integer on snapshots/patches within one app run, used to detect missed messages and trigger resync. |
| **Rive** | The interactive vector animation tool/runtime used for the pet. The `.riv` file is a versioned interface, validated in CI. |
| **Roam band** | The horizontal region in which the pet may walk: a corner band (default), the full work-area width ("wander"), or none ("stationary"). |
| **Runtime checkpoint** | A tiny `runtime.json` written every 2 s during a focus phase, bounding crash loss to ≤ 2 s without rewriting the full state. |
| **Session (focus)** | See **Focus session**. |
| **Snap** | Dropping the pet within 48 DIP of a work-area corner/edge animates it into place (180 ms) and persists the anchor. |
| **Stage mode** | A contingency where the pet window spans the work-area width and the pet animates inside it without moving the OS window. Used only if window motion fails the frame budget. |
| **State machine (Rive)** | The authored graph (`PetSM`) that blends states, blinking, breathing, and transitions based on view-model values. |
| **Streak** | Consecutive local days with at least one completed work phase. Missed days reset the current streak; the longest is preserved. XP never decreases. |
| **View model (Rive)** | The typed data interface (`PetModel`) exposed by the `.riv` and set by the bridge. Replaces deprecated state-machine inputs. |
| **Work area** | The usable area of a display excluding the taskbar and other reserved regions (`display.workArea`), in DIP. |
| **XP** | Experience points earned from completed focus work (1/min + 5 per phase), breaks (+2), and the first daily open (+3). Never decreases. |
