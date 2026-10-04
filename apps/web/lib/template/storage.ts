import { Template, TemplateCategory, TemplateSchema } from '@unsheet/contracts';

const LOCAL_STORAGE_KEY = 'unsheet_templates_v1';
const memoryStorage: Record<string, string> = {};

export function loadLocalTemplates(): Template[] {
  try {
    const raw = typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(LOCAL_STORAGE_KEY) : memoryStorage[LOCAL_STORAGE_KEY];
    if (!raw) return getDefaultTemplates();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      const validTemplates: Template[] = [];
      for (const item of parsed) {
        const result = TemplateSchema.safeParse(item);
        if (result.success) {
          validTemplates.push(result.data);
        }
      }
      return validTemplates.length > 0 ? validTemplates : getDefaultTemplates();
    }
  } catch (e) {
    console.error('Failed to load local templates', e);
  }
  return getDefaultTemplates();
}

export function saveLocalTemplate(template: Template): void {
  const current = loadLocalTemplates();
  const existingIndex = current.findIndex(t => t.id === template.id);
  let updated: Template[];
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = { ...template, updatedAt: new Date().toISOString() };
  } else {
    updated = [template, ...current];
  }
  const serialized = JSON.stringify(updated);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
    } catch {
      // ignore
    }
  }
  memoryStorage[LOCAL_STORAGE_KEY] = serialized;
}

export function deleteLocalTemplate(id: string): void {
  const current = loadLocalTemplates();
  const updated = current.filter(t => t.id !== id);
  const serialized = JSON.stringify(updated);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, serialized);
    } catch {
      // ignore
    }
  }
  memoryStorage[LOCAL_STORAGE_KEY] = serialized;
}

export function exportTemplateJson(template: Template): string {
  return JSON.stringify(template, null, 2);
}

export function importTemplateJson(jsonString: string): Template {
  if (jsonString.length > 1_048_576) {
    throw new Error('Template file exceeds maximum permitted size of 1MB');
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e: unknown) {
    throw new Error('Invalid JSON: ' + (e instanceof Error ? e.message : 'Failed to parse JSON'));
  }
  if (parsed && typeof parsed === 'object' && 'spec' in parsed) {
    const spec = (parsed as { spec?: Record<string, unknown> }).spec;
    if (spec && !spec.filters) {
      spec.filters = [];
    }
  }
  const result = TemplateSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error('Invalid template structure: ' + result.error.message);
  }
  return result.data;
}

export function getDefaultTemplates(): Template[] {
  return [
    {
      id: 'template-saas-metrics',
      name: 'SaaS ARR & Churn Dashboard',
      description: 'Monthly Recurring Revenue, Churn analysis, and Customer lifetime value breakdown.',
      category: 'sales' as TemplateCategory,
      tags: ['arr', 'churn', 'saas'],
      fingerprint: {
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        version: '1.0',
        columnCount: 2,
        columns: [
          { key: 'arr', name: 'ARR', inferredType: 'number', required: true },
          { key: 'month', name: 'Month', inferredType: 'text', required: true }
        ]
      },
      isBuiltIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spec: {
        version: '1.0',
        id: 'spec-saas',
        sheetBinding: 'sheet-1',
        title: 'SaaS ARR & Churn Dashboard',
        layout: { columns: 12, gap: 16, padding: 16 },
        widgets: [
          {
            id: 'w-arr-kpi',
            type: 'kpi',
            title: 'Total ARR',
            measure: 'arr',
            aggregation: 'sum',
            format: { currency: 'USD' },
            grid: { x: 0, y: 0, w: 4, h: 2 }
          },
          {
            id: 'w-arr-line',
            type: 'line',
            title: 'ARR Growth Trend',
            timeDimension: 'month',
            measures: ['arr'],
            aggregation: 'sum',
            grid: { x: 4, y: 0, w: 8, h: 4 }
          }
        ],
        filters: []
      }
    },
    {
      id: 'template-fin-pnl',
      name: 'Financial P&L Summary',
      description: 'Revenue, Operating Expenses, and Net Margins breakdown.',
      category: 'financial' as TemplateCategory,
      tags: ['finance', 'pnl', 'revenue'],
      fingerprint: {
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        version: '1.0',
        columnCount: 2,
        columns: [
          { key: 'revenue', name: 'Revenue', inferredType: 'number', required: true },
          { key: 'expense', name: 'Expense', inferredType: 'number', required: true }
        ]
      },
      isBuiltIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spec: {
        version: '1.0',
        id: 'spec-fin',
        sheetBinding: 'sheet-1',
        title: 'Financial P&L Summary',
        layout: { columns: 12, gap: 16, padding: 16 },
        widgets: [
          {
            id: 'w-rev-kpi',
            type: 'kpi',
            title: 'Total Revenue',
            measure: 'revenue',
            aggregation: 'sum',
            format: { currency: 'USD' },
            grid: { x: 0, y: 0, w: 6, h: 2 }
          },
          {
            id: 'w-exp-bar',
            type: 'bar',
            title: 'Expenses by Department',
            dimension: 'department',
            measures: ['expense'],
            aggregation: 'sum',
            grid: { x: 0, y: 2, w: 12, h: 4 }
          }
        ],
        filters: []
      }
    },
    {
      id: 'template-ops-crm',
      name: 'Operations & CRM Pipeline',
      description: 'Deal stages, conversion rates, and task completion metrics.',
      category: 'operations' as TemplateCategory,
      tags: ['crm', 'pipeline', 'sales'],
      fingerprint: {
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        version: '1.0',
        columnCount: 2,
        columns: [
          { key: 'deal_id', name: 'Deal ID', inferredType: 'id', required: true },
          { key: 'stage', name: 'Stage', inferredType: 'text', required: true }
        ]
      },
      isBuiltIn: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spec: {
        version: '1.0',
        id: 'spec-ops',
        sheetBinding: 'sheet-1',
        title: 'Operations & CRM Pipeline',
        layout: { columns: 12, gap: 16, padding: 16 },
        widgets: [
          {
            id: 'w-deals-kpi',
            type: 'kpi',
            title: 'Active Deals',
            measure: 'deal_id',
            aggregation: 'count',
            grid: { x: 0, y: 0, w: 4, h: 2 }
          },
          {
            id: 'w-stage-donut',
            type: 'donut',
            title: 'Deals by Stage',
            dimension: 'stage',
            measure: 'deal_id',
            aggregation: 'count',
            grid: { x: 4, y: 0, w: 8, h: 4 }
          }
        ],
        filters: []
      }
    }
  ];
}
