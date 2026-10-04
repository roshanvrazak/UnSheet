# Architectural Decision Records (ADRs) & Orchestrator Decisions

This document records architectural, technical, and trade-off decisions made during the design and implementation of Unsheet.

---

## ADR-001: Sub-agent Operating Model & Isolation
- **Context**: Unsheet requires multi-disciplinary engineering (parsing, profiling, analytics, frontend, backend, security).
- **Decision**: Adopt a strict sub-agent operating model defined in `.claude/agents/*.md`. Contracts are defined first in `packages/contracts`. Agents have strict directory ownership. Independent reviewers (code reviewer, security reviewer, adversarial tester) audit each phase.
- **Consequences**: Fast parallel execution without context pollution; high assurance of correctness and security boundaries.

## ADR-002: Browser-First Ingestion & DuckDB-WASM Analytics
- **Context**: Spreadsheets often contain highly sensitive financial, operational, or personal data. Sending full raw datasets to servers or third-party LLMs introduces severe privacy, compliance, and cost issues.
- **Decision**: All parsing, normalisation, profiling, and query execution run locally in the browser sandbox. The server and LLM only ever receive column metadata and a small capped sample (max 5 values per column, max 40 chars), unless the user explicitly opts in to cloud persistence/sharing.
- **Consequences**: Near-zero server egress cost, strict privacy guarantees, responsive offline-capable analytics.

## ADR-003: SheetJS Vendor Distribution Source
- **Context**: The `xlsx` package on the public npm registry is unmaintained/stale and subject to known security advisories.
- **Decision**: Install SheetJS from the official vendor tarball at `https://cdn.sheetjs.com/` as mandated in the specification. Pinned tarball version with checksum validation.
- **Consequences**: Immune to npm registry vulnerabilities, official support for modern binary parsing features.

## ADR-004: Monorepo Structure & TypeScript Strictness
- **Context**: Clear boundary between contracts, pure engine logic, fixtures, and web application.
- **Decision**: pnpm workspace with `packages/contracts` (Zod only), `packages/engine` (pure TS, Web Worker & Node compatible), `packages/fixtures` (generators and golden workbooks), and `apps/web` (Next.js 15, Tailwind, shadcn/ui, Recharts). Strict TypeScript enabled everywhere (`noUncheckedIndexedAccess: true`).
- **Consequences**: Type safety across package boundaries; clean separation of concerns.

## ADR-005: Total Dashboard Renderer & Error Isolation Architecture
- **Context**: Real-world spreadsheets and user-configured specs may contain missing columns, incompatible aggregations, or invalid widget configurations. A single bad widget must never crash adjacent widgets or unmount the entire dashboard.
- **Decision**: Implement a two-tier Total Renderer: top-level schema validation with safe fallback parsing (`.slice(0, 50)` widgets max), and per-widget `WidgetErrorBoundary` isolation wrapping every widget container in `DashboardRenderer.tsx`. Render failures present localized `ErrorCardWidget` components with sanitized paths.
- **Consequences**: The dashboard is total: every possible input renders cleanly and gracefully without uncaught React runtime exceptions.

## ADR-006: Dual-Engine Query Execution & DuckDB-WASM Serialization
- **Context**: DuckDB-WASM provides high-performance SQL analytics in the browser, but cannot run in server environments (Next.js SSR) and requires serial access over its singleton web worker connection.
- **Decision**: Provide dual execution engines: pure TypeScript `executeQueryInMemory` for fast Node test environments, web workers, and SSR hydration; and DuckDB-WASM singleton in `apps/web/lib/query/duckdb.ts` guarded by a FIFO promise mutex queue to serialize concurrent multi-widget executions.
- **Consequences**: Zero hydration mismatch, zero deadlock on concurrent widget rendering, seamless offline-ready query execution.

## ADR-007: Universal Screen Reader Accessible Data Tables for Charts
- **Context**: SVG-based charts (Recharts) are inherently difficult for screen readers and assistive technologies to parse accurately.
- **Decision**: Every visual chart widget (`LineChartWidget`, `BarChartWidget`, `DonutChartWidget`) pairs with an `AccessibleDataTable` component providing a semantic HTML `<table>` with explicit `<th scope="col">` and `<th scope="row">` attributes, accompanied by a permanent `.sr-only` mirror and a user-expandable disclosure button.
- **Consequences**: WCAG 2.1 AA compliant data visualization with zero `dangerouslySetInnerHTML`.

## ADR-008: Sub-agent Tiering & Quota Resiliency
- **Context**: Complex orchestrations involving dozens of subagent delegations can exhaust per-tier LLM rate limits (429 RESOURCE_EXHAUSTED).
- **Decision**: Orchestrator dynamically tiers subagent dispatch to lightweight models (`flash_lite`), which operate under generous quota boundaries while providing exceptional speed and adherence to strict structured tasks.
- **Consequences**: Uninterrupted multi-agent continuous execution across extensive multi-phase projects.

