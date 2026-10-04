import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { exportToCsv, exportToJson, exportToXlsx } from '../../src/export/index.js';
import type { ExportTable } from '@unsheet/contracts';
import * as XLSX from 'xlsx';

describe('Export Engine', () => {
  const sampleTable: ExportTable = {
    sheetName: 'Sheet1',
    headers: ['Name', 'Formula', 'Value'],
    rows: [
      ['Alice', String.raw`=cmd|' /C calc'!A0`, 100],
      ['Bob', String.raw`=HYPERLINK("http://evil.com","Phish")`, 200],
      ['Charlie', '+12345', 300],
      ['Dave', '-999', 400],
      ['Eve', '@SUM(A1:A10)', 500],
      ['Frank', '\t=danger', 600],
      ['Grace', '|dangerous_pipe', 700],
    ],
  };

  it('exports CSV with hostile cells neutralized and RFC 4180 compliance', () => {
    const csv = exportToCsv(sampleTable);
    const lines = csv.split('\r\n');

    expect(lines[0]).toBe('Name,Formula,Value');
    expect(lines[1]).toBe(`Alice,'=cmd|' /C calc'!A0,100`);
    expect(lines[2]).toBe(`Bob,"'=HYPERLINK(""http://evil.com"",""Phish"")",200`);
    expect(lines[3]).toBe(`Charlie,'+12345,300`);
    expect(lines[4]).toBe(`Dave,'-999,400`);
    expect(lines[5]).toBe(`Eve,'@SUM(A1:A10),500`);
    expect(lines[6]).toBe(`Frank,'\t=danger,600`);
    expect(lines[7]).toBe(`Grace,'|dangerous_pipe,700`);
  });

  it('exports JSON with neutralized string cells', () => {
    const jsonStr = exportToJson(sampleTable);
    const parsed = JSON.parse(jsonStr);

    expect(parsed[0][1]).toBe(String.raw`'=cmd|' /C calc'!A0`);
    expect(parsed[2][1]).toBe("'+12345");
  });

  it('exports XLSX generating valid Uint8Array with neutralized cells', () => {
    const uint8 = exportToXlsx(sampleTable);
    expect(uint8).toBeInstanceOf(Uint8Array);
    expect(uint8.length).toBeGreaterThan(0);

    const wb = XLSX.read(uint8, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    expect(sheetName).toBeDefined();
    const ws = wb.Sheets[sheetName!];
    expect(ws).toBeDefined();
    const cellB2 = ws!['B2'];
    expect(cellB2).toBeDefined();
    expect(cellB2!.t).toBe('s');
    expect(cellB2!.v).toBe(String.raw`'=cmd|' /C calc'!A0`);

    const cellB4 = ws!['B4'];
    expect(cellB4).toBeDefined();
    expect(cellB4!.t).toBe('s');
    expect(cellB4!.v).toBe("'+12345");
  });

  it('supports Record<string, unknown> rows in CSV export', () => {
    const recordTable: ExportTable = {
      sheetName: 'Sheet1',
      headers: ['colA', 'colB'],
      rows: [
        { colA: 'hello', colB: '=formula' },
      ],
    };
    const csv = exportToCsv(recordTable);
    expect(csv).toContain('colA,colB');
    expect(csv).toContain(`hello,'=formula`);
  });

  it('strict property test for formula neutralization', () => {
    const triggers = ['=', '+', '-', '@', '\t', '\r', '\n', '|'];
    fc.assert(
      fc.property(
        fc.string(),
        (str) => {
          const table: ExportTable = {
            sheetName: 'Test',
            headers: ['Col'],
            rows: [[str]],
          };
          const csv = exportToCsv(table);
          const trimmed = str.trimStart();
          const hasTrigger = triggers.some((t) => trimmed.startsWith(t));
          if (hasTrigger) {
            const neutralized = `'${str}`;
            if (neutralized.includes(',') || neutralized.includes('"') || neutralized.includes('\n') || neutralized.includes('\r')) {
              expect(csv).toContain(`"${neutralized.replace(/"/g, '""')}"`);
            } else {
              expect(csv).toContain(neutralized);
            }
          }
          return true;
        }
      )
    );
  });
});
