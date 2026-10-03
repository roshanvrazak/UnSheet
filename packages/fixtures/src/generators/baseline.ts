import ExcelJS from 'exceljs';
import type { GeneratedFixture, GoldenWorkbook } from '../types.js';
import { styleHeaderRow, autoFitColumns, disambiguateHeaders } from './utils.js';

/**
 * Fixture 1: Clean Baseline
 * Single sheet, clean headers on row 1, well-typed rows, zero messiness.
 */
export async function generate01CleanBaseline(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'UnSheet Fixtures Engine';
  wb.created = new Date('2024-01-15T00:00:00.000Z');

  const ws = wb.addWorksheet('Employees');
  const headers = [
    'Employee ID',
    'First Name',
    'Last Name',
    'Department',
    'Hire Date',
    'Salary',
    'Is Active',
  ];

  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  const rawRows = [
    ['EMP-1001', 'Alice', 'Vance', 'Engineering', '2021-03-15', 125000, true],
    ['EMP-1002', 'Marcus', 'Chen', 'Product', '2020-07-01', 115000, true],
    ['EMP-1003', 'Elena', 'Rostova', 'Engineering', '2022-01-10', 130000, true],
    ['EMP-1004', 'David', 'Kim', 'Finance', '2019-11-20', 98000, false],
    ['EMP-1005', 'Sarah', 'Jenkins', 'Design', '2021-09-05', 92000, true],
    ['EMP-1006', 'Tariq', 'Al-Mansoor', 'Engineering', '2023-02-14', 110000, true],
    ['EMP-1007', 'Chloe', 'Dubois', 'Sales', '2018-05-12', 88000, true],
    ['EMP-1008', 'Liam', 'O’Connor', 'Operations', '2022-06-30', 82000, true],
    ['EMP-1009', 'Priya', 'Nair', 'Product', '2020-09-18', 118000, true],
    ['EMP-1010', 'Carlos', 'Mendoza', 'Engineering', '2023-08-01', 105000, true],
    ['EMP-1011', 'Hannah', 'Schmidt', 'Finance', '2017-03-01', 102000, true],
    ['EMP-1012', 'Kenji', 'Sato', 'Design', '2021-11-15', 95000, false],
    ['EMP-1013', 'Zoe', 'Kowalski', 'Sales', '2022-10-01', 91000, true],
    ['EMP-1014', 'Amara', 'Okafor', 'Operations', '2023-04-12', 84000, true],
    ['EMP-1015', 'Gabriel', 'Silva', 'Engineering', '2020-02-28', 135000, true],
  ];

  for (const r of rawRows) {
    const row = ws.addRow(r);
    // Format salary as currency and date as YYYY-MM-DD
    row.getCell(5).numFmt = 'yyyy-mm-dd';
    row.getCell(6).numFmt = '$#,##0';
  }

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys = disambiguateHeaders(headers);
  const rows = rawRows.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: r[3],
    [sanitizedKeys[4]!]: r[4],
    [sanitizedKeys[5]!]: r[5],
    [sanitizedKeys[6]!]: r[6],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '01_clean_baseline',
    fixtureNumber: 1,
    filename: '01_clean_baseline.xlsx',
    format: 'xlsx',
    description: 'Clean single sheet workbook with headers on row 1 and well-typed data rows',
    sheets: [
      {
        sheetName: 'Employees',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          employee_id: 'id',
          first_name: 'text',
          last_name: 'text',
          department: 'category',
          hire_date: 'date',
          salary: 'currency',
          is_active: 'boolean',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'employee_id',
        },
      },
    ],
  };

  return {
    id: '01_clean_baseline',
    number: 1,
    filename: '01_clean_baseline.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 2: Header Offset
 * Title and metadata block in rows 1-3, actual column headers located on row 4.
 */
export async function generate02HeaderOffset(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Q3_Sales');

  // Rows 1-3: metadata banner
  const r1 = ws.addRow(['ACME Industrial Corp - Q3 Regional Performance Summary']);
  r1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: '1F497D' } };

  const r2 = ws.addRow(['Report Generated: 2024-09-30 | Author: Finance Operations']);
  r2.font = { italic: true, color: { argb: '595959' } };

  const r3 = ws.addRow(['Classification: Strictly Internal | Currency: USD']);
  r3.font = { italic: true, color: { argb: '595959' } };

  // Row 4: Column headers
  const headers = ['Region', 'Branch Name', 'Units Sold', 'Gross Revenue', 'Target Met'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow, '2F5597');

  const rawRows = [
    ['North', 'Seattle Alpha', 1420, 355000, true],
    ['North', 'Portland Beta', 980, 245000, false],
    ['North', 'Spokane Gamma', 640, 160000, true],
    ['South', 'Dallas Main', 2150, 537500, true],
    ['South', 'Austin Tech', 1890, 472500, true],
    ['South', 'Houston Port', 1230, 307500, false],
    ['East', 'Boston Central', 1650, 412500, true],
    ['East', 'New York Metro', 3100, 775000, true],
    ['East', 'Philadelphia Bay', 890, 222500, false],
    ['West', 'San Jose Hub', 2400, 600000, true],
    ['West', 'San Francisco Point', 1950, 487500, true],
    ['West', 'Oakland Yard', 780, 195000, false],
  ];

  for (const r of rawRows) {
    const row = ws.addRow(r);
    row.getCell(3).numFmt = '#,##0';
    row.getCell(4).numFmt = '$#,##0';
  }

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys = disambiguateHeaders(headers);
  const rows = rawRows.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: r[3],
    [sanitizedKeys[4]!]: r[4],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '02_header_offset',
    fixtureNumber: 2,
    filename: '02_header_offset.xlsx',
    format: 'xlsx',
    description: 'Header row offset to row 4 with 3 preceding metadata/title rows',
    sheets: [
      {
        sheetName: 'Q3_Sales',
        headers: {
          detectedRowIndex: 3, // 0-indexed row 4
          confidence: 0.95,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          region: 'category',
          branch_name: 'text',
          units_sold: 'number',
          gross_revenue: 'currency',
          target_met: 'boolean',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
      },
    ],
  };

  return {
    id: '02_header_offset',
    number: 2,
    filename: '02_header_offset.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 3: Multi-Row Merged Headers
 * Category headers spanning multiple subheaders on row 1, specific column names on row 2.
 */
export async function generate03MultiRowMergedHeaders(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Regional_Performance');

  // Row 1: Merged categories
  // A1:B1 -> Location, C1:E1 -> Q1 Figures, F1:H1 -> Q2 Figures
  ws.mergeCells('A1:B1');
  ws.getCell('A1').value = 'Location';

  ws.mergeCells('C1:E1');
  ws.getCell('C1').value = 'Q1 Figures';

  ws.mergeCells('F1:H1');
  ws.getCell('F1').value = 'Q2 Figures';

  const r1 = ws.getRow(1);
  styleHeaderRow(r1, '1F497D');

  // Row 2: Subheaders
  const subheaders = ['Country', 'City', 'Target', 'Actual', 'Variance', 'Target', 'Actual', 'Variance'];
  const r2 = ws.addRow(subheaders);
  styleHeaderRow(r2, '2F5597');

  const rawRows = [
    ['United States', 'New York', 500000, 520000, 20000, 550000, 580000, 30000],
    ['United States', 'Chicago', 320000, 310000, -10000, 340000, 350000, 10000],
    ['United States', 'Dallas', 280000, 295000, 15000, 300000, 315000, 15000],
    ['Canada', 'Toronto', 400000, 390000, -10000, 420000, 440000, 20000],
    ['Canada', 'Vancouver', 250000, 260000, 10000, 270000, 285000, 15000],
    ['United Kingdom', 'London', 600000, 640000, 40000, 650000, 690000, 40000],
    ['United Kingdom', 'Manchester', 210000, 205000, -5000, 230000, 225000, -5000],
    ['Germany', 'Frankfurt', 450000, 475000, 25000, 480000, 510000, 30000],
    ['Germany', 'Munich', 380000, 395000, 15000, 400000, 420000, 20000],
    ['France', 'Paris', 520000, 505000, -15000, 540000, 560000, 20000],
  ];

  for (const r of rawRows) {
    const row = ws.addRow(r);
    for (let c = 3; c <= 8; c++) {
      row.getCell(c).numFmt = '$#,##0';
    }
  }

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  // Combined hierarchical keys: Category + Subheader
  const combinedHeaders = [
    'Location Country',
    'Location City',
    'Q1 Figures Target',
    'Q1 Figures Actual',
    'Q1 Figures Variance',
    'Q2 Figures Target',
    'Q2 Figures Actual',
    'Q2 Figures Variance',
  ];
  const sanitizedKeys = disambiguateHeaders(combinedHeaders);

  const rows = rawRows.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: r[3],
    [sanitizedKeys[4]!]: r[4],
    [sanitizedKeys[5]!]: r[5],
    [sanitizedKeys[6]!]: r[6],
    [sanitizedKeys[7]!]: r[7],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '03_multi_row_merged_headers',
    fixtureNumber: 3,
    filename: '03_multi_row_merged_headers.xlsx',
    format: 'xlsx',
    description: 'Multi-row merged hierarchical headers forward-filled and combined across header tiers',
    sheets: [
      {
        sheetName: 'Regional_Performance',
        headers: {
          detectedRowIndex: 1, // Subheader row index
          confidence: 0.92,
          originalHeaders: combinedHeaders,
          sanitizedKeys,
        },
        inferredTypes: {
          location_country: 'category',
          location_city: 'text',
          q1_figures_target: 'currency',
          q1_figures_actual: 'currency',
          q1_figures_variance: 'currency',
          q2_figures_target: 'currency',
          q2_figures_actual: 'currency',
          q2_figures_variance: 'currency',
        },
        rowCount: rows.length,
        columnCount: combinedHeaders.length,
        rows,
        metadata: {
          hasMergedCells: true,
        },
      },
    ],
  };

  return {
    id: '03_multi_row_merged_headers',
    number: 3,
    filename: '03_multi_row_merged_headers.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 4: Subtotal & Grand Total Rows
 * Summary rows interleaved between department sections and grand total at bottom.
 */
export async function generate04SubtotalGrandTotal(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Department_Expenses');

  const headers = ['Department', 'Expense Category', 'Budget', 'Actual', 'Variance'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  // Group 1: Engineering
  ws.addRow(['Engineering', 'Cloud Infrastructure', 60000, 58200, 1800]);
  ws.addRow(['Engineering', 'Hardware & Peripherals', 25000, 27400, -2400]);
  ws.addRow(['Engineering', 'SaaS Subscriptions', 15000, 14500, 500]);
  const sub1 = ws.addRow(['Engineering Subtotal', '', 100000, 100100, -100]);
  sub1.font = { bold: true };
  sub1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E9EEF4' } };

  // Group 2: Marketing
  ws.addRow(['Marketing', 'Paid Digital Ads', 45000, 48000, -3000]);
  ws.addRow(['Marketing', 'Conferences & Sponsorships', 30000, 26500, 3500]);
  ws.addRow(['Marketing', 'Design Agency Retainers', 20000, 19800, 200]);
  const sub2 = ws.addRow(['Marketing Subtotal', '', 95000, 94300, 700]);
  sub2.font = { bold: true };
  sub2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E9EEF4' } };

  // Group 3: Operations
  ws.addRow(['Operations', 'Office Facilities', 35000, 34200, 800]);
  ws.addRow(['Operations', 'Logistics & Courier', 12000, 13100, -1100]);
  const sub3 = ws.addRow(['Operations Subtotal', '', 47000, 47300, -300]);
  sub3.font = { bold: true };
  sub3.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E9EEF4' } };

  // Grand total row
  const gt = ws.addRow(['Grand Total', '', 242000, 241700, 300]);
  gt.font = { bold: true, size: 12 };
  gt.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'D0D7E5' } };

  // Format currency cells
  ws.eachRow((r, rowNumber) => {
    if (rowNumber > 1) {
      r.getCell(3).numFmt = '$#,##0';
      r.getCell(4).numFmt = '$#,##0';
      r.getCell(5).numFmt = '$#,##0;($#,##0);"-"';
    }
  });

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys = disambiguateHeaders(headers);

  // Golden normalized output strips subtotals and grand totals!
  const cleanRows = [
    ['Engineering', 'Cloud Infrastructure', 60000, 58200, 1800],
    ['Engineering', 'Hardware & Peripherals', 25000, 27400, -2400],
    ['Engineering', 'SaaS Subscriptions', 15000, 14500, 500],
    ['Marketing', 'Paid Digital Ads', 45000, 48000, -3000],
    ['Marketing', 'Conferences & Sponsorships', 30000, 26500, 3500],
    ['Marketing', 'Design Agency Retainers', 20000, 19800, 200],
    ['Operations', 'Office Facilities', 35000, 34200, 800],
    ['Operations', 'Logistics & Courier', 12000, 13100, -1100],
  ];

  const rows = cleanRows.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: r[3],
    [sanitizedKeys[4]!]: r[4],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '04_subtotal_grand_total',
    fixtureNumber: 4,
    filename: '04_subtotal_grand_total.xlsx',
    format: 'xlsx',
    description: 'Interleaved subtotal and grand total rows stripped during normalisation to isolate genuine records',
    sheets: [
      {
        sheetName: 'Department_Expenses',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          department: 'category',
          expense_category: 'text',
          budget: 'currency',
          actual: 'currency',
          variance: 'currency',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
      },
    ],
  };

  return {
    id: '04_subtotal_grand_total',
    number: 4,
    filename: '04_subtotal_grand_total.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 5: Blank Spacer Rows & Columns
 * Arbitrary empty rows and columns scattered throughout table.
 */
export async function generate05BlankSpacerRowsCols(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Inventory');

  // Row 1: Completely blank
  ws.addRow([]);

  // Row 2: Headers with blank column D (col 4)
  // Col A is blank, B is SKU, C is Product Name, D is blank, E is Category, F is Stock Level, G is Unit Price
  const rawHeaderRow = ws.addRow(['', 'SKU', 'Product Name', '', 'Category', 'Stock Level', 'Unit Price']);
  styleHeaderRow(rawHeaderRow);

  // Rows 3-4: Data
  ws.addRow(['', 'SKU-001', 'Hex Bolt M8x50', '', 'Fasteners', 1200, 0.45]);
  ws.addRow(['', 'SKU-002', 'Flange Nut M8', '', 'Fasteners', 2400, 0.25]);

  // Row 5: Completely blank spacer row
  ws.addRow([]);

  // Rows 6-7: Data
  ws.addRow(['', 'SKU-003', 'Steel Washer 8mm', '', 'Fasteners', 5000, 0.1]);
  ws.addRow(['', 'SKU-004', 'Safety Goggles UV400', '', 'Safety Gear', 350, 12.5]);

  // Row 8: Completely blank spacer row
  ws.addRow([]);

  // Rows 9-10: Data
  ws.addRow(['', 'SKU-005', 'Nitrile Gloves L (100pk)', '', 'Safety Gear', 180, 18.0]);
  ws.addRow(['', 'SKU-006', 'Ear Protection Earmuffs', '', 'Safety Gear', 95, 24.95]);

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  // Golden output removes blank column and blank spacer rows
  const cleanHeaders = ['SKU', 'Product Name', 'Category', 'Stock Level', 'Unit Price'];
  const sanitizedKeys = disambiguateHeaders(cleanHeaders);

  const cleanRows = [
    ['SKU-001', 'Hex Bolt M8x50', 'Fasteners', 1200, 0.45],
    ['SKU-002', 'Flange Nut M8', 'Fasteners', 2400, 0.25],
    ['SKU-003', 'Steel Washer 8mm', 'Fasteners', 5000, 0.1],
    ['SKU-004', 'Safety Goggles UV400', 'Safety Gear', 350, 12.5],
    ['SKU-005', 'Nitrile Gloves L (100pk)', 'Safety Gear', 180, 18.0],
    ['SKU-006', 'Ear Protection Earmuffs', 'Safety Gear', 95, 24.95],
  ];

  const rows = cleanRows.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: r[3],
    [sanitizedKeys[4]!]: r[4],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '05_blank_spacer_rows_columns',
    fixtureNumber: 5,
    filename: '05_blank_spacer_rows_columns.xlsx',
    format: 'xlsx',
    description: 'Scattered empty spacer rows and empty spacer columns cleanly pruned by normaliser',
    sheets: [
      {
        sheetName: 'Inventory',
        headers: {
          detectedRowIndex: 1, // Row 2 (0-indexed 1)
          confidence: 0.9,
          originalHeaders: cleanHeaders,
          sanitizedKeys,
        },
        inferredTypes: {
          sku: 'id',
          product_name: 'text',
          category: 'category',
          stock_level: 'number',
          unit_price: 'currency',
        },
        rowCount: rows.length,
        columnCount: cleanHeaders.length,
        rows,
        metadata: {
          primaryKey: 'sku',
        },
      },
    ],
  };

  return {
    id: '05_blank_spacer_rows_columns',
    number: 5,
    filename: '05_blank_spacer_rows_columns.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 6: Footnotes & Trailing Notes
 * Comments, disclaimers, asterisks, and audit notes trailing below the data table.
 */
export async function generate06FootnotesTrailingNotes(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Quarterly_Audit');

  const headers = ['Audit ID', 'Facility Location', 'Compliance Score', 'Lead Auditor', 'Audit Status'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  const cleanData = [
    ['AUD-2024-01', 'Austin Plant 1', 94.5, 'Dr. Aris Thorne', 'Passed'],
    ['AUD-2024-02', 'Detroit Assembly', 88.0, 'Sarah O’Malley', 'Passed'],
    ['AUD-2024-03', 'Reno Gigafactory', 67.5, 'Marcus Brody', 'Needs Remediation'],
    ['AUD-2024-04', 'Stuttgart Hub', 96.0, 'Hans Becker', 'Passed'],
    ['AUD-2024-05', 'Tokyo Robotics Lab', 91.5, 'Yuki Tanaka', 'Passed'],
    ['AUD-2024-06', 'Monterrey Foundry', 72.0, 'Elena Rodriguez', 'Needs Remediation'],
    ['AUD-2024-07', 'Manchester Distribution', 85.5, 'Nigel Campbell', 'Passed'],
  ];

  for (const r of cleanData) {
    ws.addRow(r);
  }

  // Trailing footnotes
  ws.addRow([]);
  const fn1 = ws.addRow(['* Note: Facilities scoring below 75.0 require formal corrective action plan within 30 days.']);
  fn1.font = { italic: true, size: 9, color: { argb: '595959' } };

  const fn2 = ws.addRow(['** Confidential compliance record prepared pursuant to ISO 14001:2015 environmental standards.']);
  fn2.font = { italic: true, size: 9, color: { argb: '595959' } };

  const fn3 = ws.addRow(['Report approved by: Global EHS Director on 2024-09-28.']);
  fn3.font = { italic: true, size: 9, color: { argb: '595959' } };

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys = disambiguateHeaders(headers);
  const rows = cleanData.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: r[3],
    [sanitizedKeys[4]!]: r[4],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '06_footnotes_trailing_notes',
    fixtureNumber: 6,
    filename: '06_footnotes_trailing_notes.xlsx',
    format: 'xlsx',
    description: 'Trailing footnotes, disclaimer asterisks, and regulatory approval notes stripped below data boundary',
    sheets: [
      {
        sheetName: 'Quarterly_Audit',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          audit_id: 'id',
          facility_location: 'text',
          compliance_score: 'number',
          lead_auditor: 'text',
          audit_status: 'category',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'audit_id',
          notes: [
            '* Note: Facilities scoring below 75.0 require formal corrective action plan within 30 days.',
            '** Confidential compliance record prepared pursuant to ISO 14001:2015 environmental standards.',
            'Report approved by: Global EHS Director on 2024-09-28.',
          ],
        },
      },
    ],
  };

  return {
    id: '06_footnotes_trailing_notes',
    number: 6,
    filename: '06_footnotes_trailing_notes.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}
