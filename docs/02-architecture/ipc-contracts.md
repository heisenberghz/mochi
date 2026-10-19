# IPC Contracts

| Field | Value |
| --- | --- |
| Status | Approved for build |
| Version | 1.0 |
| Protocol version | 1 |
| Date | 2026-10-19 |
| Related | [Security & privacy](security-and-privacy.md) · [Data & persistence](data-and-persistence.md) · [Architecture overview](overview.md) |

Every message that crosses a process boundary in Mochi is declared here. The IPC surface is intentionally small, typed, validated, rate-limited, and sender-checked. It is the primary security boundary between the sandboxed renderers and the main process.

## 1. Principles

1. **Narrow.** Renderers get commands they need and snapshots they render. They never get `ipcRenderer`, `fs`, `shell`, `BrowserWindow`, or a generic `send(channel, ...)`.
2. **Typed at compile time, validated at run time.** Shared Zod schemas produce TypeScript types via `z.infer`; main validates every inbound payload even if the renderer is trusted.
3. **Authoritative main.** Renderers request; main decides. No command is a direct state mutation.
4. **Idempotent where possible.** Pause/resume/skip/stop can be retried; start returns `already_active` rather than double-starting.
5. **Bounded.** Payload size, rate, and queue depth caps prevent a compromised renderer from exhausting main.
6. **Observable.** Every rejection has a typed code and a correlation id; no silent drops.

## 2. Envelopes

### 2.1 Invoke (renderer → main → renderer)

```ts
type InvokeRequest<T> = {
  v: 1;
  id: string;                 // uuid, generated in preload
  channel: Channel;
  payload: T;
};

type InvokeResponse<T> =
  | { v: 1; id: string; ok: true; data: T }
  | { v: 1; id: string; ok: false; error: IpcError };

type IpcError = {
  code: IpcErrorCode;
  message: string;            // safe for UI; no stack, no paths
  details?: Record<string, string | number | boolean>;
  correlationId: string;
  retriable: boolean;
};
```

Preload unwraps the envelope and returns a plain `Result<T>` to the renderer. The renderer never constructs `ipcRenderer.invoke` itself.

### 2.2 Events (main → renderer)

```ts
type EventEnvelope<T> = {
  v: 1;
  seq: number;                // monotonically increasing per surface
  channel: EventChannel;
  payload: T;
};
```

Events are fire-and-forget. If the renderer needs acknowledgment, it uses an invoke (`pet:ready`, `pet:animationAck`).

### 2.3 Serialization rules

- Structured clone only: plain objects, arrays, strings, numbers, booleans, `null`.
- No `Date`, `Error`, `Map`, `Set`, class instances, functions, or `undefined` in required fields. Timestamps are epoch milliseconds; dates in stats are `YYYY-MM-DD` strings.
- Payload cap: **64 KB** per message. Drag messages are < 200 bytes; snapshots are < 64 KB by construction (state cap < 250 KB is not sent whole — the snapshot omits history and logs).
- Binary data (exports) is written by main; renderers never receive file bytes.

## 3. Channel catalog

### 3.1 Invoke channels

| Channel | Sender | Payload | Success data | Rate limit | Notes |
| --- | --- | --- | --- | --- | --- |
| `app:bootstrap` | both | `{}` | `AppSnapshot` | 2/s | Includes protocol/revision |
| `app:resync` | both | `{revision}` | `AppSnapshot` | 2/s | Used after a patch gap |
| `window:setInteractive` | pet | `{interactive: boolean}` | `{interactive, appliedAt}` | 20/s | Coalesced client-side to 50 ms |
| `window:setPetVisible` | both | `{visible: boolean}` | `{visible}` | 5/s | Tray/hotkey path |
| `window:openDen` | both | `{view?: DenView}` | `{opened: boolean}` | 5/s | Focuses existing window |
| `window:bringHere` | both | `{}` | `{displayId}` | 2/s | Moves to cursor display |
| `pet:ready` | pet | `{contractVersion, riveVersion, dpr}` | `{accepted: boolean, reason?: string}` | 1/launch | Before this, main may show fallback |
| `pet:interaction` | pet | `{kind: 'poke' \| 'pet' \| 'hoverStart' \| 'hoverEnd', zone?: 'head' \| 'body'}` | `{moodDelta, capped: boolean}` | 10/s | Mood cap enforced in main |
| `pet:animationAck` | pet | `{nonce, riveState, appliedAt}` | `{ok: true}` | 30/s | One per accepted command |
| `pet:animationFault` | pet | `{code, message, nonce?}` | `{ok: true}` | 5/s | Triggers fallback policy |
| `pet:dragStart` | pet | `{pointerId, cursor: Point}` | `{offset: Point}` | 5/s | Main captures cursor offset |
| `pet:dragMove` | pet | `{cursor: Point}` | `{ok: true}` | 120/s | Optional; main polls cursor at 60 Hz |
| `pet:dragEnd` | pet | `{cursor: Point, canceled?: boolean}` | `{placement}` | 5/s | Snap/persist in main |
| `pet:contextMenu` | pet | `{cursor: Point}` | `{shown: boolean}` | 2/s | Native menu in main |
| `focus:start` | both | `{presetId?: string}` | `FocusView` | 2/s | Returns `already_active` / `break_active` |
| `focus:pause` | both | `{}` | `FocusView` | 5/s | Idempotent |
| `focus:resume` | both | `{}` | `FocusView` | 5/s | Rejected if not paused |
| `focus:skip` | both | `{}` | `FocusView` | 2/s | No XP for skipped work |
| `focus:stop` | both | `{}` | `FocusSummary` | 2/s | Partial credit per rules |
| `focus:setConfig` | den | `Partial<FocusConfig>` | `{config, appliesToNext}` | 10/s | Validated bounds |
| `settings:update` | den | `{patch: SettingsPatch}` | `{settings, applied: string[]}` | 20/s | Unknown keys rejected; focus timing keys are rejected (use `focus:setConfig`) |
| `stats:getRange` | den | `{from: 'YYYY-MM-DD', to: 'YYYY-MM-DD'}` | `StatsRange` | 2/s | Max 366 days |
| `data:export` | both | `{kind: 'data' \| 'diagnostics', includeLogs?: boolean}` | `{saved: boolean, path?: string}` | 1/5s | Native save dialog in main |
| `data:reset` | den | `{keepSettings: boolean}` | `{reset: true}` | 1/10s | Confirmation handled by Den |
| `diagnostics:getInfo` | both | `{}` | `DiagnosticsInfo` | 1/s | Versions, flags, counts |
| `debug:*` | both | varies | varies | — | Only when `isDev \|\| MOCHI_TEST=1` |

`Point` is `{x: number; y: number}` in DIP.

### 3.2 Event channels

| Channel | Recipient | Payload | Frequency | Purpose |
| --- | --- | --- | --- | --- |
| `state:snapshot` | both | `AppSnapshot` | On bootstrap/resync | Full state |
| `state:patch` | both | `StatePatch` | On change, ≤ 10 Hz | Section replacement + revision |
| `behavior:set` | pet | `AnimationCommand` | On change + speed @ 10 Hz | Drive Rive |
| `bubble:show` | pet | `BubbleSpec` | Rate-limited | Display a bubble |
| `bubble:hide` | pet | `{id}` | On dismissal | Hide a bubble |
| `focus:snapshot` | both | `FocusView` | 1 Hz + on command | Countdown display |
| `focus:phaseCompleted` | both | `{phase, round, xpAwarded, next}` | Once per phase | Celebration and Den update |
| `focus:sessionSummary` | den | `FocusSummary` | On stop/complete | Session card |
| `ui:toast` | den | `{tone, title, message?}` | ≤ 1/s | In-app toasts (not OS toasts) |
| `app:theme` | both | `{effective: 'light' \| 'dark' \| 'highContrast'}` | On OS change | Immediate theme update |

### 3.3 AppSnapshot

```ts
interface AppSnapshot {
  protocolVersion: 1;
  revision: number;
  capabilities: {
    platform: 'win32';
    isDev: boolean;
    riveContractVersion: number;
    reducedMotionEffective: boolean;
  };
  settings: Settings;          // full settings section
  pet: PetView;                // energy, mood, xp, level, cosmetics, mode
  focus: FocusView;            // phase, status, remainingMs, config, round
  ui: { theme: EffectiveTheme; lastDenView: DenView };
}
```

### 3.4 StatePatch

Sections present in a patch are **complete replacements**, not deep merges:

```ts
interface StatePatch {
  revision: number;
  pet?: PetView;
  focus?: FocusView;
  settings?: Settings;
  ui?: AppSnapshot['ui'];
}
```

This avoids merge bugs and keeps patches small (each section is < 2 KB). The renderer drops any patch with `revision ≤ current` and calls `app:resync` if `revision > current + 1`. Main increments `revision` once per emitted patch, not per changed field.

### 3.5 FocusView

```ts
interface FocusView {
  status: 'idle' | 'running' | 'paused' | 'breakReady';
  phase: 'work' | 'shortBreak' | 'longBreak' | null;
  round: number;
  totalRounds: number;
  remainingMs: number;
  phaseDurationMs: number;
  startedAt: number | null;     // epoch ms
  pauseReason: 'user' | 'idle' | 'locked' | 'suspend' | 'recovered' | null;
  config: FocusConfig;
  completedToday: number;       // completed work phases today
  nextPhase: 'work' | 'shortBreak' | 'longBreak' | null;
}
```

`remainingMs` is authoritative at emission time. The Den may interpolate display seconds for ≤ 1 s. `focus.config` in this view is **derived**: the active session's immutable snapshot when running, otherwise the current `settings.focus`. It is not a second persisted config.

## 4. Preload API

### 4.1 Pet surface (`window.mochiPet`)

```ts
interface MochiPetApi {
  readonly v: 1;
  bootstrap(): Promise<Result<AppSnapshot>>;
  onSnapshot(cb: (s: AppSnapshot) => void): Unsubscribe;
  onPatch(cb: (p: StatePatch) => void): Unsubscribe;
  onBehavior(cb: (c: AnimationCommand) => void): Unsubscribe;
  onBubble(cb: (b: BubbleSpec) => void): Unsubscribe;
  ready(info: { contractVersion: number; riveVersion: string; dpr: number }): Promise<Result<void>>;
  interaction(kind: 'poke' | 'pet' | 'hoverStart' | 'hoverEnd', zone?: 'head' | 'body'): Promise<Result<{ moodDelta: number; capped: boolean }>>;
  animationAck(ack: { nonce: number; riveState: string; appliedAt: number }): Promise<Result<void>>;
  animationFault(fault: { code: string; message: string; nonce?: number }): Promise<Result<void>>;
  dragStart(p: { pointerId: number; cursor: Point }): Promise<Result<{ offset: Point }>>;
  dragMove(p: { cursor: Point }): Promise<Result<void>>;
  dragEnd(p: { cursor: Point; canceled?: boolean }): Promise<Result<void>>;
  contextMenu(p: { cursor: Point }): Promise<Result<void>>;
  setInteractive(interactive: boolean): Promise<Result<void>>;
  openDen(view?: DenView): Promise<Result<void>>;
  togglePet(visible: boolean): Promise<Result<void>>;
  focus(action: 'start' | 'pause' | 'resume' | 'skip' | 'stop'): Promise<Result<FocusView>>;
  bubbleAction(bubbleId: string, actionId: string): Promise<Result<void>>;
}
```

### 4.2 Den surface (`window.mochiDen`)

```ts
interface MochiDenApi {
  readonly v: 1;
  bootstrap(): Promise<Result<AppSnapshot>>;
  onSnapshot(cb: (s: AppSnapshot) => void): Unsubscribe;
  onPatch(cb: (p: StatePatch) => void): Unsubscribe;
  onFocus(cb: (f: FocusView) => void): Unsubscribe;
  onSummary(cb: (s: FocusSummary) => void): Unsubscribe;
  onToast(cb: (t: ToastSpec) => void): Unsubscribe;
  focus(action: 'start' | 'pause' | 'resume' | 'skip' | 'stop'): Promise<Result<FocusView>>;
  setFocusConfig(patch: Partial<FocusConfig>): Promise<Result<{ config: FocusConfig; appliesToNext: boolean }>>;
  updateSettings(patch: SettingsPatch): Promise<Result<{ settings: Settings; applied: string[] }>>;
  getStats(range: { from: string; to: string }): Promise<Result<StatsRange>>;
  exportData(kind: 'data' | 'diagnostics', includeLogs?: boolean): Promise<Result<{ saved: boolean; path?: string }>>;
  resetData(keepSettings: boolean): Promise<Result<void>>;
  diagnostics(): Promise<Result<DiagnosticsInfo>>;
  openDen(view?: DenView): Promise<Result<void>>;
  bringPetHere(): Promise<Result<void>>;
  setPetVisible(visible: boolean): Promise<Result<void>>;
}
```

Both surfaces are created with `contextBridge.exposeInMainWorld`. The preload has no access to arbitrary channels: a private `invoke(channel, payload)` allowlist maps each method to exactly one channel and schema. Unknown channels are impossible from the renderer.

### 4.3 Subscriptions

- `on*` returns an unsubscribe function; React effects must call it.
- Preload maintains a single `ipcRenderer.on` listener per channel and fans out to callbacks, with a max of 8 listeners per event.
- If a callback throws, the error is caught and logged; it does not break other subscribers.
- Late subscribers do not receive historical events; they call `bootstrap()`.

## 5. Validation and authorization

### 5.1 Two-way validation

- **Inbound:** main validates `payload` with the channel's Zod schema. Preload also validates the shape (defense in depth) but never substitutes defaults silently.
- **Outbound:** main serializes via schema `.parse()` in development and `.strip()` in production for snapshots/patches; this guarantees no accidental fields (e.g., file paths) leak to the renderer. A serialization failure is logged and the event is dropped.
- **Types:** channel payload/response types are generated from the same schemas; the channel map is a single `const` with `satisfies` so a missing schema fails typecheck.
- **Unknown channels:** the main handler is registered only for the catalog; anything else is rejected before parsing.

### 5.2 Sender checks

Main maintains a `SurfaceRegistry: Map<webContents.id, 'pet' | 'den'>` populated only when it creates the windows. Every handler receives `event` and checks:

1. `event.sender.id` maps to the expected surface for the channel.
2. `event.senderFrame === event.sender.mainFrame` (no subframes).
3. `event.senderFrame.url` starts with `app://pet/` or `app://den/` (dev: the exact dev origin).
4. The webContents is not destroyed.

Failure returns `UNAUTHORIZED`, logs `ipc_unauthorized` with channel and sender id, and never touches state. This makes a compromised renderer unable to call a channel intended for the other surface, even though both are sandboxed.

### 5.3 Rate limiting

| Bucket | Limit | Burst | On exceed |
| --- | --- | --- | --- |
| `pet:interaction` | 10/s | 20 | Return `RATE_LIMITED`; mood not applied |
| `window:setInteractive` | 20/s | 30 | Coalesce; drop duplicate |
| `pet:dragMove` | 120/s | 200 | Drop oldest; main poll remains smooth |
| `settings:update` | 20/s | 40 | Return `RATE_LIMITED`; no partial apply |
| `stats:getRange` | 2/s | 4 | `RATE_LIMITED` |
| `data:export/reset` | 1/5s / 1/10s | 1 | `RATE_LIMITED` |
| All other invokes | 10/s | 20 | `RATE_LIMITED` |

A token bucket per `(surface, bucket)` refills continuously. Limits are deliberately generous for legitimate use; the goal is bounding damage, not throttling the user.

### 5.4 Timeouts

- Preload aborts an invoke after `IPC_INVOKE_TIMEOUT` (5 s) and returns `TIMEOUT`. The main handler may still complete; its result is ignored.
- Handlers that do disk I/O (export, reset, flush) have a 4 s internal timeout and return `TIMEOUT` with `retriable: true` rather than hanging the renderer.
- No handler blocks the event loop for > 50 ms; long work is split or offloaded.

## 6. Error codes

| Code | Meaning | UI behavior |
| --- | --- | --- |
| `VALIDATION` | Payload failed schema validation | Log; show generic "Something went wrong" in dev, no user-facing error for internal calls |
| `UNAUTHORIZED` | Wrong surface/frame/origin | Security log; no UI |
| `NOT_READY` | Main or asset not initialized | Retry once; show fallback if persistent |
| `NOT_FOUND` | Requested session/display/bubble doesn't exist | Inline message |
| `CONFLICT` | `already_active`, `break_active`, `already_paused` | Inline, non-blocking explanation |
| `RATE_LIMITED` | Bucket empty | Silent for ambient actions; inline for user actions |
| `TIMEOUT` | Handler exceeded budget | Retry button; never auto-retry destructive actions |
| `READ_ONLY` | Newer schema or recovery mode | Persistent banner in Den |
| `UNSUPPORTED` | Platform/feature unavailable | Disable control with tooltip |
| `INTERNAL` | Unexpected exception | Correlation id + "Copy diagnostics" action |

`message` is a short, human-readable sentence authored for the user, not an exception message. Internal details go to logs with the correlation id.

## 7. Revision and consistency

- `revision` is owned by `StateService`, incremented for every patch, and persisted? **No**; it resets to 0 on app start. It orders events within a run, not across runs.
- A renderer tracks `lastRevision`. A patch with `revision === last + 1` applies; `≤ last` is ignored; anything else triggers `app:resync`.
- `focus:snapshot` is also embedded in every `state:patch` when focus changes, so a renderer that misses an event converges via the next patch. Snapshots are the safety net; patches are the fast path.
- Main never sends a patch before the initial snapshot for that surface. A renderer that calls `bootstrap` twice (e.g., React StrictMode) gets the same snapshot with the current revision; it is safe.
- Commands are processed in arrival order per surface. Drag messages are the only exception: they are coalesced and order is still preserved by sequence.

## 8. Versioning

- `PROTOCOL_VERSION` is `1` for v1.0.
- Additive optional fields are allowed within a version; both sides must tolerate unknown fields in `ui`/`meta` only.
- Renaming/removing a channel or changing a payload requires a protocol version bump and a coordinated app update (they ship together, so this is mostly about clarity and tests).
- On bootstrap mismatch, the renderer shows a "Restart Mochi" state and reports `ipc_protocol_mismatch`; it never attempts to interpret an unknown payload.

## 9. Security invariants

1. Renderers cannot access Node, `fs`, `child_process`, `shell`, or `ipcRenderer`.
2. There is no generic `send(channel, payload)` exposed to page code.
3. Only the two registered webContents may invoke, and only for their surface.
4. All inbound payloads are schema-validated before use.
5. All outbound events are schema-serialized; no accidental object graphs.
6. File paths are never accepted from the renderer; save dialogs run in main.
7. Navigation/new windows are blocked at the window level, independent of IPC.
8. Debug channels are not registered in packaged production builds, not merely hidden.
9. Error messages never include stack traces, absolute paths, or environment variables.
10. A renderer crash or navigation does not leave stale handlers; the registry is cleared on `destroyed`.

## 10. Testing

| Test | Assertion |
| --- | --- |
| Channel inventory snapshot | Every channel has a schema, a sender surface, a rate limit, and a handler; adding/removing requires updating the snapshot |
| Zod round-trip | Sample payloads parse and serialize without drift |
| Fuzz | 10,000 malformed payloads per channel → `VALIDATION`, no crash, no state change |
| Sender spoofing | Calling a Den channel from the pet surface → `UNAUTHORIZED` |
| Frame spoofing | A subframe/iframe invoke → `UNAUTHORIZED` |
| Rate limits | Burst above limit returns `RATE_LIMITED`; legitimate traffic passes |
| Revision gaps | Dropping a patch triggers `app:resync` in the renderer harness |
| Timeouts | A hung handler returns `TIMEOUT` and the UI remains responsive |
| Debug gating | Packaged build rejects `debug:*` with `NOT_FOUND` |
| Leak check | Outbound snapshot contains no `path`, `webContents`, `BrowserWindow`, or functions |

The renderer test harness uses a fake preload that implements the same API and validates both directions, so UI tests run without Electron.

---

**Next:** [Security & privacy →](security-and-privacy.md)
