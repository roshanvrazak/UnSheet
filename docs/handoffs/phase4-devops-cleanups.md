# Phase 4 DevOps & Platform - Lint Cleanups Handoff

## Summary of Changes
Successfully resolved all 22 lint/type errors across `apps/web`:
1. `apps/web/components/editor/FilterConfigModal.tsx`:
   - Replaced `any` with `string` and type assertion on filter type selection.
2. `apps/web/components/editor/WidgetConfigModal.tsx`:
   - Replaced `any` with specific types (`WidgetSpec['type']`, `WidgetSpec['aggregation']`, and formatting styles).
3. `apps/web/components/template/TemplateLibraryModal.tsx`:
   - Removed unused imports `Download`, `Check`.
   - Removed unused catch parameter `err` (changed to `catch {`).
4. `apps/web/components/template/TemplateSaveModal.tsx`:
   - Replaced `any` with `Template['category']`.
5. `apps/web/components/ui/button.tsx`:
   - Omitted unused `asChild` from component props.
6. `apps/web/components/ui/dialog.tsx`:
   - Removed unused `createPortal` import.
7. `apps/web/components/ui/select.tsx`:
   - Cleaned up unused variables `open`, `value`, `setOpen`.
8. `apps/web/lib/template/storage.ts`:
   - Removed unused imports `DashboardSpec`, `SheetProfile`.
   - Changed `let memoryStorage` to `const memoryStorage`.
   - Simplified catch blocks to omit unused error bindings (`catch {`).
9. `apps/web/test/drift_ui.test.tsx`:
   - Replaced `any` with `Record<string, unknown>`.
10. `apps/web/test/template.test.tsx`:
    - Removed unused import `fireEvent`.

## Verification
- Ran `pnpm lint` successfully with 0 lint errors.
