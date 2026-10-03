# Task Brief: Phase 0 - Monorepo Tooling, CI/CD & Verification

## Agent
`devops-engineer`

## Goal
Set up the pnpm monorepo root structure, TypeScript configurations, Vitest workspace, ESLint security rules, gitleaks config, GitHub Actions CI workflow, and the central `pnpm verify` script.

## Owned Paths
- `package.json`
- `pnpm-workspace.yaml`
- `tsconfig.json`
- `tsconfig.base.json`
- `vitest.workspace.ts`
- `vitest.config.ts`
- `eslint.config.mjs`
- `.gitleaks.toml`
- `.gitignore`
- `.github/workflows/**`
- `scripts/**`

## Specifications & Requirements
1. Monorepo structure using pnpm workspace (`packages/*`, `apps/*`).
2. Strict TypeScript base config (`strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`).
3. Wire packages: `packages/contracts`, `packages/engine`, `packages/fixtures`, `apps/web`.
4. Install and configure Vitest workspace across packages.
5. Create `scripts/verify.sh` and npm script `pnpm verify`:
   - Runs linting (ESLint with security plugin)
   - Runs typechecking (`tsc --noEmit` across all workspaces)
   - Runs unit, property, and contract tests (`vitest run`)
   - Runs build (`pnpm --filter ... build`)
   - Runs secrets check (gitleaks or regex scanner fallback script if gitleaks binary is not installed)
   - Runs audit (`pnpm audit --audit-level high`)
6. GitHub Actions CI workflow in `.github/workflows/ci.yml` running the exact same `pnpm verify` command.
7. SheetJS installation rule: SheetJS must be pinned to the vendor tarball from `cdn.sheetjs.com`.

## Acceptance Criteria
- `pnpm verify` exits with code 0 on the initial repository state.
- Package builds and tests can be run consistently across the workspace.
- Secrets scanning and audit gates are operational.

## Handoff
Write `docs/handoffs/phase0-devops-engineer.md` detailing setup, scripts, and verification instructions.
