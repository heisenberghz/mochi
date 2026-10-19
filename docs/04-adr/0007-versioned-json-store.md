# ADR-0007: Versioned JSON document store with atomic writes

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-10-19 |
| Deciders | Engineering |
| Related | [Data & persistence](../02-architecture/data-and-persistence.md) · [Focus engine](../02-architecture/focus-engine.md) |

## Context

Mochi persists settings, pet progress, focus configuration, at most a few years of daily aggregates, placement, and a tiny in-progress timer checkpoint. The data volume is small (< 250 KB), there is exactly one writer (the main process), and the app is single-instance. Durability and upgrade safety matter more than query performance.

The alternatives have different costs: a native SQLite module adds ABI/rebuild/update risk; `electron-store` is convenient but does not provide checksums or a migration protocol by itself; renderer storage (localStorage/IndexedDB) is tied to a webContents and is a poor fit for tray/timer authority.

## Decision

Implement a **custom versioned JSON document store** in main:

- A single `state.json` with an envelope (`format`, `checksum`, `payload`), Zod validation, and a sequential migration chain.
- Atomic writes via unique temp file + `fsync` + replace, with a `state.bak` last-known-good backup.
- Quarantine invalid files rather than deleting them; recover from backup; show a one-time explanation.
- A separate tiny `runtime.json` checkpoint every 2 s while a focus phase runs, bounding crash loss to ≤ 2 s.
- Debounced writes (500 ms, max 2 s) with immediate flushes on focus commands, hide, suspend, and quit.
- No native dependencies.

## Alternatives considered

### SQLite (`better-sqlite3` or `node:sqlite`)

- **Pros:** real queries, transactions, robust concurrency, compact history.
- **Cons:** native ABI rebuilds for each Electron upgrade; packaging/CI complexity; unnecessary for < 1 MB; `node:sqlite` is still experimental/changing; aggregates are simple maps.
- **Verdict:** technically strong but overkill for v1. Revisit if history grows into millions of events or sync arrives.

### `electron-store`

- **Pros:** small API, JSON, atomic-ish writes, schema support with JSON Schema.
- **Cons:** no checksum/recovery protocol, no migration chain, ESM packaging friction at v12, and we would wrap it with most of the code we need anyway.
- **Verdict:** rejected; too little control for the durability guarantees.

### `lowdb` / plain JSON

- **Pros:** minimal.
- **Cons:** no atomicity, no validation, easy to corrupt, no migrations.
- **Verdict:** rejected.

### IndexedDB / localStorage in the renderer

- **Pros:** no filesystem code.
- **Cons:** tied to a renderer; tray/timer live in main; clearing site data loses progress; no atomic multi-section writes; poor recovery tooling.
- **Verdict:** rejected.

## Consequences

### Positive

- No native modules; Electron upgrades and ARM64 packaging are simpler.
- The persistence code is fully unit-testable with a temp directory and injected failures.
- Checksums catch truncation/partial writes that still parse as JSON.
- Migrations are explicit, sequential, and fixture-tested.
- The tiny checkpoint limits crash loss without writing the full document every second.
- Users can inspect, export, and back up a readable file.

### Negative / accepted costs

- We own atomic-write, backup, migration, and corruption-recovery code (~300–500 lines plus tests).
- The entire document is rewritten on change; acceptable at < 250 KB but must stay bounded.
- No ad-hoc queries; aggregates are computed in memory and capped.
- Windows file locking (antivirus/indexer) can cause `EPERM`; the writer needs retries/backoff.
- A malicious local process can edit the file; this is not a security boundary.

### Neutral / follow-ups

- Daily aggregates are retained indefinitely but zero-value entries older than 2 years are pruned.
- Raw recent sessions are capped at 30; the event log is capped at 30 days/5 MB.
- If a future schema adds heavy history, migrate to SQLite with an export/import path and a new ADR.

## Validation

- Fault injection at every write step leaves a loadable previous state.
- Truncation/bit-flip tests recover from backup or quarantine with no crash.
- Migration fixtures for every schema version; double-run is a no-op.
- Kill -9 during focus restores within ± 2 s and never double-awards.
- 1,000 rapid changes produce bounded writes and a consistent final file.
- A 3-year simulated history stays < 250 KB and loads in < 15 ms.
