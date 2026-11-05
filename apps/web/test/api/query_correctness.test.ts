import { describe, it, expect, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DashboardSpecSchema, type LLMColumnProfile, type SheetModel } from '@unsheet/contracts';
import { formatDisplayValue } from '@/lib/utils';
import { executeQueryInMemory, compileQueryPlanToSql, buildWidgetQueryPlan } from '@unsheet/engine';
import { deterministicAskQuery, deterministicRefineSpec } from '@/lib/llm/fallback';

vi.mock('@/lib/llm/provider', () => ({ resolveLLM: () => ({ model: {}, providerName: 'Mock', modelName: 'test', source: 'header' }) }));
const generateObject = vi.hoisted(() => vi.fn());
vi.mock('ai', () => ({ generateObject }));
import { POST as ask } from '@/app/api/query/ask/route';
import { POST as refine } from '@/app/api/spec/refine/route';

const profiles: LLMColumnProfile[] = [
  { columnKey: 'revenue', originalName: 'Revenue', inferredType: 'number', semanticRole: 'measure', nullable: false, nullCount: 0, totalCount: 3, distinctCount: 2, uniquenessRatio: 2 / 3, sampleValues: ['10', '30'] },
  { columnKey: 'region', originalName: 'Region', inferredType: 'category', semanticRole: 'dimension', nullable: false, nullCount: 0, totalCount: 3, distinctCount: 2, uniquenessRatio: 2 / 3, sampleValues: ['North', 'South'] },
];
const sheet: SheetModel = {
  id: 'sales', name: 'sales', headers: { detectedRowIndex: 0, confidence: 1, originalHeaders: ['revenue', 'region'], sanitizedKeys: ['revenue', 'region'] },
  columns: profiles.map((p, i) => ({ key: p.columnKey, originalName: p.originalName!, columnIndex: i })),
  rows: [{ revenue: 10, region: 'North' }, { revenue: 30, region: 'North' }, { revenue: 50, region: 'South' }], rowCount: 3, columnCount: 2,
};
const spec = DashboardSpecSchema.parse({ version: '1.0', id: 'dash', title: 'Sales', sheetBinding: 'sales', widgets: [{ id: 'bar', type: 'bar', title: 'Revenue', grid: { x: 0, y: 0, w: 6, h: 6 }, dimension: 'region', measures: ['revenue'], aggregation: 'sum' }] });

describe('Demo answer correctness', () => {
  it('formats fractional percentages as percentage points', () => {
    expect(formatDisplayValue(0.6, { suffix: '%', scale: 100, precision: 1 })).toBe('60.0%');
  });
  it('executes an overall average without silently grouping or summing', () => {
    const response = deterministicAskQuery('Average revenue', 'sales', profiles);
    expect(response.sql).toBe(compileQueryPlanToSql(response.queryPlan!));
    expect(executeQueryInMemory(response.queryPlan!, sheet).rows).toEqual([{ revenue: 30 }]);
  });
  it('executes grouped averages and top-N limits consistently', () => {
    const avg = deterministicAskQuery('Average revenue by region', 'sales', profiles);
    expect(executeQueryInMemory(avg.queryPlan!, sheet).rows).toEqual([{ region: 'South', revenue: 50 }, { region: 'North', revenue: 20 }]);
    const top = deterministicAskQuery('Top 1 region by revenue', 'sales', profiles);
    expect(executeQueryInMemory(top.queryPlan!, sheet).rows).toEqual([{ region: 'South', revenue: 50 }]);
    expect(top.suggestedWidget).toMatchObject({ limit: 1 });
  });
  it('returns raw records instead of an unrelated aggregation', () => {
    const response = deterministicAskQuery('Show all records', 'sales', profiles);
    expect(executeQueryInMemory(response.queryPlan!, sheet).rows).toEqual(sheet.rows);
  });
  it('loads every table row for client-side pagination', () => {
    const plan = buildWidgetQueryPlan(sheet, { id: 'table', type: 'table', title: 'Records', grid: { x: 0, y: 0, w: 12, h: 8 }, columns: [{ columnKey: 'revenue', header: 'Revenue' }], pageSize: 1 });
    expect(executeQueryInMemory(plan, sheet).rowCount).toBe(3);
  });
  it('adds a donut without also converting an existing bar', () => {
    const result = deterministicRefineSpec('Add a donut chart by region', spec, profiles);
    expect(result.updatedSpec.widgets.map(w => w.type)).toEqual(['bar', 'donut']);
    expect(deterministicRefineSpec('Change bar chart to donut', spec, profiles).updatedSpec.widgets.map(w => w.type)).toEqual(['donut']);
  });
  it('never attaches an unrelated fallback plan to successful LLM SQL', async () => {
    generateObject.mockResolvedValueOnce({ object: { interpretedIntent: 'Filtered average', sql: 'SELECT AVG("revenue") AS "average" FROM "sales" WHERE "revenue" > 20', explanation: 'Filtered average' } });
    const res = await ask(new NextRequest('http://localhost/api/query/ask', { method: 'POST', body: JSON.stringify({ question: 'Average revenue above 20', sheetName: 'sales', profiles }) }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.sql).toContain('WHERE');
    expect(data.queryPlan).toBeUndefined();
    expect(data.suggestedWidget).toBeUndefined();
  });
  it('provides the current dashboard to the refinement model', async () => {
    generateObject.mockResolvedValueOnce({ object: { updatedSpec: spec, explanation: 'Kept dashboard', appliedChanges: [] } });
    const res = await refine(new NextRequest('http://localhost/api/spec/refine', { method: 'POST', body: JSON.stringify({ prompt: 'Rename dashboard', currentSpec: spec, profiles }) }));
    expect(res.status).toBe(200);
    expect(generateObject.mock.lastCall?.[0].prompt).toContain(JSON.stringify(spec));
  });
});
