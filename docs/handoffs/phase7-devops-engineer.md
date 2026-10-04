# Phase 7 DevOps & Platform Handoff Note

## Overview
Phase 7 implements robust CI/CD pipelines, supply chain security controls, license compliance auditing, automated static analysis with GitHub CodeQL, and automated dependency management with Dependabot for the Unsheet monorepo.

---

## Implemented Components

### 1. License Compliance (`scripts/check-licenses.sh`)
- Audits all workspace dependencies recursively using `pnpm list --json --recursive --long`.
- Validates licenses against permitted list: `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `0BSD`, `Unlicense`, `CC0-1.0`, `Python-2.0`, `CC-BY-4.0`, `Public Domain`.
- Explicitly rejects GPL, AGPL, and LGPL copyleft licenses in production/development dependencies.
- Exits `0` on clean check and `1` on violation.

### 2. SheetJS Supply Chain Verification (`scripts/verify-sheetjs.sh`)
- Validates that SheetJS (`xlsx`) is pinned to the official vendor tarball source (`https://cdn.sheetjs.com/`) in `pnpm-lock.yaml` rather than relying on stale or vulnerable public npm registry packages.

### 3. CI Pipeline (`.github/workflows/ci.yml`)
- Triggers on push and pull requests to `main` / `master`.
- Executes:
  - Monorepo Verification (`pnpm verify`: lint, strict typecheck, tests, build, secret scanning, audit).
  - License Compliance Check (`bash scripts/check-licenses.sh`).
  - SheetJS Supply Chain Check (`bash scripts/verify-sheetjs.sh`).
  - CycloneDX SBOM generation using `@cyclonedx/gh-node-module-generate-sbom` and artifact upload (`upload-artifact`).

### 4. CodeQL Security Scanning (`.github/workflows/codeql.yml`)
- Advanced JavaScript/TypeScript security scanning via GitHub CodeQL on pushes, PRs, and weekly scheduled cron.

### 5. Dependabot Configuration (`.github/dependabot.yml`)
- Configured for weekly `npm` updates (ignoring breaking major version bumps automatically) and monthly `github-actions` updates.

---

## Verification & Status
- Local execution of `pnpm verify`, `bash scripts/check-licenses.sh`, and `bash scripts/verify-sheetjs.sh` all complete successfully with exit code `0`.
