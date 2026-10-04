# Phase 5 Frontend Chat & LLM UI Components - Implementation Plan

## 1. Objectives
Implement Phase 5 Chat & LLM UI components in `apps/web`:
- `apps/web/components/chat/AskYourDataDrawer.tsx`
- `apps/web/components/chat/SpecRefineBar.tsx`
- Integration in `apps/web/app/page.tsx`
- Comprehensive tests in `apps/web/test/chat.test.tsx`
- Handoff note at `docs/handoffs/phase5-frontend-engineer.md`

## 2. Component Specs

### `AskYourDataDrawer.tsx`
- **Props**: `isOpen: boolean`, `onClose: () => void`, `sheet: SheetModel`, `profile: SheetProfile`, `onAddWidget: (widget: WidgetSpec) => void`
- **Features**:
  - Slide-out drawer/modal on the right side (`role="dialog"`, `aria-label="Ask Your Data"`, `aria-modal="true"`).
  - Header with title & subtitle.
  - Dynamic sample prompt suggestion chips based on column profiles in `profile`.
  - Input field + submit button ("Ask") + loading spinner (`isSearching`).
  - Chat history / response display:
    - User query bubble.
    - Assistant response bubble (`interpretedIntent`, `explanation`).
    - Collapsible SQL Preview card in `<pre><code>`.
    - Suggested widget card with "Add to Dashboard" button -> calls `onAddWidget(suggestedWidget)` & shows success feedback ("Added to dashboard!").
    - Error state / rate limit (429) user-friendly handling.
  - API call: `fetch('/api/query/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question, sheetName: sheet.name, profiles: profile.columnProfiles.map(toLLMColumnProfile) }) })`.

### `SpecRefineBar.tsx`
- **Props**: `currentSpec: DashboardSpec`, `profile: SheetProfile`, `onSpecUpdate: (newSpec: DashboardSpec) => void`, `className?: string`
- **Features**:
  - Inline banner with Sparkles icon & placeholder: `"Refine dashboard with AI (e.g. 'Add a KPI for total revenue', 'Change bar chart to donut')..."`
  - Submit button ("Refine") + loading spinner.
  - API call: `fetch('/api/spec/refine', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, currentSpec, profiles: profile.columnProfiles.map(toLLMColumnProfile) }) })`.
  - On success: calls `onSpecUpdate(response.updatedSpec)`, shows temporary banner with explanation & appliedChanges tags, and an "Undo" button to revert to `currentSpec`.
  - Rate-limit & error handling with alert badge.

### Integration in `app/page.tsx`
- Add "Ask Data" and "AI Refine" buttons in the dashboard toolbar.
- Manage state for `isAskDrawerOpen` and `isSpecRefineOpen` (or toggle).
- Pass correct props to `<AskYourDataDrawer>` and `<SpecRefineBar>`.

### Tests (`test/chat.test.tsx`)
- Mock `global.fetch`.
- Test 1: AskYourDataDrawer interaction (chips, submit, SQL preview, widget addition).
- Test 2: Error and 429 rate limit handling.
- Test 3: SpecRefineBar refinement & Undo.
