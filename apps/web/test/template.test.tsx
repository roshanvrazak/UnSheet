import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateSaveModal } from '../components/template/TemplateSaveModal';
import { TemplateLibraryModal } from '../components/template/TemplateLibraryModal';
import { loadLocalTemplates, saveLocalTemplate, exportTemplateJson, importTemplateJson } from '../lib/template/storage';
import { DashboardSpec, Template } from '@unsheet/engine';

const mockSpec: DashboardSpec = {
  title: 'Test Dashboard',
  widgets: [
    {
      id: 'w-1',
      type: 'kpi',
      title: 'Total Revenue',
      measure: 'revenue',
      aggregation: 'sum',
      layout: { x: 0, y: 0, w: 4, h: 2 }
    }
  ],
  globalFilters: []
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
      category: 'custom',
      tags: ['test'],
      version: '1.0.0',
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
      category: 'custom',
      tags: ['json'],
      version: '1.0.0',
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
