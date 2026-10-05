# Modern Analytics Studio UI Redesign Spec

<!-- design-spec:unsheet-studio 1.0 -->

## Status: Approved
- **Author**: Antigravity & User
- **Date**: 2026-10-05
- **Archetype**: Linear / Vercel-inspired High-Craft Analytics Studio

---

## 1. Context and Problem Statement

Unsheet's core data intelligence engine (DuckDB-WASM, local SheetJS parsing, automated column profiling, and heuristic dashboard spec generation) is fast, private, and resilient. However, the existing interface used a plain stacked form layout (a 5-column dropzone and 7-column sample card grid sitting directly on top of the dashboard canvas), lacking visual polish, modern responsive ergonomics, and active field control.

The goal of this redesign is to elevate Unsheet into a modern web application embodying a high-craft **Linear / Vercel Analytics Studio** aesthetic:
1. **Full-width Studio Shell**: A glassmorphic top navbar with breadcrumbs and privacy indicators, replacing the generic marketing-style header.
2. **Collapsible Left Inspector**: A dedicated sidebar housing multi-sheet navigation and an interactive **Field Selector** allowing users to choose exactly which columns generate widgets.
3. **Elevated Visuals**: Hairline borders (`border-slate-200/80`), subtle top highlights, clean typography with tabular numbers, subtle dot-grid canvas background, and micro-interactions.
4. **Floating Island Action Bar**: A sleek capsule command bar anchored to the viewport bottom for high-frequency actions (`✨ Ask AI`, `Refine`, `Export`, `Share`).
5. **Modern Hero Dropzone**: A high-impact upload hero with ambient gradient glow and sample badges for initial empty state.

---

## 2. Architecture & Component Decomposition

The studio UI is decomposed into modular, isolated components within `apps/web/components/studio/`:

```
apps/web/
├── app/
│   ├── page.tsx                      # Root Studio controller & state orchestrator
│   └── globals.css                   # Custom dot-grid background and subtle utility classes
├── components/
│   └── studio/
│       ├── StudioNavbar.tsx          # Top glassmorphic header with breadcrumbs & actions
│       ├── FieldInspector.tsx        # Collapsible left panel (Sheets + Column selector)
│       ├── FloatingCommandBar.tsx    # Floating island action dock
│       └── UploadHero.tsx            # Modern ambient glow dropzone & sample picker
└── components/
    └── dashboard/                    # Existing 12-column widget renderer & charts
```

### Component Contracts

#### A. `StudioNavbar.tsx`
- **Props**:
  - `workbookName?: string`
  - `activeSheetName?: string`
  - `rowCount?: number`
  - `colCount?: number`
  - `onUploadClick: () => void`
  - `onShareClick: () => void`
  - `isInspectorOpen: boolean`
  - `onToggleInspector: () => void`
  - `activeSampleId?: string`
  - `onSelectSample: (sample: SampleWorkbookMeta) => void`
- **Behavior**: Sticky glassmorphic bar (`backdrop-blur-md bg-white/80 border-b border-slate-200/80`). Renders geometric Unsheet logo, breadcrumbs, privacy indicator, and quick actions.

#### B. `FieldInspector.tsx`
- **Props**:
  - `isOpen: boolean`
  - `onClose: () => void`
  - `sheets: SheetModel[]`
  - `activeSheetIndex: number`
  - `onSelectSheet: (index: number) => void`
  - `columnProfiles: ColumnProfile[]`
  - `selectedColumnKeys: Set<string>`
  - `onToggleColumn: (key: string) => void`
  - `onSelectAll: () => void`
  - `onClearAll: () => void`
  - `onApplyFields: () => void`
  - `isDirty: boolean`
  - `pipelineTiming?: PipelineTiming | null`
- **Behavior**: Width `w-72` fixed or collapsible side rail. Displays sheet tabs with row counts, grouped field list (Measures vs Dimensions vs Dates) with type badges, and an "Apply Changes" button when selections are modified.

#### C. `FloatingCommandBar.tsx`
- **Props**:
  - `onAskClick: () => void`
  - `onRefineClick: () => void`
  - `isRefineOpen: boolean`
  - `sheet: SheetModel`
  - `onShareClick: () => void`
  - `onToggleInspector: () => void`
  - `isInspectorOpen: boolean`
- **Behavior**: Capsule dock fixed at `bottom-6 left-1/2 -translate-x-1/2 z-40`. Contains buttons for Ask AI (indigo pill), Refine Dashboard, Export Dropdown, Share Modal, and Inspector toggle.

#### D. `UploadHero.tsx`
- **Props**:
  - `onFileUpload: (file: File) => void`
  - `onSelectSample: (sample: SampleWorkbookMeta) => void`
  - `activeSampleId?: string`
  - `isProcessing: boolean`
- **Behavior**: Full hero state shown when no workbook is loaded or when explicitly toggled. Features ambient radial glow, interactive drag-and-drop zone, and clean sample pill cards.

---

## 3. Data Flow & Field Selection Mechanics

1. **Initial Upload**: User uploads spreadsheet bytes or clicks sample.
2. **Profiling**: `normaliseWorkbook` produces sheets, `profileSheet` produces `SheetProfile` with full `columnProfiles`.
3. **Field Selection State**: `selectedColumnKeys` is initialized with all non-empty profiled columns.
4. **Dashboard Generation**:
   - `generateDashboardSpec(profile, ...)` generates spec.
   - When the user modifies field checkboxes in `FieldInspector` and clicks **Apply**:
     ```ts
     const filteredProfile: SheetProfile = {
       ...originalProfile,
       columnProfiles: originalProfile.columnProfiles.filter(c => selectedColumnKeys.has(c.columnKey))
     };
     const newSpec = generateDashboardSpec(filteredProfile, { title: `${activeSheet.name} Dashboard` });
     setSpec(newSpec);
     ```
   - Operates entirely in memory (<5ms), avoiding any disk/worker re-parsing.

---

## 4. Visual Language & Styling Tokens

- **Palette**:
  - Base canvas: `bg-slate-50/70` with subtle dot matrix pattern.
  - Cards & Panels: Pure `bg-white` with `border border-slate-200/80` and `shadow-[0_1px_3px_rgba(0,0,0,0.04)]`.
  - Accents: Indigo/Blue (`#4F46E5`, `#2563EB`) for action triggers and active states.
  - Badges: Semantic subtle chips (Emerald for privacy/positive, Amber for samples, Slate for meta).
- **Typography**: Inter/system sans, refined letter-spacing (`tracking-tight`), crisp labels (`text-xs font-semibold uppercase tracking-wider text-slate-500`), and tabular numerals (`tabular-nums`).
- **Floating Dock**: Contrast dark glassmorphism (`bg-slate-900/90 text-white border border-white/10 shadow-2xl backdrop-blur-xl`).

---

## 5. Security & Privacy Guarantees

- All client-side sandbox boundaries are strictly preserved: 100% in-browser parsing, Wasm-sandboxed DuckDB queries, and zero raw data egress.
- No `dangerouslySetInnerHTML`.
- All CSS conforms to Tailwind utility constraints.

---

## 6. Verification and Testing

1. **Automated Unit & Integration Tests**:
   - Test `FieldInspector` rendering, selection changes, and apply triggers.
   - Test `StudioNavbar` breadcrumbs and action triggers.
   - Test `FloatingCommandBar` action buttons.
   - Test `UploadHero` drag-and-drop and sample selection.
2. **Design Quality Auditing**:
   - Run `npx impeccable detect apps/web` to ensure zero design regressions or anti-patterns.
3. **Full Suite Verification**:
   - `pnpm run typecheck` (`tsc --noEmit`)
   - `pnpm test` (all unit & property test suites)
   - `pnpm run build` (`next build` production check)
