# References and Verified Facts

All version numbers and API facts below were checked on **2026-10-19** during specification. Re-verify before scaffolding or upgrading; Electron and Rive move quickly.

## 1. Verified toolchain versions

| Package / tool | Version | How verified |
| --- | --- | --- |
| Node.js | 24.15.0 | `node -v` on the build machine |
| npm | 12.0.2 | `npm -v` |
| Electron | 44.9.0 | `npm view electron version` |
| `@rive-app/react-canvas` | 4.37.0 | `npm view @rive-app/react-canvas version`; package types inspected |
| `@rive-app/canvas` (runtime) | 2.45.0 | dependency of `@rive-app/react-canvas@4.37.0`; tarball inspected |
| `@rive-app/react-webgl2` | 4.37.0 | `npm view`; evaluated as fallback |
| `electron-builder` | 26.15.3 | `npm view electron-builder version` |
| `better-sqlite3` | 13.0.3 | `npm view`; evaluated and rejected for v1 |
| OS under test | Windows 11 Home (build 26300 family) | PowerShell `Get-CimInstance Win32_OperatingSystem` |

Other dependencies (React 19, TypeScript 5, Vite/electron-vite, Tailwind 4, Radix, Motion, Zustand, Zod 4, Vitest 3, Playwright, electron-log 5, electron-updater 6) are pinned at scaffold time; exact versions belong in `package.json`, not in this table, until the lockfile exists.

## 2. Electron facts used in the design

| Fact | Source |
| --- | --- |
| Transparent windows require `transparent: true`; they cannot be resized, have no native shadow, and DevTools disables transparency. Transparent areas are not click-through by default. | [Electron: Custom Window Styles](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles) |
| `win.setIgnoreMouseEvents(ignore[, options])` supports `forward` on Windows/macOS to keep receiving mouse-move events while ignoring clicks. | [Electron: BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window) (`win.setIgnoreMouseEvents`) |
| `win.setAlwaysOnTop(flag[, level])` supports levels including `screen-saver`; it maps to a topmost window. | [Electron: BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window) (`win.setAlwaysOnTop`) |
| `setVisibleOnAllWorkspaces` is supported on macOS/Linux; on Windows `visibleOnAllWorkspaces` always returns false. | [Electron: BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window) (`win.visibleOnAllWorkspaces`) |
| `showInactive()` shows a window without focusing it. | [Electron: BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window) |
| `app.getPath('userData')` resolves the per-user data directory. | [Electron: app](https://www.electronjs.org/docs/latest/api/app) |
| `powerMonitor` exposes `suspend`, `resume`, `lock-screen`, `unlock-screen`, `getSystemIdleState`, `getSystemIdleTime`, and battery events. | [Electron: powerMonitor](https://www.electronjs.org/docs/latest/api/power-monitor) |
| Electron fuses can disable `RunAsNode`, `NODE_OPTIONS`, CLI inspect, and enforce ASAR integrity. | [Electron: Fuses](https://www.electronjs.org/docs/latest/tutorial/fuses) |
| `session.setPermissionRequestHandler` and `setPermissionCheckHandler` deny web permissions by default. | [Electron: session](https://www.electronjs.org/docs/latest/api/session) |
| `protocol.handle` + `registerSchemesAsPrivileged` can serve a custom, secure `app://` scheme. | [Electron: protocol](https://www.electronjs.org/docs/latest/api/protocol) |

## 3. Rive facts used in the design

Facts verified by inspecting the published package tarballs/types (`@rive-app/canvas@2.45.0`, `@rive-app/react-canvas@4.37.0`) in addition to the documentation.

| Fact | Evidence |
| --- | --- |
| React hooks include `useRive`, `useViewModel`, `useViewModelInstance`, `useViewModelInstanceNumber/String/Boolean/Enum/Trigger/Color`, `useStateMachineInput`. | `@rive-app/react-canvas` 4.37.0 `dist/types/index.d.ts` |
| State-machine inputs are marked deprecated in favor of data-binding properties. | JSDoc on `useStateMachineInput` in the same type definitions |
| The runtime supports view models and enums: `Rive.viewModelByName`, `ViewModel.properties`, `DataEnum`, `ViewModelInstance`. | `@rive-app/canvas` 2.45.0 `rive.d.ts` |
| `RiveParameters` uses `stateMachine` (singular); `stateMachines` and `animations` are deprecated. | `rive.d.ts` `RiveParameters` |
| `RuntimeLoader.setWasmUrl(url)` and `setWasmFallbackUrl(url)` exist; the default fallback otherwise points at a CDN. | `runtimeLoader.d.ts` |
| The package ships `rive.wasm` and `rive_fallback.wasm` at its root, enabling fully offline loading. | Package tarball listing |
| `Rive.contents` exposes artboards/animations/state machines; `rive.viewModelByName(name).properties` exposes property metadata for contract validation. | `rive.d.ts` |
| Runtime methods include `play()`, `pause()`, `stopRendering()`, `startRendering()`, `resizeDrawingSurfaceToCanvas()`, and `cleanup()`. | `rive.d.ts` |
| `RiveParameters` includes `enableRiveAssetCDN` (default true), which must be set to false for offline operation. | `rive.d.ts` |

Documentation links:

- [Rive React runtime](https://rive.app/docs/runtimes/react/react)
- [Rive React parameters and return values](https://rive.app/docs/runtimes/react/parameters-and-return-values)
- [Rive data binding overview](https://rive.app/docs/editor/data-binding/overview)
- [Rive web JS runtime](https://rive.app/docs/runtimes/web/web-js)
- [Rive React GitHub repository](https://github.com/rive-app/rive-react)
- [Rive WASM runtime repository](https://github.com/rive-app/rive-wasm)

> The Rive documentation site was not reachable from the specification environment at one point (DNS/private-address resolution); the package type definitions were used as the authoritative fallback. Re-check the docs when scaffolding.

## 4. Windows platform facts and limitations

| Fact | Source / implication |
| --- | --- |
| A topmost (`HWND_TOPMOST`) window stays above non-topmost windows, but exclusive-fullscreen applications can still cover it. | [Microsoft PowerToys: Always On Top](https://learn.microsoft.com/en-us/windows/powertoys/always-on-top) · [PowerToys issue #27088](https://github.com/microsoft/PowerToys/issues/27088) |
| UAC secure desktop and some fullscreen games are outside normal window composition. | Documented limitation; no workaround in v1 |
| Virtual desktops isolate windows; Electron's all-workspaces API is not available on Windows. | Electron `BrowserWindow` docs |
| Transparent Electron windows can show black/gray frames or stale textures on some GPU drivers. | [Electron issue #40515](https://github.com/electron/electron/issues/40515) · [Electron issue #1335](https://github.com/electron/electron/issues/1335) |
| SmartScreen reputation is independent of a valid signature and builds over time. | Microsoft code-signing documentation; release risk R-05 |
| Windows notifications attribute to an AppUserModelID; set it before showing toasts. | Electron `app.setAppUserModelId` docs |

## 5. Design references (conceptual, not dependencies)

- Disney's 12 principles of animation, applied in the [Visual & motion system](../03-design/visual-and-motion.md#63-principles-in-practice).
- WCAG 2.2 AA for the Den and bubble.
- Windows Fluent spacing/elevation conventions only as a sanity check; Mochi uses its own warm token set.

## 6. How to re-verify before implementation

```bash
node -v && npm -v
npm view electron version
npm view @rive-app/react-canvas version
npm view @rive-app/react-webgl2 version
npm view electron-builder version
npm view electron-updater version
```

Then:

1. Scaffold and run Spike S1 (transparent window, click-through, drag, motion).
2. Inspect the installed Rive package types to confirm the hooks/properties used in the contract.
3. Run the Rive contract validator against the first `.riv`.
4. Record results in the [risk register](../05-plan/risk-register.md) and the ADR status lines.
