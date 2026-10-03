# Unsheet Architecture Specification

## 1. System Topology & Workspace Structure

Unsheet is architected as a modular TypeScript monorepo managed via `pnpm` workspaces. The architecture strictly decouples contracts, pure analytical engine logic, test fixtures, and the Next.js presentation tier.

```
Unsheet Monorepo
├── packages/
│   ├── contracts/   (@unsheet/contracts) ── Authoritative Zod schemas & TypeScript types (Zero external dependencies)
│   ├── engine/      (@unsheet/engine)    ── Pure TS parsing, normalization, profiling, DuckDB abstraction (Web Worker & Node)
│   └── fixtures/    (@unsheet/fixtures)  ── Golden workbooks, synthetic sheet generators, adversarial test vectors
└── apps/
    └── web/         (@unsheet/web)       ── Next.js 15 App Router, React 19, Tailwind CSS, shadcn/ui, Recharts
```

### Module Responsibilities & Boundary Enforcement
1. **`@unsheet/contracts`**:
   - Single source of truth for all domain entities (`WorkbookModel`, `ColumnProfile`, `DashboardSpec`, `Template`, `DriftReport`, `QueryPlan`, API payloads).
   - Zero runtime dependencies other than `zod`.
   - Strict TypeScript with `noUncheckedIndexedAccess: true`.
2. **`@unsheet/engine`**:
   - Platform-agnostic (pure TypeScript, zero DOM dependencies).
   - Executes in browser Web Workers for background data processing, or in Node.js for CLI/testing.
   - Houses the SheetJS ingestion parser, normalizer, statistical profiler, heuristic spec generator, drift engine, and DuckDB-WASM query planner.
3. **`@unsheet/fixtures`**:
   - Provides canonical golden spreadsheets (financial models, sales pipelines, messy headers, merged cells) and fuzzing generators.
4. **`@unsheet/web`**:
   - Next.js 15 App Router application providing the UI, total renderer, WYSIWYG editor, state management, and backend API routes.
   - Enforces strict Content Security Policy (CSP), zero secrets in client bundles, and AST-level XSS prevention.

---

## 2. High-Level System Architecture Diagram

```mermaid
flowchart TB
    subgraph ClientBrowser["Client Browser Sandbox (Local-First)"]
        subgraph MainThread["UI Main Thread (React 19 / Next.js)"]
            DropZone["File Ingestion & Dropzone"]
            StateMgr["Dashboard State Store (Zustand)"]
            Renderer["Total Dashboard Renderer (Recharts + shadcn/ui)"]
            Editor["WYSIWYG Spec Editor"]
            DriftModal["Drift Remapping UI"]
            AskUI["Ask-Your-Data Interface"]
        end

        subgraph WorkerThread["Background Web Worker (@unsheet/engine)"]
            Parser["SheetJS Safe Ingestion Parser\n(Pinned Vendor Tarball)"]
            Normalizer["Table & Header Normalizer\n(Prototype-Safe Keys)"]
            Profiler["Column Profiler & Type Inference"]
            SpecGen["Deterministic Spec Generator"]
            DriftEngine["Schema Drift Detection Engine"]
            DuckDB["DuckDB-WASM In-Memory Database"]
        end

        LocalStore[("Browser IndexedDB\n(Local Specs & Templates)")]
    end

    subgraph CloudServices["Optional Cloud Services (Metadata Only)"]
        subgraph NextServer["Next.js App Router Backend"]
            APIGateway["API Gateway & Rate Limiter"]
            LLMOrchestrator["LLM Orchestrator (Vercel AI SDK)"]
        end

        LLMProvider["External LLM Provider\n(Anthropic / OpenAI)\nReceives Capped Metadata ONLY"]
        SupabaseDB[("Supabase DB & Storage\n(RLS Deny-by-Default,\n>=128-bit Share Tokens)")]
    end

    %% Client Interactions
    DropZone -- "Raw File Buffer" --> Parser
    Parser --> Normalizer --> Profiler
    Profiler --> SpecGen
    Profiler -. "Column Profiles" .-> StateMgr
    SpecGen -. "DashboardSpec" .-> StateMgr
    Normalizer -- "Clean Rows" --> DuckDB

    StateMgr --> Renderer
    StateMgr <--> Editor
    StateMgr <--> DriftModal
    StateMgr <--> LocalStore

    Renderer -- "QueryPlan" --> DuckDB
    DuckDB -- "QueryResult" --> Renderer

    %% Cloud Interactions (Guarded Metadata Only)
    AskUI -- "Prompt + Capped Profiles (<=5 items)" --> APIGateway
    Editor -- "Refinement Prompt + Capped Profiles" --> APIGateway
    APIGateway --> LLMOrchestrator
    LLMOrchestrator -- "Sanitized Prompt" --> LLMProvider
    LLMProvider -- "Validated JSON" --> LLMOrchestrator
    LLMOrchestrator -- "QueryPlan / Updated Spec" --> StateMgr

    StateMgr -- "Publish (Spec + Unguessable Token)" --> APIGateway
    APIGateway --> SupabaseDB
```

---

## 3. Data Isolation Model & Privacy Boundary

Unsheet strictly separates sensitive raw data from the cloud boundary. The architecture guarantees that raw user data is processed entirely client-side.

```mermaid
flowchart LR
    subgraph ProtectedBoundary["Private Local Browser Boundary (Zero Egress)"]
        RawFile["Raw Spreadsheet (.xlsx, .csv)"]
        RawRows["Unfiltered Cell Rows & Values"]
        Formulas["Pre-computed Formula Cache"]
        DuckDBInstance["DuckDB-WASM In-Memory Tables"]
    end

    subgraph SanitizationGate["Sanitization & Capping Gateway (@unsheet/contracts)"]
        Sampler["Sample Values Capped\n(Max 5 items, <=40 chars,\nFormula Triggers Stripped)"]
        StatsOnly["Aggregated Statistical Metrics\n(Min, Max, Distinct, Nulls)"]
        SchemaDef["Column Names & Types"]
    end

    subgraph ExternalCloud["External Cloud Boundary"]
        ServerAPI["Next.js Server API"]
        LLM["Third-Party LLM"]
    end

    RawFile --> DuckDBInstance
    RawRows --> DuckDBInstance
    Formulas --> DuckDBInstance
    DuckDBInstance --> Sampler
    DuckDBInstance --> StatsOnly
    DuckDBInstance --> SchemaDef

    Sampler --> ServerAPI
    StatsOnly --> ServerAPI
    SchemaDef --> ServerAPI
    ServerAPI --> LLM

    style ProtectedBoundary fill:#1a2332,stroke:#00b4d8,stroke-width:2px,color:#ffffff
    style SanitizationGate fill:#2b2d42,stroke:#ffd166,stroke-width:2px,color:#ffffff
    style ExternalCloud fill:#3d0c11,stroke:#ef476f,stroke-width:2px,color:#ffffff
```

---

## 4. Ingestion & Profiling Dataflow

The ingestion process runs inside a Web Worker to ensure 60 FPS UI responsiveness on the main thread:

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Main Thread (UI)
    participant Worker as Engine Web Worker
    participant DuckDB as DuckDB-WASM
    participant State as Zustand Store

    User->>UI: Drops spreadsheet (.xlsx, .csv)
    UI->>UI: Check file size (<= 50MB)
    UI->>Worker: postMessage(PARSE_WORKBOOK, ArrayBuffer)

    Worker->>Worker: Zip-bomb check (Ratio < 100:1, Uncompressed < 200MB)
    Worker->>Worker: SheetJS read(buffer, { dense: true, cellFormula: false })
    Worker->>Worker: Detect table boundaries & strip blank/spacer rows
    Worker->>Worker: Detect headers & sanitize column keys (SafeIdentifier)
    Worker->>Worker: Produce SheetModel & clean tabular rows

    Worker->>DuckDB: CREATE TABLE sheet_data AS SELECT * FROM arrow/rows
    Worker->>Worker: Profile columns (Type inference, semantic roles, stats)
    Worker->>Worker: Extract capped sample values (max 5, <=40 chars)
    Worker->>Worker: Generate deterministic DashboardSpec (SpecGen rules)
    Worker->>Worker: Validate DashboardSpecSchema (@unsheet/contracts)

    Worker->>UI: postMessage(INGEST_COMPLETE, { SheetModel, ColumnProfiles, DashboardSpec })
    UI->>State: setWorkbook(), setProfiles(), setSpec()
    UI->>User: Renders interactive dashboard
```

---

## 5. Query Execution & Interactive Filtering Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant FilterUI as Global Filter Bar
    participant State as UI State
    participant DuckDB as DuckDB-WASM Worker
    participant Widget as Chart / Table Widget

    User->>FilterUI: Selects Filter (e.g. Region = 'EMEA', Year = 2026)
    FilterUI->>State: updateActiveFilters(filters)
    State->>Widget: Re-evaluate widget query plan

    Widget->>Widget: Compile QueryPlan (Dimensions, Measures, FilterPredicates)
    Widget->>DuckDB: executeQueryPlan(QueryPlan)

    DuckDB->>DuckDB: Validate table & column allowlist
    DuckDB->>DuckDB: Generate parameterized DuckDB SQL
    DuckDB->>DuckDB: Execute query in WASM sandbox
    DuckDB-->>Widget: Return QueryResult (columns, rows, executionTimeMs)

    Widget->>Widget: Transform result for Recharts / Table data provider
    Widget->>User: Smoothly animates chart update (< 50ms)
```

---

## 6. Schema Drift Detection & Template Application

```mermaid
flowchart TD
    Start["User uploads new spreadsheet to existing Template"] --> ProfileNew["Profile uploaded sheet columns & types"]
    ProfileNew --> Compare["Compare against Template SchemaFingerprint"]

    Compare --> CheckMatch{"All columns match exactly?"}
    CheckMatch -- Yes --> DirectLoad["Load DashboardSpec immediately\n(Zero User Friction)"]
    CheckMatch -- No --> DriftAnalysis["Compute Drift Analysis:\n- Exact name matches\n- Fuzzy name matches (Levenshtein)\n- Type compatibility check\n- Detect missing & added columns"]

    DriftAnalysis --> GenReport["Generate DriftReport (@unsheet/contracts)"]
    GenReport --> CheckBreaking{"Breaking changes detected?\n(Missing required measures/dimensions)"}

    CheckBreaking -- No --> AutoRemap["Apply automated remappings\n(High confidence >= 0.90)"]
    CheckBreaking -- Yes --> ShowModal["Display Drift Remapping Modal"]

    ShowModal --> UserConfirm["User confirms or adjusts column mappings"]
    UserConfirm --> ApplyRemap["Synthesize Adapted DashboardSpec"]
    AutoRemap --> ApplyRemap
    ApplyRemap --> Render["Render Dashboard with Adapted Spec"]
```

---

## 7. LLM Feature Architecture (Spec Refinement & Ask-Your-Data)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant UI as Dashboard Editor / Ask UI
    participant Backend as Next.js API Route (/api/refine-spec)
    participant Contracts as @unsheet/contracts
    participant LLM as LLM Provider (Anthropic / OpenAI)
    participant DuckDB as DuckDB-WASM Worker

    User->>UI: Enters natural language query: "Compare profit margin by quarter"
    UI->>UI: Assemble request payload:
    Note over UI: Includes currentSpec + ColumnProfiles.<br/>Raw data rows are EXCLUDED.<br/>Sample values strictly capped <=5 items, <=40 chars.

    UI->>Backend: POST /api/refine-spec (SpecRefinementRequest)
    Backend->>Contracts: SpecRefinementRequestSchema.parse(body)
    Backend->>Backend: Check rate limits & token budget
    Backend->>LLM: Generate structured completion with system prompt instructions
    LLM-->>Backend: JSON completion

    Backend->>Contracts: SpecRefinementResponseSchema.parse(response)
    Backend-->>UI: 200 OK (SpecRefinementResponse)

    UI->>Contracts: DashboardSpecSchema.parse(updatedSpec)
    UI->>DuckDB: Execute new query plans for altered widgets
    DuckDB-->>UI: Updated aggregations
    UI->>User: Renders refined dashboard with highlighted changes
```

---

## 8. Share Link Generation & Consumption

```mermaid
sequenceDiagram
    autonumber
    actor Creator as Dashboard Creator
    participant WebUI as Creator Web Client
    participant API as Next.js API (/api/share)
    participant Supabase as Supabase (PostgreSQL with RLS)
    actor Viewer as Dashboard Viewer
    participant ViewerUI as Viewer Web Client

    Creator->>WebUI: Clicks "Share Dashboard"
    WebUI->>WebUI: Formulates CreateShareLinkRequest (Spec + optional snapshot)
    WebUI->>API: POST /api/share (CreateShareLinkRequest)

    API->>API: Generate 128-bit cryptographically secure token (nanoid/crypto)
    API->>API: Calculate expiration timestamp (e.g., 48 hours)
    API->>Supabase: INSERT INTO shared_dashboards (token, spec, expires_at)
    Supabase-->>API: 201 Created
    API-->>WebUI: { shareToken, shareUrl, expiresAt }

    WebUI->>Creator: Displays shareable URL (https://unsheet.app/s/v9X_4kL8...)

    Viewer->>ViewerUI: Navigates to shareUrl
    ViewerUI->>API: GET /api/share/:token
    API->>Supabase: SELECT spec, expires_at FROM shared_dashboards WHERE token = :token
    Supabase-->>API: Row data
    API->>API: Verify token is active and not expired
    API-->>ViewerUI: { title, spec, dataSnapshot }

    ViewerUI->>ViewerUI: DashboardSpecSchema.parse(spec)
    ViewerUI->>Viewer: Renders view-only interactive dashboard
```
