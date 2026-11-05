# Unsheet workspace design

## Goal
Make the spreadsheet-to-dashboard workflow feel like a finished analytics product. The dashboard is the primary content; dataset loading and engine details are supporting controls. Preserve existing upload, filtering, sheet selection, field selection, Ask AI, refinement, export, and sharing behavior.

## Direction and evidence
Applied nextlevelbuilder/ui-ux-pro-max-skill (installed as ui-ux-pro-max). Its design-system searches for spreadsheet analytics and business-intelligence dashboards both matched **Data-Dense Dashboard**: efficient grids, minimal padding, KPI cards, accessible chart/table views, filtering, and low-cost effects. The generator's Enterprise Gateway marketing pattern did not fit an application workspace, including after a narrower retry, and is deliberately not used. Colors and typography below are a considered product-specific override of its blue/Fira suggestion.

- Warm neutral canvas, white panels, forest-green primary actions, subdued sage selection states.
- Locally hosted Geist variable font; tabular figures for metrics. No runtime font service dependency.
- Strong heading hierarchy, readable 12–14px supporting text, restrained 12px panel radii.
- Compact welcome/upload panel and four clearly selected sample workbooks. Once a workbook is loaded, keep the upload introduction collapsed so metrics and charts are visible above the fold; the sample selector and New File action remain available.
- Persistent top navigation; contextual toolbar in document flow rather than a floating dock obscuring charts.
- Sidebar for sheets and fields. Overlay on small screens, closed by default.
- Clear chart containers and full metric labels; no invented trend percentages or decorative progress bars.

## Interaction and quality
Native file input and Browse button support keyboard and drag-and-drop. All icon actions have names and visible focus states. Controls expose expanded/pressed state. Reduced-motion is respected. Mobile overlays have a close button, backdrop, and Escape support. Charts retain accessible data-table alternatives. Test at 320/375, 768, 1024, and 1440px; verify no document overflow, preserve dashboard functionality, and run axe checks and existing tests.

## Scope
Presentation and related accessibility only. Preserve the existing uncommitted backend/security work. Do not push, deploy, or alter data contracts for the redesign.

## Verification

- 700 unit/integration tests pass across 59 files.
- 20 browser checks pass against both development and optimized production builds across desktop Chromium and Mobile Chrome, including accessibility, filtering, uploads, CSV contents, query execution, refinement/undo, and field-search/Escape behavior.
- Visual previews inspected for the dashboard, expanded upload panel, AI drawer, and mobile layout.
- Additional reduced-motion layout checks at 320, 375, 768, 1024, and 1440px found no page errors or document horizontal overflow.
- Typechecking and production build pass. Lint has no errors; existing security-rule warnings remain.
- Font is self-hosted with its OFL license; no new npm dependencies or backend changes are required.
