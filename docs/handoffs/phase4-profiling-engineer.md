# Phase 4 Profiling Engineer Handoff

## Overview
Successfully implemented Phase 4 template management and spec remapping in `packages/engine`.

## Implemented Modules
1. **`packages/engine/src/drift/remapping.ts`**:
   - Implemented `applyRemappings(spec: DashboardSpec, remappings: Record<string, string>): DashboardSpec`.
   - Replaces column keys across all 6 widget types (`kpi`, `line`, `bar`, `donut`, `table`, `pivot`), global filters, and filter bindings.
   - Retains valid IDs, layouts, and validated result via `DashboardSpecSchema.parse()`.
   - Exported from `packages/engine/src/drift/index.ts`.

2. **`packages/engine/src/template/`**:
   - **`fingerprint.ts`**: Implemented `computeSchemaFingerprint(profile: SheetProfile): SchemaFingerprint` with deterministic alphabetical sorting by columnKey, canonical string formatting (`${key}:${inferredType}:${required}`), and SHA-256 hashing (`node:crypto`).
   - **`template.ts`**: Implemented `createTemplate` and `validateTemplate` conforming to `TemplateSchema`.
   - **`index.ts`**: Exported all template APIs.

3. **Engine Re-exports (`packages/engine/src/index.ts`)**:
   - Re-exported template APIs.

4. **Tests & Verification**:
   - `packages/engine/test/drift/remapping.test.ts`: Unit tests covering all 6 widget types and filters, plus property-based test with `fast-check`.
   - `packages/engine/test/template/template.test.ts`: Tests for fingerprint computation, creation, and validation.
   - All tests pass (`pnpm --filter @unsheet/engine test`), typecheck and linting are clean.
