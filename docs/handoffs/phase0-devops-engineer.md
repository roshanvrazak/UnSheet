# Phase 0 DevOps & Platform Engineering Handoff

## 1. Executive Summary

Phase 0 DevOps and Platform foundation setup for the Unsheet monorepo is complete and verified. The monorepo uses `pnpm` workspaces, strict TypeScript configuration across all packages, Vitest multi-project testing, ESLint with AST-level XSS prevention and security rules, automated secret scanning with fallback capability, security audit gates, and GitHub Actions CI workflow executing unified verification via `pnpm verify`.

---

## 2. Monorepo Layout & Workspace Configuration

### Workspace Topology
Configured in `pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
  - 'apps/*'

allowBuilds:
  esbuild: true

onlyBuiltDependencies:
  - esbuild
```

### Workspace Packages & Initial State
- `packages/contracts` (`@unsheet/contracts`): Authoritative contracts, Zod schemas, and data exchange models.
- `packages/engine` (`@unsheet/engine`): Pure browser & Node engine for ingestion, normalization, profiling, and DuckDB queries.
- `packages/fixtures` (`@unsheet/fixtures`): Golden test workbooks, synthetic spreadsheet generators, and schema fixture generators.
- `apps/web` (`@unsheet/web`): Modern Next.js application workspace.

Every package includes its own `package.json`, `tsconfig.json`, `src/index.ts`, and passing Vitest test `src/index.test.ts`.

---

## 3. Strict TypeScript Configuration

### Base Configuration (`tsconfig.base.json`)
Enforces maximum strictness across all packages and apps:
- `strict: true`
- `noUncheckedIndexedAccess: true` (prevents unchecked array/record access)
- `exactOptionalPropertyTypes: true` (prevents undefined confusion on optional fields)
- `noImplicitOverride: true`
- `noFallthroughCasesInSwitch: true`
- `forceConsistentCasingInFileNames: true`
- `target: "ES2022"`, `module: "NodeNext"`, `moduleResolution: "NodeNext"`

### Workspace Inheritance
Each package extends `../../tsconfig.base.json` with localized source/output paths. Typechecking across all packages is executed via:
```bash
pnpm -r exec tsc --noEmit
```

---

## 4. Linting & Static Security Gates

### ESLint Flat Configuration (`eslint.config.mjs`)
- Configured with `@eslint/js`, `typescript-eslint`, and `eslint-plugin-security`.
- Strict AST-based security rules enforcing XSS prevention:
  - Disallows `dangerouslySetInnerHTML`.
  - Disallows property assignments to `innerHTML` and `outerHTML`.
  - Disallows `no-eval`, `no-implied-eval`, `no-new-func`.

---

## 5. Automated Secret Scanning

### Configuration & Tooling
- `.gitleaks.toml`: Gitleaks configuration with explicit allowlists and patterns for high-entropy secrets, generic API keys, and private keys.
- `scripts/scan-secrets.sh`: Dual-engine scanner:
  - Automatically executes `gitleaks detect` if the `gitleaks` CLI is available in the environment.
  - Falls back to a built-in Node.js regex scanner checking for AWS keys, GitHub tokens, Slack tokens, private keys, and generic API keys across tracked repository files (ignoring build outputs and lockfiles).

---

## 6. Verification Pipeline (`pnpm verify`)

The central verification pipeline is implemented in `scripts/verify.sh` and exposed as `pnpm verify`:

```
pnpm verify
├── Step 1: Linting (pnpm run lint -> eslint .)
├── Step 2: Strict Typechecking (pnpm run typecheck -> pnpm -r exec tsc --noEmit)
├── Step 3: Automated Tests (pnpm run test -> vitest run across all packages)
├── Step 4: Workspace Build (pnpm run build -> pnpm -r run build)
├── Step 5: Secret Scanning (pnpm run scan-secrets -> bash scripts/scan-secrets.sh)
└── Step 6: Security Audit (pnpm run audit -> pnpm audit --audit-level high)
```

Execution is gated with `set -euo pipefail`. Any step failure immediately halts the process with a non-zero exit code.

---

## 7. GitHub Actions CI Workflow

Defined in `.github/workflows/ci.yml`:
- Runs on all pushes and pull requests to `main`.
- Sets up `pnpm` (v11) and `Node.js` (v22).
- Executes `pnpm install --frozen-lockfile`.
- Executes `pnpm verify`.

---

## 8. SheetJS Supply Chain Policy Note
As required by specification and ADR-003:
- SheetJS (`xlsx`) must NOT be installed from the unmaintained public npm registry.
- When ingested by `@unsheet/engine`, it must be pinned to the official vendor tarball:
  `"xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz"`

---

## 9. Verification & Acceptance Output
```
$ pnpm verify
Starting Unsheet Workspace Verification (pnpm verify)...

=== [STEP: 1/6 Linting (ESLint + Security Plugin)] ===
$ eslint .

=== [STEP: 2/6 Strict Typechecking (tsc across all workspaces)] ===
$ pnpm -r exec tsc --noEmit

=== [STEP: 3/6 Automated Tests (Vitest Workspace)] ===
$ vitest run
 Test Files  4 passed (4)
      Tests  5 passed (5)

=== [STEP: 4/6 Workspace Build] ===
$ pnpm -r run build
Scope: 4 of 5 workspace projects
packages/contracts build$ tsc --noEmit: Done
packages/engine build$ tsc --noEmit: Done
packages/fixtures build$ tsc --noEmit: Done
apps/web build$ tsc --noEmit: Done

=== [STEP: 5/6 Secret Scanning] ===
$ bash scripts/scan-secrets.sh
✔ Fallback secret scanner: No secrets detected.

=== [STEP: 6/6 Dependency Audit (--audit-level high)] ===
$ pnpm audit --audit-level high
2 vulnerabilities found
Severity: 2 moderate

✔ ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!
```
Status: **PASSED (Exit code 0)**.
