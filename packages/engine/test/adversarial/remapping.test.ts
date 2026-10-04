import { describe, it, expect } from 'vitest';
import { applyRemappings } from '../../src/drift/remapping.js';
import { validateTemplate } from '../../src/template/template.js';
import { DashboardSpec, Template } from '@unsheet/contracts';

describe('Phase 4 Adversarial Red-Team Suite: Engine & Remapping', () => {
  const validSpec: DashboardSpec = {
    version: '1.0',
    id: 'spec_adv_4',
    title: 'Adversarial Dashboard',
    sheetBinding: 'sheet_1',
    layout: { columns: 12, gap: 16, padding: 16 },
    filters: [
      { id: 'f1', columnKey: 'department', label: 'Dept', type: 'select' }
    ],
    widgets: [
      {
        id: 'w1',
        type: 'kpi',
        title: 'Total Revenue',
        measure: 'revenue',
        aggregation: 'sum',
        grid: { x: 0, y: 0, w: 4, h: 2 }
      }
    ]
  };

  describe('Vector 1: Malformed Template JSON Imports & Oversized Payloads', () => {
    it('ADV-P4-01: Handles malformed JSON gracefully in validateTemplate', () => {
      expect(() => {
        validateTemplate(null);
      }).toThrow();
    });

    it('ADV-P4-02: Rejects oversized strings (>10,000 chars) violating TitleSchema/DescriptionSchema', () => {
      const hugeString = 'A'.repeat(15000);
      const template = {
        id: 't-huge',
        name: hugeString,
        description: hugeString,
        category: 'sales',
        tags: [hugeString],
        fingerprint: {
          hash: '0000000000000000000000000000000000000000000000000000000000000000',
          version: '1.0',
          columnCount: 1,
          columns: [{ key: 'revenue', name: 'Revenue', inferredType: 'number', required: true }]
        },
        isBuiltIn: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        spec: validSpec
      };

      expect(() => validateTemplate(template)).toThrow();
    });

    it('ADV-P4-03: Rejects or sanitizes prototype pollution payloads in template', () => {
      const maliciousData = {
        id: 't-proto',
        name: 'Malicious',
        category: 'sales',
        tags: [],
        fingerprint: { hash: '0', version: '1.0', columnCount: 1, columns: [] },
        isBuiltIn: false,
        createdAt: '',
        updatedAt: '',
        spec: {
          ...validSpec,
          '__proto__': { polluted: true },
          'constructor': { prototype: { polluted: true } }
        }
      };

      try {
        validateTemplate(maliciousData);
      } catch {
        // expected validation rejection
      }
      expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
  });

  describe('Vector 2: Adversarial Column Remappings & Prototype Keys', () => {
    it('ADV-P4-04: Applies remappings with prototype pollution keys safely without mutating Object.prototype', () => {
      const maliciousRemappings = {
        'revenue': 'arr',
        '__proto__': 'pwned',
        'constructor': 'alert',
        'toString': 'hijacked'
      };

      const result = applyRemappings(validSpec, maliciousRemappings);
      expect(result.widgets[0]).toHaveProperty('measure', 'arr');
      expect(({} as Record<string, unknown>).pwned).toBeUndefined();
      expect(({}).toString).toBe(Object.prototype.toString);
    });

    it('ADV-P4-05: Validates hostile remappings against SafeIdentifier schema requirements', () => {
      const hostileRemappings = {
        'revenue': '=cmd|/C calc',
        'department': ''
      };

      expect(() => {
        applyRemappings(validSpec, hostileRemappings);
      }).toThrow();
    });
  });

  describe('Vector 3: Pathological Inputs & Extreme Sheet Profiles', () => {
    it('ADV-P4-06: Handles 5,000 tags and blank template names', () => {
      const manyTags = Array.from({ length: 5000 }, (_, i) => `tag_${i}`);
      const template: Template = {
        id: 't-pathological',
        name: '',
        description: '',
        category: 'sales',
        tags: manyTags,
        fingerprint: {
          hash: '0',
          version: '1.0',
          columnCount: 0,
          columns: []
        },
        isBuiltIn: false,
        createdAt: '',
        updatedAt: '',
        spec: validSpec
      };

      expect(() => validateTemplate(template)).toThrow();
    });

    it('ADV-P4-07: Respects Zod widget limits on large specs', () => {
      const hugeColumns = Array.from({ length: 60 }, (_, i) => `col_${i}`);
      const hugeSpec: DashboardSpec = {
        ...validSpec,
        widgets: hugeColumns.map((col, idx) => ({
          id: `w_${idx}`,
          type: 'kpi',
          title: `KPI ${idx}`,
          measure: col,
          aggregation: 'sum',
          grid: { x: 0, y: idx, w: 4, h: 2 }
        }))
      };

      expect(() => {
        applyRemappings(hugeSpec, {});
      }).toThrow();
    });
  });
});
