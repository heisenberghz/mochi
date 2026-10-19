# ADR-0008: electron-builder NSIS, code signing, and staged auto-updates

| Field | Value |
| --- | --- |
| Status | Accepted; hosting and certificate provider open (O-2, O-3) |
| Date | 2026-10-19 |
| Deciders | Engineering, Product |
| Related | [Requirements](../01-product/requirements.md#packaging-updates-and-lifecycle) · [Security](../02-architecture/security-and-privacy.md#4-update-security) · [Roadmap](../05-plan/roadmap.md) |

## Context

Mochi ships to non-technical Windows users. Installation must be one click, per-user, and admin-free. Updates must be reliable and never interrupt a focus session. Windows SmartScreen will warn on unsigned or low-reputation binaries, which directly harms activation.

The team is small; the release process must be automatable and testable on a clean VM.

## Decision

- **Packaging:** `electron-builder` 26.x with an **NSIS per-user** installer (`oneClick: true`, `perMachine: false`), plus a portable ZIP target.
- **Format:** ASAR enabled; `extraResources` for Rive WASM/assets; Electron fuses set in `afterPack`; embedded ASAR integrity on.
- **Signing:** Authenticode-sign the installer and executables. Preferred provider: **Azure Trusted Signing** (short-lived certs, CI-friendly); fallback: a standard OV/EV code-signing certificate stored in a hardware token/HSM or CI secret with restricted access. Final provider is O-3.
- **Updates:** `electron-updater` 6.x with the **NSIS** target, a stable and beta channel, staged rollout, and signature verification.
- **Hosting:** public **GitHub Releases** for beta (simple, transparent); if the repo must be private, switch to an object-storage/CDN generic provider with a signed `latest.yml`. Final choice is O-2. The feed URL is compiled in and not renderer-writable.
- **Timing:** first check 10 s after `ready-to-show`, then every 6 h; download in the background; install prompt deferred while a focus phase is running; install on quit by default, with an explicit "Restart now" in the Den.
- **Uninstall:** keep user data by default; offer deletion; always remove the login item.

## Alternatives considered

### MSIX / Microsoft Store

- **Pros:** clean install/update, store trust, automatic updates.
- **Cons:** store review, packaging constraints, sandboxed filesystem/startup behavior, less control over the update cadence, and a friction-heavy beta loop.
- **Verdict:** possible future channel, not v1.

### Squirrel.Windows

- **Pros:** mature Electron history.
- **Cons:** electron-builder/NSIS has better differential updates and signing integration today; Squirrel is effectively legacy for new apps.
- **Verdict:** rejected.

### Manual download / no auto-update

- **Pros:** simplest, no signing/update infrastructure.
- **Cons:** users stay on broken versions; security fixes do not land; support burden.
- **Verdict:** rejected for a consumer desktop app.

### Portable-only

- **Pros:** no install, no registry.
- **Cons:** poor discoverability, no login item, updates are manual, SmartScreen still applies.
- **Verdict:** offer as a secondary target, not the primary.

### Private GitHub Releases with a bundled token

- **Pros:** works with a private repo.
- **Cons:** shipping a token in the client is a security anti-pattern; it will be extracted.
- **Verdict:** forbidden. Use public releases or an unauthenticated signed feed.

## Consequences

### Positive

- One-click per-user install with no UAC prompt.
- Differential NSIS updates reduce download size and time.
- Signing, ASAR integrity, and fuses raise the bar for tampering.
- Channels allow a beta cohort before stable rollout.
- Deferring installs during focus respects the product promise.

### Negative / accepted costs

- Code signing costs money and adds CI secret management; certificate rotation is an operational task.
- SmartScreen reputation takes time even when signed; early users may see a warning.
- Auto-update adds a network dependency (metadata only) and a failure surface; needs VM testing.
- NSIS uninstall behavior and login-item cleanup need explicit testing.
- Staged rollout requires discipline; a bad release can still reach users if the gates are skipped.

### Neutral / follow-ups

- Auto-update does not support automatic rollback; a bad release is fixed forward. A manual reinstall path is documented.
- `app.setAppUserModelId` must match the installer `appId` for toasts.
- The portable build uses a local data directory when writable, else `%APPDATA%`.
- Release notes and a support link ship in the Den's About view.

## Validation

- Clean Windows 11 VM: install → run → update from N-1 → uninstall, with data kept and deleted variants.
- Windows 10 VM: same core flow (best-effort tier).
- Tampered installer/update is rejected by signature verification.
- Update check is deferred 10 s and does not block startup; a focus session is never interrupted.
- Uninstall removes the login item and program files; user data choice is honored.
- Signature, fuses, and ASAR integrity are asserted in CI and by a release-test script.

## Open items

- O-2: public GitHub Releases vs. object storage + generic provider.
- O-3: Azure Trusted Signing vs. OV/EV certificate and budget.
