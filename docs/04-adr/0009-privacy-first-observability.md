# ADR-0009: Local-first observability, no telemetry by default

| Field | Value |
| --- | --- |
| Status | Accepted |
| Date | 2026-10-19 |
| Deciders | Product, Engineering |
| Related | [Security & privacy](../02-architecture/security-and-privacy.md#6-privacy-posture) · [Data & persistence](../02-architecture/data-and-persistence.md#8-diagnostics-and-event-log) · [PRD](../01-product/prd.md#10-success-metrics-and-validation) |

## Context

Mochi handles focus habits and desktop behavior. Even without content, a stream of usage events is sensitive. The product promise is "no account, no cloud, no surveillance," and the target users are explicitly tired of apps that monetize attention.

At the same time, a desktop app needs observability: crashes, animation failures, update errors, and performance regressions are hard to diagnose from a bug report alone. The team is small and cannot staff a privacy/legal program for behavioral analytics.

## Decision

Ship v1 with **local-only observability**:

- Structured logs (`electron-log`) rotated at 5 MB × 7 files.
- Optional local event log (30 days / 5 MB) with allowlisted, non-content fields.
- In-memory performance and reliability counters exposed via `diagnostics:getInfo`.
- A user-initiated **export** of state/logs/diagnostics with a preview before saving. No upload endpoint.
- **No analytics SDK, no crash-reporting SDK, no remote logging, no advertising identifiers.**
- Product metrics are gathered from a consented beta cohort and from local exports users choose to share, not from silent production telemetry.
- If a crash-reporting service is added later, it must be opt-in, preview the payload, redact paths/content, and be documented in a new ADR.

## Alternatives considered

### Sentry (or equivalent) from day one, on by default

- **Pros:** fastest debugging, stack traces, release health.
- **Cons:** contradicts the privacy promise; requires a DSN and network egress; payload review and scrubbing; GDPR/DPA work; users may not expect it.
- **Verdict:** rejected for v1. Revisit as an explicit opt-in after launch if support volume justifies it.

### Anonymous product analytics (e.g., PostHog/Amplitude)

- **Pros:** retention/activation dashboards.
- **Cons:** behavioral event streams are exactly what the product promises not to collect; consent banner/compliance overhead; small sample size makes dashboards noisy.
- **Verdict:** rejected. Beta research + local stats are enough for v1 decisions.

### Fully silent local logs only (no export)

- **Pros:** maximum privacy.
- **Cons:** support cannot diagnose anything; users cannot help even if they want to.
- **Verdict:** too little. The export is explicit and user-controlled, which preserves trust.

### Opt-in telemetry at install

- **Pros:** better data than nothing.
- **Cons:** most users ignore toggles, so the sample is biased; still requires infrastructure and policy.
- **Verdict:** defer; do not build infrastructure before there is evidence it is needed.

## Consequences

### Positive

- The privacy claim is simple and verifiable with a network trace.
- No consent banner, no cookie policy, no data processor agreements for v1.
- Smaller attack surface and no third-party SDK in the renderer.
- Users can inspect exactly what a diagnostics export contains before sharing.

### Negative / accepted costs

- We will not see most crashes or performance issues in the wild; beta and support exports are the signal.
- Triage is slower; bug reports need logs attached voluntarily.
- Release health is qualitative and may miss device-specific issues.
- The "no telemetry" stance may be used as a marketing claim, which raises the cost of ever changing it; a future change needs a prominent opt-in and a new ADR, not a quiet policy update.

### Neutral / follow-ups

- The event log is off by default except for core lifecycle/crash counters; enabling diagnostics is a user action.
- Exports include `installId` for support correlation; the preview labels it and the user can redact it.
- If opt-in crash reporting is added: use a dedicated endpoint, explicit consent, a payload preview, path minimization, and a retention policy ≤ 30 days.

## Validation

- A 30-minute session network trace shows only the update metadata host.
- Diagnostics export preview matches the saved file; no content, window titles, keystrokes, or environment variables.
- Logs rotate and contain no PII in a review checklist.
- The privacy policy and in-app data inventory match the shipped behavior.
- Beta metrics are collected only through consented exports/interviews.
