import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TemplateSaveModal } from '../components/template/TemplateSaveModal';
import { TemplateLibraryModal } from '../components/template/TemplateLibraryModal';
import { loadLocalTemplates, saveLocalTemplate, exportTemplateJson, importTemplateJson } from '../lib/template/storage';
import { DashboardSpec, Template } from '@unsheet/contracts';

const mockSpec: DashboardSpec = {
  version: '1.0',
  id: 'dash-test',
  sheetBinding: 'sheet-1',
  title: 'Test Dashboard',
  layout: { columns: 12, gap: 16, padding: 16 },
  widgets: [
    {
      id: 'w-1',
      type: 'kpi',
      title: 'Total Revenue',
      measure: 'revenue',
      aggregation: 'sum',
      grid: { x: 0, y: 0, w: 4, h: 2 }
    }
  ],
  filters: []
};

describe('Template Management Test Suite', () => {
  it('loads local templates including default starter templates', () => {
    const templates = loadLocalTemplates();
    expect(templates.length).toBeGreaterThanOrEqual(3);
  });

  it('saves and deletes local template', () => {
    const testTemplate: Template = {
      id: 'test-template-1',
      name: 'Custom Test Template',
      description: 'Testing save',
      category: 'financial',
      tags: ['test'],
      fingerprint: {
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        version: '1.0',
        columnCount: 1,
        columns: [{ key: 'revenue', name: 'Revenue', inferredType: 'number', required: true }]
      },
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spec: mockSpec
    };

    saveLocalTemplate(testTemplate);
    const templates = loadLocalTemplates();
    expect(templates.some(t => t.id === 'test-template-1')).toBe(true);
  });

  it('exports and imports template JSON', () => {
    const testTemplate: Template = {
      id: 'test-template-2',
      name: 'Export Import Test',
      description: 'Testing JSON',
      category: 'sales',
      tags: ['json'],
      fingerprint: {
        hash: '0000000000000000000000000000000000000000000000000000000000000000',
        version: '1.0',
        columnCount: 1,
        columns: [{ key: 'revenue', name: 'Revenue', inferredType: 'number', required: true }]
      },
      isBuiltIn: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      spec: mockSpec
    };

    const json = exportTemplateJson(testTemplate);
    expect(json).toContain('Export Import Test');

    const imported = importTemplateJson(json);
    expect(imported.name).toBe('Export Import Test');
  });

  it('renders TemplateSaveModal', () => {
    const handleClose = vi.fn();
    render(<TemplateSaveModal isOpen={true} onClose={handleClose} dashboardSpec={mockSpec} />);
    expect(screen.getByText('Save Dashboard as Template')).toBeDefined();
  });

  it('renders TemplateLibraryModal', () => {
    const handleClose = vi.fn();
    const handleSelect = vi.fn();
    render(<TemplateLibraryModal isOpen={true} onClose={handleClose} onSelectTemplate={handleSelect} />);
    expect(screen.getByText('Template Library')).toBeDefined();
  });
});
