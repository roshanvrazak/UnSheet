import ExcelJS from 'exceljs';
import type { GeneratedFixture, GoldenWorkbook } from '../types.js';
import {
  styleHeaderRow,
  autoFitColumns,
  disambiguateHeaders,
  serial1900ToIsoDate,
  serial1904ToIsoDate,
} from './utils.js';

/**
 * Fixture 7: Mixed Data Types
 * Numbers, strings, booleans, and dates mixed within the exact same column.
 */
export async function generate07MixedDataTypes(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Telemetry_Log');

  const headers = ['Record ID', 'Sensor Name', 'Reading Value', 'Unit', 'Quality Flag'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  // Mixed data in 'Reading Value' column:
  // Row 1: number (42.5)
  // Row 2: string ("OFFLINE")
  // Row 3: number (18.2)
  // Row 4: string ("< 0.01")
  // Row 5: boolean (false)
  // Row 6: string ("ERR_TIMEOUT")
  // Row 7: number (99.0)
  // Row 8: string ("N/A")
  // Row 9: string date ("2024-01-01")
  // Row 10: number (0)
  const rawRows = [
    ['REC-001', 'Thermal Sensor A', 42.5, 'Celsius', 'Valid'],
    ['REC-002', 'Pressure Sensor B', 'OFFLINE', 'PSI', 'Sensor Fault'],
    ['REC-003', 'Flow Meter C', 18.2, 'L/min', 'Valid'],
    ['REC-004', 'Particulate Counter D', '< 0.01', 'ppm', 'Below Threshold'],
    ['REC-005', 'Vibration Monitor E', false, 'mm/s', 'Zero Signal'],
    ['REC-006', 'Humidity Sensor F', 'ERR_TIMEOUT', '%RH', 'Comm Error'],
    ['REC-007', 'Voltage Monitor G', 99.0, 'Volts', 'Valid'],
    ['REC-008', 'Radiation Detector H', 'N/A', 'uSv/h', 'Not Applicable'],
    ['REC-009', 'Calendar Clock I', '2024-01-01', 'Timestamp', 'Clock Sync'],
    ['REC-010', 'Acoustic Sensor J', 0, 'dB', 'Valid'],
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
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '07_mixed_data_types',
    fixtureNumber: 7,
    filename: '07_mixed_data_types.xlsx',
    format: 'xlsx',
    description: 'Column with mixed data types (numbers, booleans, string codes, thresholds) classified safely as text',
    sheets: [
      {
        sheetName: 'Telemetry_Log',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          record_id: 'id',
          sensor_name: 'text',
          reading_value: 'text', // Mixed values infer to text to preserve fidelity
          unit: 'category',
          quality_flag: 'category',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'record_id',
        },
      },
    ],
  };

  return {
    id: '07_mixed_data_types',
    number: 7,
    filename: '07_mixed_data_types.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 8: Excel Serial Dates (1900 System)
 * Numeric dates under the default Windows Excel 1900 date system (e.g. 45200 = 2023-10-01).
 */
export async function generate08ExcelSerialDates1900(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  wb.properties.date1904 = false;

  const ws = wb.addWorksheet('Schedule_1900');
  const headers = ['Milestone Code', 'Task Description', 'Target Serial', 'Planned Date', 'Duration Days'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  const rawRows: Array<[string, string, number, Date, number]> = [
    ['MS-01', 'Groundbreaking & Site Prep', 45200, new Date('2023-10-01T00:00:00.000Z'), 30],
    ['MS-02', 'Foundation Pouring', 45292, new Date('2024-01-01T00:00:00.000Z'), 45],
    ['MS-03', 'Steel Framing Assembly', 45352, new Date('2024-03-01T00:00:00.000Z'), 60],
    ['MS-04', 'Roofing and Envelope Sealing', 45474, new Date('2024-07-01T00:00:00.000Z'), 40],
    ['MS-05', 'MEP Rough-in', 45535, new Date('2024-08-31T00:00:00.000Z'), 50],
    ['MS-06', 'Interior Drywall & Finishes', 45596, new Date('2024-10-31T00:00:00.000Z'), 35],
    ['MS-07', 'Final Inspection & Handover', 45657, new Date('2024-12-31T00:00:00.000Z'), 14],
  ];

  for (const r of rawRows) {
    const row = ws.addRow([r[0], r[1], r[2], r[3], r[4]]);
    // col 3 is raw serial integer, col 4 is Excel formatted date cell
    row.getCell(3).numFmt = '0';
    row.getCell(4).numFmt = 'yyyy-mm-dd';
  }

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys = disambiguateHeaders(headers);
  const rows = rawRows.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: serial1900ToIsoDate(r[2]),
    [sanitizedKeys[3]!]: r[3].toISOString().split('T')[0],
    [sanitizedKeys[4]!]: r[4],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '08_excel_serial_dates_1900',
    fixtureNumber: 8,
    filename: '08_excel_serial_dates_1900.xlsx',
    format: 'xlsx',
    description: 'Excel 1900 date epoch serial numbers correctly normalized to ISO 8601 dates',
    sheets: [
      {
        sheetName: 'Schedule_1900',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          milestone_code: 'id',
          task_description: 'text',
          target_serial: 'date',
          planned_date: 'date',
          duration_days: 'number',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'milestone_code',
          dateSystem: '1900',
        },
      },
    ],
  };

  return {
    id: '08_excel_serial_dates_1900',
    number: 8,
    filename: '08_excel_serial_dates_1900.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 9: Excel Serial Dates (1904 System)
 * Numeric dates under the Mac Excel 1904 date system (1462-day epoch shift).
 */
export async function generate09ExcelSerialDates1904(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  // Enable 1904 date system property in workbook XML
  wb.properties.date1904 = true;

  const ws = wb.addWorksheet('Schedule_1904');
  const headers = ['Contract ID', 'Vendor Name', 'Execution Serial', 'Formatted Date', 'Contract Value'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  // In 1904 system, date serial 0 is 1904-01-01.
  // 2023-10-01 is serial 43738 (45200 - 1462).
  // 2024-01-01 is serial 43830.
  // 2024-04-01 is serial 43921.
  // 2024-07-01 is serial 44012.
  // 2024-10-01 is serial 44104.
  const rawRows: Array<[string, string, number, Date, number]> = [
    ['CTR-801', 'Krupp Industrial', 43738, new Date('2023-10-01T00:00:00.000Z'), 1200000],
    ['CTR-802', 'Vortex Dynamics', 43830, new Date('2024-01-01T00:00:00.000Z'), 850000],
    ['CTR-803', 'Apex Logistics', 43921, new Date('2024-04-01T00:00:00.000Z'), 420000],
    ['CTR-804', 'Nordic Energy AG', 44012, new Date('2024-07-01T00:00:00.000Z'), 2100000],
    ['CTR-805', 'Helios Solar Tech', 44104, new Date('2024-10-01T00:00:00.000Z'), 630000],
  ];

  for (const r of rawRows) {
    const row = ws.addRow([r[0], r[1], r[2], r[3], r[4]]);
    row.getCell(3).numFmt = '0';
    row.getCell(4).numFmt = 'yyyy-mm-dd';
    row.getCell(5).numFmt = '$#,##0';
  }

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys = disambiguateHeaders(headers);
  const rows = rawRows.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: serial1904ToIsoDate(r[2]),
    [sanitizedKeys[3]!]: r[3].toISOString().split('T')[0],
    [sanitizedKeys[4]!]: r[4],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '09_excel_serial_dates_1904',
    fixtureNumber: 9,
    filename: '09_excel_serial_dates_1904.xlsx',
    format: 'xlsx',
    description: 'Excel 1904 date system (Mac Excel compatibility) offsets correctly resolved to ISO dates',
    sheets: [
      {
        sheetName: 'Schedule_1904',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          contract_id: 'id',
          vendor_name: 'text',
          execution_serial: 'date',
          formatted_date: 'date',
          contract_value: 'currency',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'contract_id',
          dateSystem: '1904',
        },
      },
    ],
  };

  return {
    id: '09_excel_serial_dates_1904',
    number: 9,
    filename: '09_excel_serial_dates_1904.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 10: Multi-Format Date Strings
 * Dates entered as text strings in heterogeneous formats (ISO, US, UK, named month, slashed).
 */
export async function generate10MultiFormatDates(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Incident_Log');

  const headers = ['Incident ID', 'Format Type', 'Raw Date String', 'Expected ISO', 'Severity'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  const rawRows = [
    ['INC-101', 'ISO 8601', '2024-01-15', '2024-01-15', 'High'],
    ['INC-102', 'US Standard (MM/DD/YYYY)', '02/20/2024', '2024-02-20', 'Medium'],
    ['INC-103', 'UK Standard (DD/MM/YYYY)', '25/03/2024', '2024-03-25', 'Critical'],
    ['INC-104', 'Named Month Short', '15-Apr-2024', '2024-04-15', 'Low'],
    ['INC-105', 'Named Month Long', 'May 5, 2024', '2024-05-05', 'Medium'],
    ['INC-106', 'Dotted (YYYY.MM.DD)', '2024.06.18', '2024-06-18', 'High'],
    ['INC-107', 'Slashed ISO (YYYY/MM/DD)', '2024/07/22', '2024-07-22', 'Low'],
    ['INC-108', 'Named Reverse', '31 August 2024', '2024-08-31', 'Critical'],
    ['INC-109', 'Abbreviated US', '9/8/2024', '2024-09-08', 'Low'],
    ['INC-110', 'Compact ISO', '2024-10-31', '2024-10-31', 'High'],
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
    [sanitizedKeys[2]!]: r[3], // Normalized to ISO format
    [sanitizedKeys[3]!]: r[3],
    [sanitizedKeys[4]!]: r[4],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '10_multi_format_date_strings',
    fixtureNumber: 10,
    filename: '10_multi_format_date_strings.xlsx',
    format: 'xlsx',
    description: 'Heterogeneous date string formats (ISO, US, UK, named months) parsed and normalized to ISO 8601',
    sheets: [
      {
        sheetName: 'Incident_Log',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          incident_id: 'id',
          format_type: 'category',
          raw_date_string: 'date',
          expected_iso: 'date',
          severity: 'category',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'incident_id',
        },
      },
    ],
  };

  return {
    id: '10_multi_format_date_strings',
    number: 10,
    filename: '10_multi_format_date_strings.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 11: Currency & Financial Formats
 * Currency symbols ($, €, £, ¥) and accounting negative parentheses `(1,250.00)`.
 */
export async function generate11CurrencyFinancialFormats(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Global_Ledger');

  const headers = ['Account Code', 'Description', 'USD Gross', 'EUR Expense', 'GBP Margin', 'Net Position'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  // Accounting data with negative values
  const rawRows: Array<[string, string, number, number, number, number]> = [
    ['ACC-101', 'Direct Product Revenue', 1250000.5, 0, 0, 1250000.5],
    ['ACC-102', 'Cloud Hosting Europe', 0, -45000.75, 0, -45000.75],
    ['ACC-103', 'London Advisory Retainer', 0, 0, -28000.0, -28000.0],
    ['ACC-104', 'Licensing Royalties', 320400.0, 0, 15000.25, 335400.25],
    ['ACC-105', 'Warehouse Lease Deficit', -85000.0, -12000.0, 0, -97000.0],
    ['ACC-106', 'APAC Hardware Shipments', 450000.0, 0, 0, 450000.0],
    ['ACC-107', 'Foreign Exchange Variance', -14250.5, 2300.0, -1800.0, -13750.5],
  ];

  for (const r of rawRows) {
    const row = ws.addRow(r);
    // Excel accounting format: $#,##0.00;($#,##0.00);"-"
    row.getCell(3).numFmt = '$#,##0.00;($#,##0.00);"-"';
    row.getCell(4).numFmt = '€#,##0.00;(€#,##0.00);"-"';
    row.getCell(5).numFmt = '£#,##0.00;(£#,##0.00);"-"';
    row.getCell(6).numFmt = '$#,##0.00;($#,##0.00);"-"';
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
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '11_currency_financial_formats',
    fixtureNumber: 11,
    filename: '11_currency_financial_formats.xlsx',
    format: 'xlsx',
    description: 'Financial ledger with international currency symbols and accounting parentheses negative numbers',
    sheets: [
      {
        sheetName: 'Global_Ledger',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          account_code: 'id',
          description: 'text',
          usd_gross: 'currency',
          eur_expense: 'currency',
          gbp_margin: 'currency',
          net_position: 'currency',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'account_code',
        },
      },
    ],
  };

  return {
    id: '11_currency_financial_formats',
    number: 11,
    filename: '11_currency_financial_formats.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 12: Percentage Formats
 * Numbers formatted with `%` symbol, decimals, and negative percentage variations.
 */
export async function generate12PercentageFormats(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Marketing_ROI');

  const headers = ['Campaign Key', 'Channel', 'Click Through Pct', 'Conversion Pct', 'YoY Growth', 'Discount Rate'];
  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow);

  // Proportions stored as numeric floats (e.g. 0.052 = 5.2%)
  const rawRows: Array<[string, string, number, number, number, number]> = [
    ['CMP-01', 'Search Ads', 0.045, 0.021, 0.155, 0.1],
    ['CMP-02', 'Social Influencer', 0.082, 0.038, 0.42, 0.15],
    ['CMP-03', 'Email Retargeting', 0.125, 0.055, -0.045, 0.2],
    ['CMP-04', 'Display Network', 0.008, 0.003, -0.12, 0.05],
    ['CMP-05', 'Affiliate Partners', 0.064, 0.042, 0.28, 0.12],
    ['CMP-06', 'Organic SEO', 0.095, 0.061, 0.35, 0.0],
    ['CMP-07', 'Webinar Outbound', 0.032, 0.019, 0.085, 0.25],
  ];

  for (const r of rawRows) {
    const row = ws.addRow(r);
    row.getCell(3).numFmt = '0.00%';
    row.getCell(4).numFmt = '0.00%';
    row.getCell(5).numFmt = '+0.0%;-0.0%;0.0%';
    row.getCell(6).numFmt = '0.0%';
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
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '12_percentage_formats',
    fixtureNumber: 12,
    filename: '12_percentage_formats.xlsx',
    format: 'xlsx',
    description: 'Percentage values represented as formatted decimal ratios with positive and negative growth rates',
    sheets: [
      {
        sheetName: 'Marketing_ROI',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          campaign_key: 'id',
          channel: 'category',
          click_through_pct: 'percent',
          conversion_pct: 'percent',
          yoy_growth: 'percent',
          discount_rate: 'percent',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'campaign_key',
        },
      },
    ],
  };

  return {
    id: '12_percentage_formats',
    number: 12,
    filename: '12_percentage_formats.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}
