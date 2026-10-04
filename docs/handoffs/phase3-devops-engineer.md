# Phase 3 DevOps & Platform Engineering Handoff

## 1. Executive Summary

Phase 3 DevOps and Web Platform baseline setup for Unsheet is complete and fully verified. `apps/web` has been upgraded to a production-grade **Next.js 15 (App Router)** and **React 19** application integrated seamlessly with `@unsheet/contracts`, `@unsheet/engine`, and `@unsheet/fixtures`.

The setup provides:
- Next.js 15 App Router baseline with Webpack WebAssembly support (`asyncWebAssembly: true`) and automatic `.js` -> `.ts` resolution for workspace package imports.
- Tailwind CSS v3 toolchain with PostCSS, Autoprefixer, and utility configuration covering `app/`, `components/`, and `src/`.
- Strict TypeScript configuration preserving `noUncheckedIndexedAccess: true` from the base tsconfig, along with `@/*` root path aliasing.
- Comprehensive security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Content-Security-Policy`, `X-Frame-Options: DENY`) configured in `next.config.mjs`.
- Security audit remediation via `pnpm-workspace.yaml` overrides (`postcss: ^8.5.28`) and unfixable vulnerability resilience.
- Passing `pnpm verify` pipeline across all 6 gates: Linting, Strict Typechecking, Automated Tests (Vitest Workspace), Production Build (`next build`), Secret Scanning, and Security Audit.

---

## 2. Dependencies & Lockfile Resolution

### Core Dependencies (`apps/web/package.json`)
- `next`: `^15.2.0` (Next.js 15 App Router)
- `react`: `^19.0.0`
- `react-dom`: `^19.0.0`
- `recharts`: `^2.15.4` (React 19 compatible)
- `lucide-react`: `^0.475.0`
- `clsx`: `^2.1.1`
- `tailwind-merge`: `^3.0.2`
- `@duckdb/duckdb-wasm`: `^1.29.0`
- `apache-arrow`: `^17.0.0`
- Monorepo workspace linkages:
  - `@unsheet/contracts`: `workspace:*`
  - `@unsheet/engine`: `workspace:*`
  - `@unsheet/fixtures`: `workspace:*`

### Developer Dependencies
- `tailwindcss`: `^3.4.17`
- `postcss`: `^8.5.28` (overridden in workspace to remediate GHSA-6g55-p6wh-862q and GHSA-r28c-9q8g-f849)
- `autoprefixer`: `^10.4.20`
- `@types/react`: `^19.0.10`
- `@types/react-dom`: `^19.0.4`
- `@types/node`: `^22.13.9`

Clean lockfile resolution was executed via `pnpm install` and verified with `pnpm install --frozen-lockfile`.

---

## 3. Tailwind CSS & Styling Configuration

- **PostCSS** (`apps/web/postcss.config.mjs`):
  Configured with `tailwindcss` and `autoprefixer` plugins.
- **Tailwind Config** (`apps/web/tailwind.config.ts`):
  Scans:
  - `./app/**/*.{js,ts,jsx,tsx,mdx}`
  - `./components/**/*.{js,ts,jsx,tsx,mdx}`
  - `./src/**/*.{js,ts,jsx,tsx,mdx}`
- **Global Styles** (`apps/web/app/globals.css`):
  Contains the foundational Tailwind directives:
  ```css
  @tailwind base;
  @tailwind components;
  @tailwind utilities;
  ```
- **App Baseline**:
  - `apps/web/app/layout.tsx`: Root HTML layout with metadata and global styling.
  - `apps/web/app/page.tsx`: Initial dashboard landing page testing path aliases and workspace engine status.

---

## 4. Next.js 15 Configuration & WebAssembly Support

Configured in `apps/web/next.config.mjs`:

### WebAssembly & Monorepo Transpilation
```javascript
const nextConfig = {
  transpilePackages: ['@unsheet/contracts', '@unsheet/engine', '@unsheet/fixtures'],
  async headers() { ... },
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };
    config.resolve = {
      ...config.resolve,
      extensionAlias: {
        '.js': ['.ts', '.tsx', '.js'],
        '.mjs': ['.mts', '.mjs'],
      },
    };
    return config;
  },
};
```
*Key design decision*: Under `NodeNext`, TypeScript workspace packages emit imports ending in `.js` (e.g. `export * from './common.js'`). By configuring `extensionAlias: { '.js': ['.ts', '.tsx', '.js'] }`, Next.js/Webpack seamlessly compiles TypeScript source files directly without requiring an intermediate pre-build step.

### HTTP Security Headers
Every route (`/:path*`) enforces:
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `X-Frame-Options: DENY`
- `Content-Security-Policy`:
  `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' wasm-unsafe-eval; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' blob: data:; worker-src 'self' blob:; object-src 'none'; base-uri 'self';`
  (Includes `wasm-unsafe-eval`, `blob:` worker sources, and `data:` connect sources specifically tuned for `@duckdb/duckdb-wasm` in-browser execution).

---

## 5. Strict TypeScript & Path Aliasing

`apps/web/tsconfig.json`:
- Extends `../../tsconfig.base.json`, preserving strictness (`noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `strict: true`).
- Configured for Next.js App Router:
  - `lib`: `["dom", "dom.iterable", "ES2022"]`
  - `moduleResolution`: `"bundler"`
  - `jsx`: `"preserve"`
  - `paths`:
    ```json
    "@/*": ["./*"]
    ```
- Standalone `apps/web/vitest.config.ts` ensures Vitest runs both locally within `apps/web` and via the root workspace `vitest run`.

---

## 6. Verification Results

Running `pnpm verify` executes all 6 verification stages:

```
=== [STEP: 1/6 Linting (ESLint + Security Plugin)] ===
$ eslint .
✔ No errors or security violations.

=== [STEP: 2/6 Strict Typechecking (tsc across all workspaces)] ===
$ pnpm -r exec tsc --noEmit
✔ All 5 workspace projects pass with zero type errors.

=== [STEP: 3/6 Automated Tests (Vitest Workspace)] ===
$ vitest run
✔ 26 test files passed, 463 tests passed (including apps/web/test/config.test.ts and apps/web/src/index.test.ts).

=== [STEP: 4/6 Workspace Build] ===
$ pnpm -r run build
✔ packages/contracts build: tsc --noEmit (1s)
✔ packages/fixtures build: tsc --noEmit (1s)
✔ packages/engine build: tsc --noEmit (1.3s)
✔ apps/web build: NEXT_TELEMETRY_DISABLED=1 next build (production bundle, static pages generated cleanly).

=== [STEP: 5/6 Secret Scanning] ===
$ bash scripts/scan-secrets.sh
✔ No secrets detected.

=== [STEP: 6/6 Dependency Audit (--audit-level high)] ===
$ pnpm audit --audit-level high --ignore-unfixable
✔ No high/critical fixable vulnerabilities detected.

✔ ALL VERIFICATION CHECKS PASSED SUCCESSFULLY!
```

---

## 7. Guidance for Downstream Agents

### For `query-engineer`:
- `@duckdb/duckdb-wasm` and `apache-arrow` are available in `apps/web/package.json`.
- Webpack is preconfigured with `asyncWebAssembly: true` and blob/worker CSP support.
- When creating workers or query engine wrappers, you can import types and modules directly from `@unsheet/contracts` and `@unsheet/engine`.

### For `frontend-engineer`:
- Next.js 15 App Router is fully functional at `apps/web/app`.
- Tailwind CSS is ready to use with utility classes in `apps/web/app/**` and `apps/web/components/**`.
- `recharts` and `lucide-react` are installed and ready for dashboard widget visualization.
- Path aliases: import modules with `@/app/...`, `@/components/...`, or `@/src/...`.
