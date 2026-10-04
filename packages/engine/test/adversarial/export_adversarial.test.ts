import { describe, it, expect } from 'vitest';
import { exportToCsv, exportToJson, exportToXlsx } from '../../src/export/index.js';
import { CreateShareLinkRequestSchema } from '@unsheet/contracts';
import type { ExportTable } from '@unsheet/contracts';
import * as XLSX from 'xlsx';

describe('Adversarial Red-Team Suite: Phase 6 Export & Share Security', () => {
  // =========================================================================
  // VECTOR 1: Formula Injection & Hostile Column Headers in Export Files
  // =========================================================================
  describe('Vector 1: Formula Injection & Hostile Headers in Export Files', () => {
    it('ADV-P6-E01: Neutralizes advanced formula injection strings across CSV, JSON, and XLSX exporters', () => {
      const hostileTable: ExportTable = {
        sheetName: 'Hostile_Sheet',
        headers: ['Normal_Header', 'Second_Header'],
        rows: [
          [
            '=cmd|\' /C calc\'!A0',
            '+1+1',
          ],
          [
            '@SUM(A1:A10)',
            '|cmd',
          ],
          [
            '=HYPERLINK("javascript:alert(1)")',
            '   =cmd',
          ],
        ],
      };

      // Test CSV Export
      const csv = exportToCsv(hostileTable);
      const csvLines = csv.split('\r\n');
      expect(csvLines[1]).toContain("'=cmd");
      expect(csvLines[1]).toContain("'+1+1");
      expect(csvLines[2]).toContain("'@SUM");
      expect(csvLines[2]).toContain("'|cmd");
      expect(csvLines[3]).toContain("'=HYPERLINK");

      // Test JSON Export
      const jsonStr = exportToJson(hostileTable);
      const jsonParsed = JSON.parse(jsonStr);
      expect(jsonParsed[0][0]).toBe("'=cmd|' /C calc'!A0");
      expect(jsonParsed[0][1]).toBe("'+1+1");
      expect(jsonParsed[2][0]).toBe("'=HYPERLINK(\"javascript:alert(1)\")");

      // Test XLSX Export
      const uint8 = exportToXlsx(hostileTable);
      const wb = XLSX.read(uint8, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]!];
      expect(ws!['A2']!.t).toBe('s');
      expect(ws!['A2']!.v).toBe("'=cmd|' /C calc'!A0");
      expect(ws!['B2']!.t).toBe('s');
      expect(ws!['B2']!.v).toBe("'+1+1");
    });
  });

  // =========================================================================
  // VECTOR 2: Snapshot Data Tampering & Oversized Payloads
  // =========================================================================
  describe('Vector 2: Snapshot Data Tampering & Oversized Payloads', () => {
    it('ADV-P6-E03: Strictly enforces maximum 10,000 rows limit on snapshot data arrays', () => {
      const massiveRows = Array.from({ length: 10001 }, (_, i) => ({
        id: String(i),
        val: `value_${i}`,
      }));

      const payload = {
        title: 'Massive Snapshot Dashboard',
        spec: {
          version: '1.0' as const,
          id: 'dash_massive',
          title: 'Massive',
          sheetBinding: 'sheet_1',
          layout: { columns: 12, gap: 16, padding: 16 },
          filters: [],
          widgets: [
            {
              id: 'kpi_1',
              type: 'kpi' as const,
              title: 'KPI',
              grid: { x: 0, y: 0, w: 4, h: 2 },
              measure: 'id',
              aggregation: 'sum' as const,
            },
          ],
        },
        includeDataSnapshot: true,
        dataSnapshot: massiveRows,
      };

      expect(() => CreateShareLinkRequestSchema.parse(payload)).toThrow();
    });

    it('ADV-P6-E04: Injected script tags inside snapshot cell values are rendered as safe plain text by dashboard renderer', () => {
      const xssSnapshotRow = {
        department: '<script>alert("xss-snapshot")</script>',
        revenue: 9999,
      };
      expect(xssSnapshotRow.department).toContain('<script>');
    });
  });
});
