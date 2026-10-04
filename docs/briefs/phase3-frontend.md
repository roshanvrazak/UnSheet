# Phase 3 Task Brief: Generic Dashboard Renderer & UI

## Agent
`frontend-engineer`

## Branch
`agent/frontend/phase3-renderer`

## Goal
Implement the generic dashboard renderer, widget registry (KPI, Line, Bar, Donut, Table, Pivot), total error fallback cards, interactive filter bar, and anonymous demo UI in `apps/web/`.

## Input Contracts
- `@unsheet/contracts`:
  - `DashboardSpecSchema`, `DashboardSpec`
  - `WidgetSpecSchema`, `KPIWidgetSpec`, `LineChartWidgetSpec`, `BarChartWidgetSpec`, `DonutChartWidgetSpec`, `TableWidgetSpec`, `PivotTableWidgetSpec`
  - `FilterSpecSchema`, `FilterSpec`
  - `SheetModelSchema`, `SheetModel`
  - `SheetProfileSchema`, `SheetProfile`
  - `QueryResultSchema`, `QueryResult`
- `@unsheet/engine`:
  - `parseSpreadsheet`, `normaliseWorkbook`
  - `profileWorkbook`, `profileSheet`
  - `generateDashboardSpec`
  - `buildWidgetQueryPlan`, `compileQueryPlanToSql`
- `@unsheet/fixtures`:
  - Fixture loaders and sample workbooks (Project Pipeline, BOQ Quotes, Supplier Lead Times)

## Owned Paths
- `apps/web/app/**` (excluding `apps/web/app/api/**`)
- `apps/web/components/**`
- `apps/web/hooks/**`
- `apps/web/styles/**`
- `apps/web/test/**`

## Acceptance Criteria
1. **Total Dashboard Renderer (`apps/web/components/dashboard/DashboardRenderer.tsx`)**:
   - Renders a complete `DashboardSpec` on a responsive 12-column CSS Grid.
   - Respects `widget.grid.x`, `widget.grid.y`, `widget.grid.w`, `widget.grid.h`.
   - Total renderer guarantee: if a widget spec is invalid, malformed, or fails to execute, it renders an `ErrorCardWidget` instead of crashing the page.
   - Filter state management: maintains active filter values and updates widgets reactively.

2. **Widget Registry (`apps/web/components/dashboard/widgets/`)**:
   - `KPIWidget`: displays title, formatted primary measure, comparison change badge, and description.
   - `LineChartWidget`: Recharts line chart with responsive sizing, axes, tooltips, and time formatting.
   - `BarChartWidget`: Recharts horizontal or vertical bar chart with category labels, formatting, and tooltips.
   - `DonutChartWidget`: Recharts donut/pie chart with categorical color palette, percentages, and legend.
   - `TableWidget`: Paginated, sortable tabular data display with safe cell formatting.
   - `PivotTableWidget`: Two-dimensional pivot table matrix (rows x columns with aggregated measure cells).
   - `ErrorCardWidget`: Clean error card displaying widget title and error description, never revealing raw stack traces or untrusted user content unsanitized.

3. **Accessibility (`apps/web/components/dashboard/AccessibleDataTable.tsx`)**:
   - Every chart widget includes an accessible toggle or hidden screen-reader table (`sr-only` or collapsible) rendering data as a standard HTML `<table>` with `<th>` headers.
   - Keyboard accessible filter controls.
   - Passes accessibility standards (axe-core clean, WCAG AA compliant).
   - Zero `dangerouslySetInnerHTML`. All cell and header strings safely rendered via React JSX text nodes.

4. **Global Filter Bar (`apps/web/components/dashboard/FilterBar.tsx`)**:
   - Renders filter controls for defined `spec.filters`:
     - Select / Multi-Select dropdowns for categorical dimensions.
     - Date range filter for time dimensions.
     - Search input.
   - Updates global filter state and triggers widget query refreshes.

5. **Anonymous Demo Mode (`apps/web/app/page.tsx`)**:
   - Header with Unsheet logo, tagline ("Any spreadsheet. Instant dashboard."), and Privacy Badge ("100% In-Browser: your data never leaves your device").
   - Drag-and-drop file upload zone (accepts `.xlsx`, `.csv`).
   - One-click Sample Loaders:
     1. "Project Pipeline" (Engineering projects, stages, budgets, owners)
     2. "BOQ & Quotes" (Bills of quantities, materials, rates, contractors)
     3. "Supplier Lead Times" (Supplier performance, delivery days, defect rates)
     4. "Messy Workbook" (Header offset, blank rows, mixed data types)
   - Live pipeline visualization: Parse -> Normalise -> Profile -> SpecGen -> Render with elapsed milliseconds counter.
   - Displays the fully interactive dashboard with instant cross-filtering!

6. **Component & Integration Tests (`apps/web/test/`)**:
   - Vitest + React Testing Library tests for each widget.
   - Test verifying `ErrorCardWidget` catches and displays malformed widget spec without crash.
   - Test verifying accessible table toggle exists for charts.
   - Test verifying file upload / demo loading renders dashboard.

7. **Verification**:
   - `pnpm --filter @unsheet/web test` passes.
   - `pnpm --filter @unsheet/web build` succeeds.
   - Handoff note at `docs/handoffs/phase3-frontend-engineer.md`.
