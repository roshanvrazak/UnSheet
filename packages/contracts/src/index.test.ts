import { describe, it, expect } from 'vitest';
import * as Contracts from './index.js';

describe('@unsheet/contracts exports', () => {
  it('exports all expected core schemas and constants', () => {
    expect(Contracts.FORBIDDEN_OBJECT_KEYS).toContain('__proto__');
    expect(Contracts.SafeIdentifierSchema).toBeDefined();
    expect(Contracts.SafeEntityIdSchema).toBeDefined();
    expect(Contracts.SafeUrlSchema).toBeDefined();
    expect(Contracts.SampleValueSchema).toBeDefined();
    expect(Contracts.WorkbookModelSchema).toBeDefined();
    expect(Contracts.SheetModelSchema).toBeDefined();
    expect(Contracts.CellModelSchema).toBeDefined();
    expect(Contracts.MAX_FILE_SIZE_BYTES).toBe(10 * 1024 * 1024);
    expect(Contracts.MAX_UNCOMPRESSED_BYTES).toBe(200 * 1024 * 1024);
    expect(Contracts.MAX_ROWS).toBe(200_000);
    expect(Contracts.MAX_COLUMNS).toBe(200);
    expect(Contracts.MAX_SHEETS).toBe(20);
    expect(Contracts.ColumnProfileSchema).toBeDefined();
    expect(Contracts.LLMColumnProfileSchema).toBeDefined();
    expect(Contracts.SheetProfileSchema).toBeDefined();
    expect(Contracts.DashboardSpecSchema).toBeDefined();
    expect(Contracts.WidgetSpecSchema).toBeDefined();
    expect(Contracts.TemplateSchema).toBeDefined();
    expect(Contracts.SchemaFingerprintSchema).toBeDefined();
    expect(Contracts.DriftReportSchema).toBeDefined();
    expect(Contracts.QueryPlanSchema).toBeDefined();
    expect(Contracts.QueryResultSchema).toBeDefined();
    expect(Contracts.SafeSqlQuerySchema).toBeDefined();
    expect(Contracts.SpecRefinementRequestSchema).toBeDefined();
    expect(Contracts.CreateShareLinkRequestSchema).toBeDefined();
    expect(Contracts.AskYourDataRequestSchema).toBeDefined();
    expect(Contracts.SafeExportCellSchema).toBeDefined();
    expect(Contracts.ExportRowSchema).toBeDefined();
    expect(Contracts.ExportTableSchema).toBeDefined();
    expect(Contracts.ExportFormatSchema).toBeDefined();
    expect(Contracts.ExportOptionsSchema).toBeDefined();
  });
});
