import { describe, it, expect } from 'vitest';
import { computeSchemaFingerprint, createTemplate, validateTemplate } from '../../src/template/index.js';
import type { SheetProfile, DashboardSpec } from '@unsheet/contracts';

describe('Template Management & Fingerprinting', () => {
  const sampleProfile: SheetProfile = {
    sheetId: 'sheet_1',
    sheetName: 'Sheet1',
    rowCount: 100,
    columnProfiles: [
      {
        columnKey: 'sales',
        originalName: 'Sales',
        inferredType: 'number',
        semanticRole: 'measure',
        nullable: false,
        nullCount: 0,
        totalCount: 100,
        distinctCount: 50,
        uniquenessRatio: 0.5,
        sampleValues: ['100', '200'],
      },
      {
        columnKey: 'region',
        originalName: 'Region',
        inferredType: 'text',
        semanticRole: 'dimension',
        nullable: true,
        nullCount: 2,
        totalCount: 100,
        distinctCount: 4,
        uniquenessRatio: 0.04,
        sampleValues: ['North', 'South'],
      },
    ],
    recommendedDimensions: ['region'],
    recommendedMeasures: ['sales'],
  };

  const sampleSpec: DashboardSpec = {
    version: '1.0',
    id: 'dash_1',
    title: 'Sales Dashboard',
    description: 'Dashboard overview',
    sheetBinding: 'sheet_1',
    layout: { columns: 12, gap: 16, padding: 16 },
    filters: [],
    widgets: [
      {
        id: 'w_kpi',
        type: 'kpi',
        title: 'Total Sales',
        description: 'Sales KPI',
        grid: { x: 0, y: 0, w: 4, h: 2 },
        measure: 'sales',
        aggregation: 'sum',
      },
    ],
  };

  it('computes deterministic SHA-256 schema fingerprint', () => {
    const fp1 = computeSchemaFingerprint(sampleProfile);
    const fp2 = computeSchemaFingerprint(sampleProfile);

    expect(fp1.hash).toBe(fp2.hash);
    expect(fp1.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(fp1.columnCount).toBe(2);
    expect(fp1.columns[0]?.key).toBe('region'); // sorted alphabetically by key ('region' before 'sales')
    expect(fp1.columns[1]?.key).toBe('sales');
  });

  it('creates and validates a template successfully', () => {
    const template = createTemplate(sampleSpec, sampleProfile, {
      name: 'Sales Overview',
      description: 'Standard sales template',
      category: 'sales',
      tags: ['sales', 'finance'],
    });

    expect(template).toBeDefined();
    expect(template.name).toBe('Sales Overview');
    expect(template.category).toBe('sales');
    expect(template.fingerprint.hash).toBeDefined();
    expect(template.createdAt).toBeDefined();

    const validated = validateTemplate(template);
    expect(validated).toEqual(template);
  });
});
