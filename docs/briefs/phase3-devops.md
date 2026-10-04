# Phase 3 Task Brief: DevOps & Dependencies Setup

## Agent
`devops-engineer`

## Branch
`agent/devops/phase3-setup`

## Goal
Set up dependencies, build configuration, Tailwind CSS, and Next.js 15 baseline in `apps/web/` so that `query-engineer` and `frontend-engineer` can build the query engine and generic dashboard renderer without dependency or tooling conflicts.

## Owned Paths
- `apps/web/package.json`
- `apps/web/tsconfig.json`
- `apps/web/next.config.ts` (or `next.config.mjs`)
- `apps/web/tailwind.config.ts` (or `tailwind.config.js`)
- `apps/web/postcss.config.mjs` (or `postcss.config.js`)
- `apps/web/app/**` (initial root layout and page placeholder)
- `apps/web/src/**`
- `package.json` (root if devDependencies are needed)
- `pnpm-lock.yaml`

## Acceptance Criteria
1. `apps/web/package.json` includes:
   - `next`: `^15`
   - `react`: `^19` (or `^18.3.1` compatible with Next 15 and Recharts)
   - `react-dom`
   - `recharts`
   - `lucide-react`
   - `clsx`, `tailwind-merge`
   - `@duckdb/duckdb-wasm`, `apache-arrow`
   - Dev dependencies: `tailwindcss`, `postcss`, `autoprefixer`, `@types/react`, `@types/react-dom`, `@types/node`
2. Next.js 15 App Router configuration:
   - Clean `next.config.ts` or `next.config.mjs` configured with security headers:
     - `X-Content-Type-Options: nosniff`
     - `Referrer-Policy: strict-origin-when-cross-origin`
     - `Permissions-Policy: camera=(), microphone=(), geolocation=()`
     - `Content-Security-Policy` (or placeholder for review)
   - Proper webpack/turbopack config allowing `.wasm` files if needed.
3. Tailwind CSS setup:
   - `postcss.config.mjs`
   - `tailwind.config.ts` scanning `apps/web/{app,components}/**/*.{ts,tsx}`
   - `apps/web/app/globals.css` with Tailwind directives (`@tailwind base; @tailwind components; @tailwind utilities;`)
4. Verification:
   - `pnpm install` resolves dependencies cleanly with no lockfile conflicts.
   - `pnpm --filter @unsheet/web run build` succeeds (`next build` or `tsc --noEmit`).
   - `pnpm verify` passes across the monorepo.
5. Handoff note at `docs/handoffs/phase3-devops-engineer.md`.
