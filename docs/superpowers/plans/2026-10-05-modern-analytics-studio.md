# Modern Analytics Studio UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Unsheet's user interface from a plain stacked form layout into a high-craft Linear / Vercel-inspired full-width Analytics Studio featuring glassmorphic navigation, collapsible sheet and field inspector, and a floating command bar dock.

**Architecture:** Decompose the studio layout into modular components (`StudioNavbar`, `UploadHero`, `FieldInspector`, `FloatingCommandBar`) tied together by a streamlined state controller in `app/page.tsx`. Field filtering updates the active `SheetProfile` in memory and reactively regenerates `DashboardSpec` without re-parsing files.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS, Lucide Icons, Vitest, Testing Library.

**Spec:** [`docs/superpowers/specs/2026-10-05-modern-analytics-studio-design.md`](file:///home/rvr/Work/basi/UnSheet/docs/superpowers/specs/2026-10-05-modern-analytics-studio-design.md)

## Global Constraints

- 100% in-browser client-side execution; no raw data egress.
- Strictly adhere to `@unsheet/contracts` and `@unsheet/engine` APIs.
- Preserve `WidgetErrorBoundary` fault isolation and WCAG AA `AccessibleDataTable` companion views.
- No `dangerouslySetInnerHTML`.
- All visual tokens must pass `impeccable detect` with zero anti-patterns.

## Review Focus

1. **Empty / No Workbook State**: When no file is loaded, `UploadHero` must render cleanly with working sample buttons and dropzone, without crashing `StudioNavbar` or `FloatingCommandBar`.
2. **Field Deselection Edge Case**: If a user unchecks all fields, `FieldInspector` must prevent applying an empty profile or default gracefully with a minimum fallback so `generateDashboardSpec` does not throw.
3. **Multi-Sheet Switching**: Switching sheets in `FieldInspector` must reset `selectedColumnKeys` to the new sheet's columns and regenerate the spec for that sheet.
4. **Mobile & Viewport Responsiveness**: On narrow screens (<768px), `FieldInspector` must behave as an overlay drawer that can be dismissed, and `FloatingCommandBar` must fit within the screen without overflow.
5. **Dark Mode & Contrast Integrity**: All studio elements must maintain strict WCAG AA contrast under `darkMode: 'class'`.

---

### Task 1: Global Studio Styles & Background Grid

**Files:**
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Produces: CSS utility `.bg-dot-grid` for subtle modern canvas dot grid.

- [ ] **Step 1: Add dot-grid CSS utility in `apps/web/app/globals.css`**

Add radial dot grid background utility:
```css
.bg-dot-grid {
  background-image: radial-gradient(rgba(148, 163, 184, 0.25) 1px, transparent 1px);
  background-size: 24px 24px;
}
```

- [ ] **Step 2: Verify `pnpm run build` compiles with globals.css changes**

Run: `pnpm --filter @unsheet/web build`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "style: add modern studio dot-grid background utility"
```

---

### Task 2: `UploadHero` Component & Tests

**Files:**
- Create: `apps/web/components/studio/UploadHero.tsx`
- Test: `apps/web/test/studio/UploadHero.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface UploadHeroProps {
    onFileUpload: (file: File) => void;
    onSelectSample: (sample: SampleWorkbookMeta) => void;
    activeSampleId?: string;
    isProcessing: boolean;
  }
  export function UploadHero(props: UploadHeroProps): React.JSX.Element;
  ```

- [ ] **Step 1: Write failing unit test for `UploadHero`**

Create `apps/web/test/studio/UploadHero.test.tsx` testing dropzone render, sample selection, and file drop handling.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @unsheet/web test test/studio/UploadHero.test.tsx`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement `UploadHero` component**

Build `apps/web/components/studio/UploadHero.tsx` featuring ambient glow, drag-and-drop file input, format support badges, and one-click sample pills.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @unsheet/web test test/studio/UploadHero.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/UploadHero.tsx apps/web/test/studio/UploadHero.test.tsx
git commit -m "feat(studio): add modern UploadHero component and tests"
```

---

### Task 3: `StudioNavbar` Component & Tests

**Files:**
- Create: `apps/web/components/studio/StudioNavbar.tsx`
- Test: `apps/web/test/studio/StudioNavbar.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface StudioNavbarProps {
    workbookName?: string;
    activeSheetName?: string;
    rowCount?: number;
    colCount?: number;
    onUploadClick: () => void;
    onShareClick: () => void;
    isInspectorOpen: boolean;
    onToggleInspector: () => void;
    activeSampleId?: string;
    onSelectSample: (sample: SampleWorkbookMeta) => void;
  }
  export function StudioNavbar(props: StudioNavbarProps): React.JSX.Element;
  ```

- [ ] **Step 1: Write failing unit test for `StudioNavbar`**

Create `apps/web/test/studio/StudioNavbar.test.tsx` verifying breadcrumb display, privacy badge, and action callbacks.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @unsheet/web test test/studio/StudioNavbar.test.tsx`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement `StudioNavbar` component**

Build `apps/web/components/studio/StudioNavbar.tsx` with glassmorphic top header, brand logo, live breadcrumbs, sample quick-switcher, and upload triggers.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @unsheet/web test test/studio/StudioNavbar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/StudioNavbar.tsx apps/web/test/studio/StudioNavbar.test.tsx
git commit -m "feat(studio): add glassmorphic StudioNavbar component and tests"
```

---

### Task 4: `FieldInspector` Component & Tests

**Files:**
- Create: `apps/web/components/studio/FieldInspector.tsx`
- Test: `apps/web/test/studio/FieldInspector.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface FieldInspectorProps {
    isOpen: boolean;
    onClose: () => void;
    sheets: SheetModel[];
    activeSheetIndex: number;
    onSelectSheet: (index: number) => void;
    columnProfiles: ColumnProfile[];
    selectedColumnKeys: Set<string>;
    onToggleColumn: (key: string) => void;
    onSelectAll: () => void;
    onClearAll: () => void;
    onApplyFields: () => void;
    isDirty: boolean;
    pipelineTiming?: PipelineTiming | null;
  }
  export function FieldInspector(props: FieldInspectorProps): React.JSX.Element;
  ```

- [ ] **Step 1: Write failing unit test for `FieldInspector`**

Create `apps/web/test/studio/FieldInspector.test.tsx` testing sheet list rendering, field role grouping (Measures, Dimensions, Dates), checkbox toggling, and Apply button.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @unsheet/web test test/studio/FieldInspector.test.tsx`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement `FieldInspector` component**

Build `apps/web/components/studio/FieldInspector.tsx` with collapsible sidebar, sheet tabs with counts, categorized column checklist with type pills, dirty state tracking, and pipeline execution telemetry.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @unsheet/web test test/studio/FieldInspector.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/FieldInspector.tsx apps/web/test/studio/FieldInspector.test.tsx
git commit -m "feat(studio): add collapsible FieldInspector component and tests"
```

---

### Task 5: `FloatingCommandBar` Component & Tests

**Files:**
- Create: `apps/web/components/studio/FloatingCommandBar.tsx`
- Test: `apps/web/test/studio/FloatingCommandBar.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  export interface FloatingCommandBarProps {
    onAskClick: () => void;
    onRefineClick: () => void;
    isRefineOpen: boolean;
    sheet: SheetModel;
    onShareClick: () => void;
    onToggleInspector: () => void;
    isInspectorOpen: boolean;
  }
  export function FloatingCommandBar(props: FloatingCommandBarProps): React.JSX.Element;
  ```

- [ ] **Step 1: Write failing unit test for `FloatingCommandBar`**

Create `apps/web/test/studio/FloatingCommandBar.test.tsx` testing button clicks for Ask AI, Refine, Export, Share, and Inspector.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @unsheet/web test test/studio/FloatingCommandBar.test.tsx`
Expected: FAIL (Cannot find module)

- [ ] **Step 3: Implement `FloatingCommandBar` component**

Build `apps/web/components/studio/FloatingCommandBar.tsx` with dark glassmorphic capsule dock fixed at `bottom-6 left-1/2 -translate-x-1/2`, glow effects, keyboard labels, and micro-interactions.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @unsheet/web test test/studio/FloatingCommandBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/studio/FloatingCommandBar.tsx apps/web/test/studio/FloatingCommandBar.test.tsx
git commit -m "feat(studio): add FloatingCommandBar island component and tests"
```

---

### Task 6: Assemble Studio in `apps/web/app/page.tsx` & End-to-End Verification

**Files:**
- Modify: `apps/web/app/page.tsx`
- Test: `apps/web/test/demo.test.tsx`

**Interfaces:**
- Consumes: `StudioNavbar`, `UploadHero`, `FieldInspector`, `FloatingCommandBar`, `DashboardRenderer`.

- [ ] **Step 1: Update `apps/web/app/page.tsx` with the new Studio architecture**

Integrate state for `isInspectorOpen`, `selectedColumnKeys`, `isDirty`, and the reactive profile filtering handler `handleApplyFields`. Render `StudioNavbar` at top, `UploadHero` when no workbook is loaded, and the 2-column studio layout (`FieldInspector` + canvas + `FloatingCommandBar`) when a workbook is active.

- [ ] **Step 2: Update existing tests in `apps/web/test/demo.test.tsx`**

Ensure `demo.test.tsx` passes with the new studio navbar and upload hero elements.

- [ ] **Step 3: Run detector and full verification suite**

Run:
1. `.claude/skills/impeccable/scripts/impeccable detect apps/web` (zero anti-patterns)
2. `pnpm run typecheck`
3. `pnpm test`
4. `pnpm run build`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/page.tsx apps/web/test/demo.test.tsx
git commit -m "feat(studio): assemble modern Analytics Studio in page.tsx"
```
