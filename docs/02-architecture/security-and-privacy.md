# Security and Privacy

| Field | Value |
| --- | --- |
| Status | Approved for build |
| Version | 1.0 |
| Date | 2026-10-19 |
| Related | [IPC contracts](ipc-contracts.md) · [Data & persistence](data-and-persistence.md) · [ADR-0009](../04-adr/0009-privacy-first-observability.md) |

Mochi is a local desktop companion, not a security product. That lowers the stakes but does not remove them: it runs code from the internet, draws an always-on-top surface over other applications, stores personal usage patterns, and updates itself. The posture is **least privilege, no remote content, no telemetry, and no surprises**.

## 1. Trust boundaries and assets

```
┌─────────────────────────── User's Windows account ───────────────────────────┐
│                                                                              │
│  ┌──────────────┐   IPC (validated)   ┌──────────────────────────────────┐    │
│  │  Renderers   │◄───────────────────►│ Main process (full Node)         │    │
│  │  sandboxed   │                     │  windows, fs, updates, network   │    │
│  └──────────────┘                     └───────────────┬──────────────────┘    │
│                                                       │                        │
│                                          ┌────────────▼────────────┐           │
│                                          │ %APPDATA%\Mochi (state)  │           │
│                                          └─────────────────────────┘           │
└───────────────────────────────────────────────────────────────┬──────────────┘
                                                                │ HTTPS (update metadata only)
                                                     ┌──────────▼──────────┐
                                                     │ Update endpoint      │
                                                     └─────────────────────┘
```

| Asset | Sensitivity | Protection |
| --- | --- | --- |
| Focus history and settings | Low–medium (behavioral pattern) | OS user-profile ACLs; local-only; export is explicit |
| `installId` | Low (random UUID) | Not derived from hardware; never sent automatically |
| App binaries and updates | High (code execution) | Code signing, ASAR integrity, update signature verification |
| Renderer → main channel | High (privilege boundary) | Sandbox, context isolation, schema validation, sender checks |
| Rive/WASM assets | Medium (runtime code/data) | Bundled, version-pinned, no remote loading, contract-validated |
| Logs | Low | No content/PII; rotation; redaction |

**Out of scope:** a local attacker with the user's Windows account (they can read `%APPDATA%` and patch the app), physical access, and OS-level malware. Mochi does not claim to defend against those.

## 2. Threat model

| # | Threat | Vector | Mitigation | Residual |
| --- | --- | --- | --- | --- |
| T1 | Remote code execution via embedded web content | Loading a remote URL or user HTML | No remote content; CSP; navigation blocked; `app://` only | Low |
| T2 | Renderer compromise escalates to full Node | Node integration, context leakage | `sandbox:true`, `contextIsolation:true`, `nodeIntegration:false`, narrow preload | Low |
| T3 | Malicious IPC payload corrupts state or crashes main | Compromised renderer / XSS | Zod validation, rate limits, sender/frame checks, no dynamic channels | Low |
| T4 | Path traversal in the asset protocol | Crafted `app://` URL | URL normalization, path containment, MIME allowlist, no filesystem browsing | Low |
| T5 | Tampered update installs malware | Compromised endpoint / MITM | HTTPS, code signature verification, no downgrade, staged rollout | Low–medium (key compromise) |
| T6 | Tampered local app files | Local attacker / patcher | ASAR integrity, code signing; local attacker is out of scope | Accepted |
| T7 | Malicious `.riv` asset | Supply chain / user import | Designer-owned, bundled, CI-validated; no user import in v1 | Low |
| T8 | Dependency supply-chain attack | npm package compromise | Lockfile, `npm ci`, pinned versions, audit, review of lockfile diffs, no unnecessary native modules | Medium (industry-wide) |
| T9 | Notification spam / social engineering | Compromised renderer triggers toasts | Notification rate caps, main-only notifications, user settings | Low |
| T10 | Data exfiltration | Hidden network calls | No analytics; only update check; network trace test; CSP `connect-src 'self'` | Low |
| T11 | Overlay abuse (phishing/clickjacking) | Always-on-top window mimics UI | Window is transparent, click-through, fixed 320×360, no input fields on the pet; Den is a normal window | Low |
| T12 | Screen/keystroke monitoring | Hidden hooks | Not implemented; idle duration only via `powerMonitor`; privacy review | Low |
| T13 | Denial of service via IPC flood | Compromised renderer | Token buckets, payload caps, coalescing, handler timeouts | Low |
| T14 | Sensitive data in logs/exports | Debug logging | Allowlisted fields, path minimization, preview-before-export | Low |

## 3. Electron hardening

### 3.1 Window configuration

Every `BrowserWindow` uses:

```ts
webPreferences: {
  preload: /* absolute, per-surface */,
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  nodeIntegrationInWorker: false,
  nodeIntegrationInSubFrames: false,
  webviewTag: false,
  webSecurity: true,
  allowRunningInsecureContent: false,
  experimentalFeatures: false,
  spellcheck: false,
  devTools: isDev,
  safeDialogs: true,
  disableDialogs: true,       // renderers use custom UI, never alert()
}
```

- `app.enableSandbox()` is called before `ready` as defense in depth.
- No `additionalArguments` carry secrets; preload gets no environment variables.
- DevTools are disabled in production builds, not merely hidden behind a shortcut.

### 3.2 Navigation and new windows

Global guard on `app.on('web-contents-created')`:

```ts
contents.setWindowOpenHandler(({ url }) => {
  if (isAllowedExternalUrl(url)) shell.openExternal(url);
  return { action: 'deny' };
});
contents.on('will-navigate', (event, url) => {
  if (!isInternalUrl(url)) event.preventDefault();
});
contents.on('will-attach-webview', (event) => event.preventDefault());
```

- `isAllowedExternalUrl` accepts only `https:` and an explicit host allowlist (support site, privacy policy, GitHub repository). It parses with `new URL`, rejects credentials, punycode homographs are not relevant for the fixed allowlist, and never passes the raw string to a shell.
- Internal URLs are only `app://pet/...` and `app://den/...` (or the exact Vite dev origin).
- No `<a target="_blank">` is rendered in the Den without an explicit allowlisted URL.

### 3.3 Custom protocol

```ts
protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false },
}]);
```

`protocol.handle('app', …)`:

1. Parse the URL; reject non-`app:` schemes.
2. Map the host (`pet`, `den`, `assets`) to a root inside the packaged `dist/` (or `resources/` for Rive/WASM).
3. Decode the path once, reject `..`, null bytes, backslashes, absolute paths, and unknown extensions.
4. Resolve with `path.resolve(root, '.' + pathname)` and assert `resolved.startsWith(root + path.sep)`.
5. Serve with an explicit MIME allowlist (`.html`, `.js`, `.css`, `.wasm`, `.riv`, `.png`, `.svg`, `.woff2`, `.json`).
6. Add security headers (`Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `Cross-Origin-Opener-Policy: same-origin`).
7. Return 404 for everything else; never list directories.

Package layout: the renderer bundles live in `dist/` inside the ASAR; `resources/rive/` is outside the ASAR (extraResources) and mapped by the `assets` host. Only these two roots are served.

### 3.4 CSP

```
default-src 'none';
script-src 'self' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:;
font-src 'self';
connect-src 'self';
media-src 'self';
worker-src 'none';
frame-ancestors 'none';
object-src 'none';
base-uri 'none';
form-action 'none';
```

`style-src 'unsafe-inline'` is required for Rive's canvas sizing and React inline styles; it does not permit script execution. `wasm-unsafe-eval` is required by the Rive runtime; no arbitrary JS eval is allowed.

### 3.5 Permissions and sessions

- `session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(false))` denies camera, microphone, geolocation, clipboard read, notifications from web content, and all others. OS notifications are sent from main via Electron `Notification`, not the web API.
- `setPermissionCheckHandler` returns false for the same set.
- Spellchecker disabled (`setSpellCheckerEnabled(false)`) to avoid dictionary downloads.
- No cookies, no web storage used for authentication; the Den may use in-memory state only.
- Proxy: follow system proxy for the update check; no custom proxy credentials stored.
- Certificate errors are rejected; there is no `certificate-error` bypass.

### 3.6 Fuses and ASAR integrity

Production packages are built with `asar: true` and fused via `@electron/fuses` in the `afterPack` hook:

| Fuse | Value |
| --- | --- |
| `RunAsNode` | false |
| `EnableCookieEncryption` | true |
| `EnableNodeOptionsEnvironmentVariable` | false |
| `EnableNodeCliInspectArguments` | false |
| `EnableEmbeddedAsarIntegrityValidation` | true |
| `OnlyLoadAppFromAsar` | true |

A release test launches the packaged app with `ELECTRON_RUN_AS_NODE=1` and `--inspect` and asserts both fail. ASAR integrity is verified at startup; a mismatch shows a native error and exits rather than running modified code.

### 3.7 Development vs. production

| Control | Dev | Production |
| --- | --- | --- |
| DevTools | Enabled | Disabled |
| Source maps | Inline | Hidden, not shipped |
| `debug:*` IPC | Registered | Not registered |
| CSP | Dev origin allowed | `app://` only |
| Vite server | `http://localhost` | Not present |
| Log level | Debug | Info/warn |
| Remote URLs | Dev fixtures only | Denied |

The production build must fail if `NODE_ENV !== 'production'` when packaging. CI asserts the absence of `debug:` handlers and source maps in the artifact.

## 4. Update security

- Updates are delivered over HTTPS by the configured provider (see [ADR-0008](../04-adr/0008-packaging-signing-updates.md)).
- `electron-updater` verifies the Windows Authenticode signature of the downloaded installer before executing it. A failed signature aborts the update and keeps the current version.
- The app does not accept downgrades or arbitrary feed URLs from settings. The feed URL is compiled in and not renderer-writable.
- The update check runs at most every 6 h, sends only the standard updater user agent (app version, OS, arch) to fetch metadata; it does not send the `installId` or usage data.
- Staged rollout: a release is published to a beta channel first; the stable channel is updated after the release checklist passes.
- Signing keys are stored in the CI secret store with least privilege; a compromise requires key rotation and a new release, not just a new artifact. This is documented as a residual risk.

## 5. Supply chain

- Exact versions are pinned for Electron, Rive, electron-builder, and electron-updater. `package-lock.json` is committed; CI uses `npm ci`.
- New dependencies require a review of: maintained status, install scripts, transitive native modules, and license. We avoid native modules in v1 (the JSON store is deliberate).
- `npm audit --omit=dev` is run in CI. High/critical findings block release until patched or explicitly accepted with an expiry and rationale in the risk register.
- Rive `.riv` files are treated as binary assets: only designers with write access can change them, the contract validator must pass, and the PR shows a behavior reel.
- GitHub Actions use pinned major versions and least-privilege tokens; release jobs run only on tags, not pull requests.
- `electron-builder` `npmRebuild` is not needed (no native deps); the build is reproducible from the lockfile.

## 6. Privacy posture

### 6.1 Principles

1. **Local-first.** No account, no cloud, no sync, no analytics SDK.
2. **No content.** Mochi never reads window titles, app names, keystrokes, clipboard, screen pixels, or files.
3. **No silent network.** The only default network request is the update check.
4. **Explicit sharing.** Diagnostics exports are local files the user chooses to save/share.
5. **Deletable.** Reset and uninstall offer data deletion; export is available before reset.

### 6.2 Data inventory

| Data | Collected | Stored | Retention | Shared | Purpose |
| --- | --- | --- | --- | --- | --- |
| Settings | User-created | `state.json` | Until reset/uninstall | Never | Preferences |
| Energy/mood/XP/level | Derived | `state.json` | Until reset/uninstall | Never | Companion continuity |
| Focus phase durations, pause reasons | Derived | `state.json` + aggregates | Aggregates indefinite; raw ≤ 30 days | Never | Timer, stats |
| Focus session timestamps | Derived | `state.json` | Aggregates/summary | Never | Stats, recovery |
| Placement/display signature | Derived | `state.json` | Until reset/uninstall | Never | Remember position |
| `installId` | Random UUID | `state.json` | Until reset/uninstall | Only in a user-initiated export | Support correlation |
| Logs | Local diagnostics | `logs/` | 30 days / 35 MB (7 × 5 MB) | Only if user exports | Debugging |
| Diagnostics events | Optional, local | `events.jsonl` | 30 days / 5 MB | Only if user exports | Debugging |
| Update check metadata | App version, OS, arch | Not stored by Mochi | — | Sent to update provider | Deliver updates |

No health, financial, biometric, precise location, contacts, or advertising data. No data is sold or used for advertising. Mochi is not directed at children.

### 6.3 Network behavior

| Endpoint | When | Payload | Response |
| --- | --- | --- | --- |
| Update metadata URL | 10 s after launch, then every 6 h; manual check | Standard updater headers (app version, OS, arch) | Version metadata; then signed artifact download |
| User-opened links | Explicit click only | The URL itself, via the default browser | — |

There are no other outbound requests. The network-trace test in [Test strategy](../05-plan/test-strategy.md#10-security-testing) asserts this for a 30-minute session.

### 6.4 Privacy controls

- **Export** shows the exact JSON/log bundle before saving.
- **Reset** requires confirmation and defaults to keeping settings.
- **Uninstall** offers keep/delete data; the login item is always removed.
- **Privacy policy** is shipped in-app (Settings → About) and fits on one page: what is stored, where, why, retention, how to delete.
- **No consent banner** is needed because there is no tracking. The first-run onboarding links to the policy quietly.

## 7. Logging and redaction

- Structured logs: `{ts, level, event, correlationId, props}`.
- Allowlisted props only; never log full state objects, window titles, file contents, URLs with query strings, or raw IPC payloads.
- User paths are minimized to `<user>\…` in exported diagnostics; local logs may contain the path for support.
- Errors log a code and stack in local logs (stack is useful); exported diagnostics include stacks but not environment variables or tokens.
- Log files rotate at 5 MB with 7 files; older files are deleted.

## 8. Security testing

| Test | Gate |
| --- | --- |
| Fuse verification on packaged artifact | Release blocker |
| `ELECTRON_RUN_AS_NODE` / `--inspect` launch denial | Release blocker |
| ASAR tamper test (modify a byte) → startup refuses | Release blocker |
| Protocol traversal suite (`..`, `%2e%2e`, UNC, null byte) | PR |
| IPC fuzz + sender/frame spoofing | PR |
| CSP violation check in production build | Release blocker |
| Network trace: no requests except update | Release blocker |
| Signature verification of installer/update | Release blocker |
| `npm audit` high/critical review | Release blocker |
| Dependency install-script review for new packages | PR |

## 9. Incident response and disclosure

- **Contact:** `security@mochipet.app` (placeholder until domain is registered). PGP key published on the support site.
- **Disclosure:** acknowledge within 3 business days, target fix within 30 days for critical issues, coordinate disclosure after a fix is available. No bug bounty in v1; credit is offered.
- **Compromised signing key:** revoke the certificate, publish an advisory, release a new signed build from a clean CI runner, and instruct users to reinstall from the official source. No silent auto-update from the compromised channel.
- **Data incident:** because no data leaves the device, the blast radius is local. If an export upload feature is ever added, this section must be revised with a breach process.

## 10. Release security checklist

- [ ] Packaged build has all fuses set and verified.
- [ ] DevTools disabled; `debug:*` handlers absent; no source maps.
- [ ] ASAR integrity enabled; tamper test passes.
- [ ] CSP enforced in production; no `unsafe-eval`, no remote origins.
- [ ] Navigation/new-window/permission handlers deny by default.
- [ ] Installer and update artifacts signed; updater rejects tampered artifacts.
- [ ] Network trace shows only the update check.
- [ ] Logs/exports contain no PII or content.
- [ ] Privacy policy and data inventory match the shipped build.
- [ ] Dependency audit triaged; no unexplained native modules.
- [ ] Security contact and disclosure policy published.

---

**Next:** [Performance & reliability →](performance-and-reliability.md)
