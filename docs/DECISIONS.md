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
