import { Template, DashboardSpec, SheetProfile, TemplateCategory } from '@unsheet/engine';

const LOCAL_STORAGE_KEY = 'unsheet_templates_v1';
let memoryStorage: Record<string, string> = {};

export function loadLocalTemplates(): Template[] {
  try {
    const raw = typeof window !== 'undefined' && window.localStorage ? window.localStorage.getItem(LOCAL_STORAGE_KEY) : memoryStorage[LOCAL_STORAGE_KEY];
    if (!raw) return getDefaultTemplates();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
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
    } catch (e) {
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
    } catch (e) {
      // ignore
    }
  }
  memoryStorage[LOCAL_STORAGE_KEY] = serialized;
}

export function exportTemplateJson(template: Template): string {
  return JSON.stringify(template, null, 2);
}

export function importTemplateJson(jsonString: string): Template {
  const data = JSON.parse(jsonString);
  if (data && data.spec && !data.spec.globalFilters) {
    data.spec.globalFilters = data.spec.globalFilters || [];
  }
  return data as Template;
}

export function getDefaultTemplates(): Template[] {
  return [
    {
      id: 'template-saas-metrics',
      name: 'SaaS ARR & Churn Dashboard',
      description: 'Monthly Recurring Revenue, Churn analysis, and Customer lifetime value breakdown.',
      category: 'saas' as TemplateCategory,
      tags: ['arr', 'churn', 'saas'],
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spec: {
        title: 'SaaS ARR & Churn Dashboard',
        widgets: [
          {
            id: 'w-arr-kpi',
            type: 'kpi',
            title: 'Total ARR',
            measure: 'arr',
            aggregation: 'sum',
            formatting: { style: 'currency', currency: 'USD' },
            layout: { x: 0, y: 0, w: 4, h: 2 }
          },
          {
            id: 'w-arr-line',
            type: 'line',
            title: 'ARR Growth Trend',
            dimension: 'month',
            measure: 'arr',
            aggregation: 'sum',
            layout: { x: 4, y: 0, w: 8, h: 4 }
          }
        ],
        globalFilters: []
      }
    },
    {
      id: 'template-fin-pnl',
      name: 'Financial P&L Summary',
      description: 'Revenue, Operating Expenses, and Net Margins breakdown.',
      category: 'finance' as TemplateCategory,
      tags: ['finance', 'pnl', 'revenue'],
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spec: {
        title: 'Financial P&L Summary',
        widgets: [
          {
            id: 'w-rev-kpi',
            type: 'kpi',
            title: 'Total Revenue',
            measure: 'revenue',
            aggregation: 'sum',
            formatting: { style: 'currency', currency: 'USD' },
            layout: { x: 0, y: 0, w: 6, h: 2 }
          },
          {
            id: 'w-exp-bar',
            type: 'bar',
            title: 'Expenses by Department',
            dimension: 'department',
            measure: 'expense',
            aggregation: 'sum',
            layout: { x: 0, y: 2, w: 12, h: 4 }
          }
        ],
        globalFilters: []
      }
    },
    {
      id: 'template-ops-crm',
      name: 'Operations & CRM Pipeline',
      description: 'Deal stages, conversion rates, and task completion metrics.',
      category: 'operations' as TemplateCategory,
      tags: ['crm', 'pipeline', 'sales'],
      version: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spec: {
        title: 'Operations & CRM Pipeline',
        widgets: [
          {
            id: 'w-deals-kpi',
            type: 'kpi',
            title: 'Active Deals',
            measure: 'deal_id',
            aggregation: 'count',
            layout: { x: 0, y: 0, w: 4, h: 2 }
          },
          {
            id: 'w-stage-donut',
            type: 'donut',
            title: 'Deals by Stage',
            dimension: 'stage',
            measure: 'deal_id',
            aggregation: 'count',
            layout: { x: 4, y: 0, w: 8, h: 4 }
          }
        ],
        globalFilters: []
      }
    }
  ];
}
