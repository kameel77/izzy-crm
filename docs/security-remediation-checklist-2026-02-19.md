# Security Remediation Checklist — 2026-02-19

## Scope
Dependency and secret hardening for `izzy-crm` after nightly security alert.

## Baseline
- Before: **55** vulnerabilities (47 high, 7 moderate, 1 low)
- After `npm audit fix`: **23** vulnerabilities (18 high, 5 moderate)

## Action Plan (owners + due dates)

| Item | Owner | Due date | Status |
|---|---|---:|---|
| Merge lockfile-based dependency updates from this branch | Flash | 2026-02-19 | ✅ done on branch |
| Validate app build on updated lockfile (`npm run build`) | Flash | 2026-02-19 | ✅ passed |
| Patch remaining runtime security issues in mail ingestion chain (`imap-simple`/`imap`/`utf7`/`semver`) | Backend owner | 2026-02-20 | ⏳ planned |
| Decide migration path for IMAP stack (upgrade-safe path or replacement with `imapflow`) | Tech lead | 2026-02-20 | ⏳ planned |
| Patch remaining frontend router issue (`react-router` advisory) by explicit minor upgrade and regression test for redirects | Frontend owner | 2026-02-20 | ⏳ planned |
| Resolve remaining moderate advisories in dev toolchain (Vite/Vitest/ESLint path) | Platform owner | 2026-02-21 | ⏳ planned |
| Add CI gate: fail PR if new high/critical vulnerabilities are introduced (`npm audit --audit-level=high`) | Platform owner | 2026-02-21 | ⏳ planned |
| Rotate default credentials found in local compose/seed templates and move to env-only placeholders | Backend owner | 2026-02-19 | ⏳ planned |

## Notes
- This branch intentionally ships non-breaking security fixes first (lockfile updates).
- Remaining highs include packages that likely require controlled code-level migration (mail ingestion stack) rather than blind force-upgrade.
