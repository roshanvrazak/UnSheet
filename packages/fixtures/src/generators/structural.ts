import ExcelJS from 'exceljs';
import type { GeneratedFixture, GoldenWorkbook } from '../types.js';
import { styleHeaderRow, autoFitColumns, disambiguateHeaders } from './utils.js';

/**
 * Fixture 13: Hidden Sheets and Columns
 * Sheet and column visibility flags set to hidden in workbook XML.
 */
export async function generate13HiddenSheetsColumns(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: Active Roster (contains hidden columns)
  const ws1 = wb.addWorksheet('Active_Roster');
  const headers1 = ['Employee ID', 'Full Name', 'Department', 'National ID', 'Base Salary', 'Security Level'];
  const headerRow1 = ws1.addRow(headers1);
  styleHeaderRow(headerRow1);

  const rawRows1 = [
    ['EMP-01', 'Jordan Hayes', 'Engineering', '999-12-4011', 145000, 'Secret'],
    ['EMP-02', 'Morgan Taylor', 'Research', '999-34-8822', 160000, 'Top Secret'],
    ['EMP-03', 'Casey Morgan', 'Operations', '999-56-1199', 85000, 'Confidential'],
    ['EMP-04', 'Riley Vance', 'Product', '999-78-3344', 120000, 'Secret'],
    ['EMP-05', 'Quinn Alvarez', 'Security', '999-90-5566', 135000, 'Top Secret'],
  ];

  for (const r of rawRows1) {
    ws1.addRow(r);
  }

  // Hide columns 4 (National ID) and 5 (Base Salary)
  ws1.getColumn(4).hidden = true;
  ws1.getColumn(5).hidden = true;
  autoFitColumns(ws1);

  // Sheet 2: Confidential Payroll (hidden sheet)
  const ws2 = wb.addWorksheet('Confidential_Payroll');
  ws2.state = 'hidden';
  const headers2 = ['Record Ref', 'Employee ID', 'Bonus Allocation', 'Equity Units'];
  const headerRow2 = ws2.addRow(headers2);
  styleHeaderRow(headerRow2, '800000');

  const rawRows2 = [
    ['REC-P01', 'EMP-01', 25000, 1000],
    ['REC-P02', 'EMP-02', 35000, 1500],
    ['REC-P03', 'EMP-03', 12000, 500],
    ['REC-P04', 'EMP-04', 20000, 800],
    ['REC-P05', 'EMP-05', 28000, 1200],
  ];

  for (const r of rawRows2) {
    ws2.addRow(r);
  }
  autoFitColumns(ws2);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys1 = disambiguateHeaders(headers1);
  const rows1 = rawRows1.map((r) => ({
    [sanitizedKeys1[0]!]: r[0],
    [sanitizedKeys1[1]!]: r[1],
    [sanitizedKeys1[2]!]: r[2],
    [sanitizedKeys1[3]!]: r[3],
    [sanitizedKeys1[4]!]: r[4],
    [sanitizedKeys1[5]!]: r[5],
  }));

  const sanitizedKeys2 = disambiguateHeaders(headers2);
  const rows2 = rawRows2.map((r) => ({
    [sanitizedKeys2[0]!]: r[0],
    [sanitizedKeys2[1]!]: r[1],
    [sanitizedKeys2[2]!]: r[2],
    [sanitizedKeys2[3]!]: r[3],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '13_hidden_sheets_and_columns',
    fixtureNumber: 13,
    filename: '13_hidden_sheets_and_columns.xlsx',
    format: 'xlsx',
    description: 'Workbook with hidden columns (PII/Salary) and a hidden secondary payroll worksheet',
    sheets: [
      {
        sheetName: 'Active_Roster',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers1,
          sanitizedKeys: sanitizedKeys1,
        },
        inferredTypes: {
          employee_id: 'id',
          full_name: 'text',
          department: 'category',
          national_id: 'text',
          base_salary: 'currency',
          security_level: 'category',
        },
        rowCount: rows1.length,
        columnCount: headers1.length,
        rows: rows1,
        metadata: {
          primaryKey: 'employee_id',
          hiddenColumns: ['national_id', 'base_salary'],
          hiddenSheet: false,
        },
      },
      {
        sheetName: 'Confidential_Payroll',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers2,
          sanitizedKeys: sanitizedKeys2,
        },
        inferredTypes: {
          record_ref: 'id',
          employee_id: 'id',
          bonus_allocation: 'currency',
          equity_units: 'number',
        },
        rowCount: rows2.length,
        columnCount: headers2.length,
        rows: rows2,
        metadata: {
          primaryKey: 'record_ref',
          hiddenSheet: true,
        },
      },
    ],
  };

  return {
    id: '13_hidden_sheets_and_columns',
    number: 13,
    filename: '13_hidden_sheets_and_columns.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 14: Duplicate Header Names
 * Multiple columns sharing identical labels ('Status', 'Target', 'Date', etc.).
 */
export async function generate14DuplicateHeaders(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Quarterly_Milestones');

  const headers = ['Department', 'Lead', 'Status', 'Target', 'Status', 'Score', 'Target', 'Status'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  const rawRows = [
    ['Engineering', 'Dev Lead A', 'Active', 100, 'Green', 95, 120, 'On Schedule'],
    ['Product', 'PM Lead B', 'Planning', 80, 'Yellow', 72, 85, 'Pending Review'],
    ['Security', 'SecOps Lead C', 'Active', 50, 'Green', 50, 55, 'On Schedule'],
    ['Design', 'UX Lead D', 'Blocked', 40, 'Red', 28, 45, 'Delayed'],
    ['Data Ops', 'Data Lead E', 'Active', 90, 'Green', 88, 95, 'On Schedule'],
  ];

  for (const r of rawRows) {
    ws.addRow(r);
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
    [sanitizedKeys[7]!]: r[7],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '14_duplicate_header_names',
    fixtureNumber: 14,
    filename: '14_duplicate_header_names.xlsx',
    format: 'xlsx',
    description: 'Duplicate header names disambiguated with deterministic sequential numeric suffixes',
    sheets: [
      {
        sheetName: 'Quarterly_Milestones',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          department: 'category',
          lead: 'text',
          status: 'category',
          target: 'number',
          status_1: 'category',
          score: 'number',
          target_1: 'number',
          status_2: 'category',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
      },
    ],
  };

  return {
    id: '14_duplicate_header_names',
    number: 14,
    filename: '14_duplicate_header_names.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 15: Multi-Sheet with Foreign Join Keys
 * Multiple sheets linked via foreign key relations (customers -> orders -> order_items).
 */
export async function generate15MultiSheetJoinKeys(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();

  // Sheet 1: customers
  const ws1 = wb.addWorksheet('customers');
  const headers1 = ['customer_id', 'company_name', 'country', 'account_tier'];
  const hRow1 = ws1.addRow(headers1);
  styleHeaderRow(hRow1);

  const rawCustomers = [
    ['CUST-001', 'Astra Dynamics', 'Germany', 'Enterprise'],
    ['CUST-002', 'Borealis Energy', 'Norway', 'Strategic'],
    ['CUST-003', 'Caspian Shipping', 'Greece', 'Mid-Market'],
    ['CUST-004', 'Delta Robotics', 'Japan', 'Enterprise'],
    ['CUST-005', 'Echo Telemetry', 'United States', 'Standard'],
  ];
  for (const c of rawCustomers) ws1.addRow(c);
  autoFitColumns(ws1);

  // Sheet 2: orders
  const ws2 = wb.addWorksheet('orders');
  const headers2 = ['order_id', 'customer_id', 'order_date', 'order_status', 'total_amount'];
  const hRow2 = ws2.addRow(headers2);
  styleHeaderRow(hRow2);

  const rawOrders = [
    ['ORD-501', 'CUST-001', '2024-01-12', 'Fulfilled', 45000.0],
    ['ORD-502', 'CUST-001', '2024-02-18', 'Fulfilled', 32000.0],
    ['ORD-503', 'CUST-002', '2024-02-24', 'Processing', 89000.0],
    ['ORD-504', 'CUST-003', '2024-03-05', 'Fulfilled', 15400.0],
    ['ORD-505', 'CUST-004', '2024-03-12', 'Fulfilled', 120000.0],
    ['ORD-506', 'CUST-005', '2024-03-20', 'Shipped', 8500.0],
  ];
  for (const o of rawOrders) {
    const r = ws2.addRow(o);
    r.getCell(5).numFmt = '$#,##0.00';
  }
  autoFitColumns(ws2);

  // Sheet 3: order_items
  const ws3 = wb.addWorksheet('order_items');
  const headers3 = ['item_id', 'order_id', 'sku_code', 'quantity', 'unit_price'];
  const hRow3 = ws3.addRow(headers3);
  styleHeaderRow(hRow3);

  const rawItems = [
    ['ITEM-101', 'ORD-501', 'SKU-TURB-01', 2, 15000.0],
    ['ITEM-102', 'ORD-501', 'SKU-CTRL-09', 3, 5000.0],
    ['ITEM-103', 'ORD-502', 'SKU-VALV-44', 8, 4000.0],
    ['ITEM-104', 'ORD-503', 'SKU-GENR-88', 1, 89000.0],
    ['ITEM-105', 'ORD-504', 'SKU-HOSE-12', 20, 770.0],
    ['ITEM-106', 'ORD-505', 'SKU-ROBOT-02', 4, 30000.0],
    ['ITEM-107', 'ORD-506', 'SKU-SENS-77', 10, 850.0],
  ];
  for (const item of rawItems) {
    const r = ws3.addRow(item);
    r.getCell(5).numFmt = '$#,##0.00';
  }
  autoFitColumns(ws3);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const keys1 = disambiguateHeaders(headers1);
  const rows1 = rawCustomers.map((r) => ({
    [keys1[0]!]: r[0],
    [keys1[1]!]: r[1],
    [keys1[2]!]: r[2],
    [keys1[3]!]: r[3],
  }));

  const keys2 = disambiguateHeaders(headers2);
  const rows2 = rawOrders.map((r) => ({
    [keys2[0]!]: r[0],
    [keys2[1]!]: r[1],
    [keys2[2]!]: r[2],
    [keys2[3]!]: r[3],
    [keys2[4]!]: r[4],
  }));

  const keys3 = disambiguateHeaders(headers3);
  const rows3 = rawItems.map((r) => ({
    [keys3[0]!]: r[0],
    [keys3[1]!]: r[1],
    [keys3[2]!]: r[2],
    [keys3[3]!]: r[3],
    [keys3[4]!]: r[4],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '15_multisheet_join_keys',
    fixtureNumber: 15,
    filename: '15_multisheet_join_keys.xlsx',
    format: 'xlsx',
    description: 'Relational 3-sheet schema linked by primary-foreign key relationships',
    sheets: [
      {
        sheetName: 'customers',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers1,
          sanitizedKeys: keys1,
        },
        inferredTypes: {
          customer_id: 'id',
          company_name: 'text',
          country: 'category',
          account_tier: 'category',
        },
        rowCount: rows1.length,
        columnCount: headers1.length,
        rows: rows1,
        metadata: {
          primaryKey: 'customer_id',
        },
      },
      {
        sheetName: 'orders',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers2,
          sanitizedKeys: keys2,
        },
        inferredTypes: {
          order_id: 'id',
          customer_id: 'id',
          order_date: 'date',
          order_status: 'category',
          total_amount: 'currency',
        },
        rowCount: rows2.length,
        columnCount: headers2.length,
        rows: rows2,
        metadata: {
          primaryKey: 'order_id',
          foreignKeys: [
            {
              column: 'customer_id',
              targetSheet: 'customers',
              targetColumn: 'customer_id',
            },
          ],
        },
      },
      {
        sheetName: 'order_items',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers3,
          sanitizedKeys: keys3,
        },
        inferredTypes: {
          item_id: 'id',
          order_id: 'id',
          sku_code: 'id',
          quantity: 'number',
          unit_price: 'currency',
        },
        rowCount: rows3.length,
        columnCount: headers3.length,
        rows: rows3,
        metadata: {
          primaryKey: 'item_id',
          foreignKeys: [
            {
              column: 'order_id',
              targetSheet: 'orders',
              targetColumn: 'order_id',
            },
          ],
        },
      },
    ],
  };

  return {
    id: '15_multisheet_join_keys',
    number: 15,
    filename: '15_multisheet_join_keys.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 16: Wide Extreme
 * 160 columns (exceeding standard 150+ columns stress test threshold).
 */
export async function generate16WideExtreme(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Wide_Telemetry');

  const columnCount = 160;
  const headers: string[] = ['device_id', 'timestamp'];
  for (let c = 3; c <= columnCount; c++) {
    const pad = String(c - 2).padStart(3, '0');
    headers.push(`channel_${pad}`);
  }

  const hRow = ws.addRow(headers);
  styleHeaderRow(hRow);

  const rowCount = 12;
  const rawRows: Array<Array<string | number>> = [];

  for (let r = 1; r <= rowCount; r++) {
    const rowData: Array<string | number> = [
      `DEV-${String(r).padStart(3, '0')}`,
      `2024-03-01T${String(10 + r).padStart(2, '0')}:00:00Z`,
    ];
    for (let c = 3; c <= columnCount; c++) {
      // Deterministic synthetic telemetry float
      const val = Math.round((Math.sin(r + c * 0.1) * 50 + 50) * 100) / 100;
      rowData.push(val);
    }
    rawRows.push(rowData);
    ws.addRow(rowData);
  }

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys = disambiguateHeaders(headers);
  const rows = rawRows.map((r) => {
    const record: Record<string, unknown> = {};
    for (let i = 0; i < columnCount; i++) {
      record[sanitizedKeys[i]!] = r[i];
    }
    return record;
  });

  const inferredTypes: Record<string, 'id' | 'date' | 'number'> = {
    device_id: 'id',
    timestamp: 'date',
  };
  for (let i = 2; i < columnCount; i++) {
    inferredTypes[sanitizedKeys[i]!] = 'number';
  }

  const golden: GoldenWorkbook = {
    fixtureId: '16_wide_extreme',
    fixtureNumber: 16,
    filename: '16_wide_extreme.xlsx',
    format: 'xlsx',
    description: 'Wide table stress test containing 160 columns of telemetry channels',
    sheets: [
      {
        sheetName: 'Wide_Telemetry',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes,
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'device_id',
        },
      },
    ],
  };

  return {
    id: '16_wide_extreme',
    number: 16,
    filename: '16_wide_extreme.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 17: Tall Extreme
 * 10,005 rows (exceeding standard 10,000+ rows stress test threshold).
 */
export async function generate17TallExtreme(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('High_Volume_Transactions');

  const headers = ['txn_id', 'account_no', 'txn_type', 'amount', 'currency', 'timestamp', 'status'];
  const hRow = ws.addRow(headers);
  styleHeaderRow(hRow);

  const rowCount = 10005;
  const rawRows: Array<Array<string | number>> = [];
  const txnTypes = ['CREDIT', 'DEBIT', 'TRANSFER', 'REFUND'];
  const statuses = ['SETTLED', 'PENDING', 'FLAGGED'];

  for (let i = 1; i <= rowCount; i++) {
    const txnId = `TXN-${String(i).padStart(7, '0')}`;
    const acctNo = `ACCT-${String((i % 500) + 1).padStart(4, '0')}`;
    const txnType = txnTypes[i % 4]!;
    const amount = Math.round(((i * 17) % 5000 + 10.5) * 100) / 100;
    const currency = 'USD';
    const hour = String(i % 24).padStart(2, '0');
    const min = String((i * 3) % 60).padStart(2, '0');
    const timestamp = `2024-03-15T${hour}:${min}:00Z`;
    const status = statuses[i % 3]!;

    const r = [txnId, acctNo, txnType, amount, currency, timestamp, status];
    rawRows.push(r);
    ws.addRow(r);
  }

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
    fixtureId: '17_tall_extreme',
    fixtureNumber: 17,
    filename: '17_tall_extreme.xlsx',
    format: 'xlsx',
    description: 'Tall table stress test containing 10,005 synthetic financial transactions',
    sheets: [
      {
        sheetName: 'High_Volume_Transactions',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          txn_id: 'id',
          account_no: 'id',
          txn_type: 'category',
          amount: 'currency',
          currency: 'category',
          timestamp: 'date',
          status: 'category',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'txn_id',
        },
      },
    ],
  };

  return {
    id: '17_tall_extreme',
    number: 17,
    filename: '17_tall_extreme.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 18: Unicode & RTL Headers
 * Multilingual, non-ASCII, Arabic (RTL), Hebrew (RTL), Chinese, Russian, accented characters, and emoji.
 */
export async function generate18UnicodeRtlHeaders(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('International_Data');

  const headers = [
    'المعرف', // Arabic: ID
    'שם_המוצר', // Hebrew: Product Name
    '项目名称', // Chinese: Project Name
    'Категория', // Russian: Category
    'Café_Coût_EUR', // French Accented
    '🚀_Launch_Date', // Emoji
    '⭐_Rating', // Emoji
  ];

  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  const rawRows = [
    ['AR-101', 'סורק לייזר', '太阳能发电厂', 'Оборудование', 1250.5, '2024-06-01', 4.8],
    ['AR-102', 'בקר חכם', '智慧城市网格', 'Электроника', 890.0, '2024-07-15', 4.5],
    ['AR-103', 'משאבת ואקום', '深水钻井平台', 'Гидравлика', 3400.75, '2024-08-20', 4.9],
    ['AR-104', 'מערכת ניווט', '低空货运无人机', 'Авионика', 5200.0, '2024-09-10', 4.2],
    ['AR-105', 'חיישן טמפרטורה', '工业物联网网关', 'Сенсоры', 175.25, '2024-10-05', 4.7],
  ];

  for (const r of rawRows) {
    ws.addRow(r);
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
    fixtureId: '18_unicode_rtl_headers',
    fixtureNumber: 18,
    filename: '18_unicode_rtl_headers.xlsx',
    format: 'xlsx',
    description: 'International multilingual and RTL headers safely converted into valid ASCII SafeIdentifiers',
    sheets: [
      {
        sheetName: 'International_Data',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          [sanitizedKeys[0]!]: 'id',
          [sanitizedKeys[1]!]: 'text',
          [sanitizedKeys[2]!]: 'text',
          [sanitizedKeys[3]!]: 'category',
          [sanitizedKeys[4]!]: 'currency',
          [sanitizedKeys[5]!]: 'date',
          [sanitizedKeys[6]!]: 'number',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
      },
    ],
  };

  return {
    id: '18_unicode_rtl_headers',
    number: 18,
    filename: '18_unicode_rtl_headers.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}
