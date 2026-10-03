import { describe, it, expect } from 'vitest';
import * as Contracts from './index.js';

describe('@unsheet/contracts exports', () => {
  it('exports all expected core schemas and constants', () => {
    expect(Contracts.FORBIDDEN_OBJECT_KEYS).toContain('__proto__');
    expect(Contracts.SafeIdentifierSchema).toBeDefined();
    expect(Contracts.SampleValueSchema).toBeDefined();
    expect(Contracts.WorkbookModelSchema).toBeDefined();
    expect(Contracts.SheetModelSchema).toBeDefined();
    expect(Contracts.CellModelSchema).toBeDefined();
    expect(Contracts.ColumnProfileSchema).toBeDefined();
    expect(Contracts.SheetProfileSchema).toBeDefined();
    expect(Contracts.DashboardSpecSchema).toBeDefined();
    expect(Contracts.WidgetSpecSchema).toBeDefined();
    expect(Contracts.TemplateSchema).toBeDefined();
    expect(Contracts.SchemaFingerprintSchema).toBeDefined();
    expect(Contracts.DriftReportSchema).toBeDefined();
    expect(Contracts.QueryPlanSchema).toBeDefined();
    expect(Contracts.QueryResultSchema).toBeDefined();
    expect(Contracts.SpecRefinementRequestSchema).toBeDefined();
    expect(Contracts.CreateShareLinkRequestSchema).toBeDefined();
    expect(Contracts.AskYourDataRequestSchema).toBeDefined();
  });
});
