# Phase 4 Frontend Fixes Handoff Note

Remediated Phase 4 review findings in `apps/web`:

## Summary of Changes
1. **`apps/web/lib/template/storage.ts` (SEC-401 & SEC-402)**:
   - Added size check in `importTemplateJson(jsonString)`: throws `Error('Template file exceeds maximum permitted size of 1MB')` if `jsonString.length > 1_048_576`.
   - Wrapped JSON parsing in try/catch with descriptive error handling.
   - Validated parsed data against `TemplateSchema.safeParse(...)`, throwing `Error('Invalid template structure: ' + result.error.message)` on failure.
   - Updated `loadLocalTemplates()` to iterate through stored items and filter them through `TemplateSchema.safeParse(...)`, discarding corrupted items gracefully and falling back to default templates if none remain valid.

2. **`apps/web/components/editor/WidgetConfigModal.tsx` (Finding 1)**:
   - Enforced strict grid coordinate bounds (`x + w <= 12`) in the modal save handler by clamping `w` (`Math.min(12, Math.max(1, w))`) and `x` (`Math.min(12 - w, Math.max(0, x))`).

3. **`apps/web/components/ui/dialog.tsx` (Finding 2)**:
   - Added `role="dialog"` and `aria-modal="true"` to the dialog container.
   - Added `onKeyDown` Escape key handler (`if (e.key === 'Escape' && onOpenChange) onOpenChange(false)`) and `tabIndex={-1}`.

4. **`apps/web/components/template/TemplateSaveModal.tsx` (SEC-404)**:
   - Added HTML length bounds:
     - `maxLength={128}` on template name input.
     - `maxLength={500}` on description textarea.
     - `maxLength={320}` on tags input.

## Verification Results
- `pnpm --filter @unsheet/web typecheck`: **PASSED** (0 errors)
- `pnpm --filter @unsheet/web test`: **PASSED** (all 46 tests passed across 10 test files)
