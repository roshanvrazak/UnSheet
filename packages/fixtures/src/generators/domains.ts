import ExcelJS from 'exceljs';
import type { GeneratedFixture, GoldenWorkbook } from '../types.js';
import { styleHeaderRow, autoFitColumns, disambiguateHeaders } from './utils.js';

/**
 * Fixture 26: Domain Demo 1: Project Pipeline
 * Realistic corporate capital engineering project portfolio spreadsheet.
 */
export async function generate26DomainProjectPipeline(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Capital_Projects');

  const headers = [
    'Project Code',
    'Project Name',
    'Stage',
    'Strategic Priority',
    'Project Owner',
    'Approved Budget',
    'Committed Cost',
    'Actual Spend',
    'Start Date',
    'Target Completion',
    'Completion Pct',
    'Health Status',
  ];

  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow, '1F4E79');

  const rawData: Array<[string, string, string, string, string, number, number, number, string, string, number, string]> = [
    ['PRJ-01', 'NextGen Telemetry Grid', 'Execution', 'Critical', 'Marcus Vance', 4500000, 3800000, 2900000, '2023-09-01', '2024-12-31', 0.68, 'Green'],
    ['PRJ-02', 'Turbine Insulation Upgrade', 'Execution', 'High', 'Dr. Elena Rostova', 1850000, 1600000, 1420000, '2024-01-15', '2024-10-31', 0.85, 'Green'],
    ['PRJ-03', 'Reno Substation Automation', 'Procurement', 'High', 'Tariq Al-Mansoor', 3200000, 2100000, 850000, '2024-03-01', '2025-06-30', 0.3, 'Amber'],
    ['PRJ-04', 'Stuttgart Robotics Cell', 'Testing', 'Critical', 'Hans Becker', 5400000, 5200000, 4950000, '2023-06-01', '2024-08-31', 0.92, 'Green'],
    ['PRJ-05', 'Tokyo Cleanroom Expansion', 'Design', 'Medium', 'Yuki Tanaka', 2750000, 450000, 180000, '2024-05-15', '2025-09-30', 0.15, 'Green'],
    ['PRJ-06', 'Foundry Slag Heat Recovery', 'Execution', 'High', 'Carlos Mendoza', 2100000, 1950000, 1800000, '2023-11-01', '2024-11-15', 0.78, 'Amber'],
    ['PRJ-07', 'Hydraulic Press Modernization', 'Commissioning', 'Medium', 'Chloe Dubois', 1450000, 1420000, 1390000, '2023-08-15', '2024-06-30', 0.98, 'Green'],
    ['PRJ-08', 'Enterprise SCADA Migration', 'Execution', 'Critical', 'Liam O’Connor', 6800000, 6100000, 4800000, '2023-04-01', '2025-03-31', 0.62, 'Red'],
    ['PRJ-09', 'Chilled Water Plant Overhaul', 'Feasibility', 'Standard', 'Sarah Jenkins', 950000, 80000, 35000, '2024-07-01', '2025-04-30', 0.05, 'Green'],
    ['PRJ-10', 'Solar Rooftop Microgrid', 'Execution', 'Medium', 'Priya Nair', 3100000, 2800000, 2200000, '2023-10-01', '2024-12-15', 0.72, 'Green'],
    ['PRJ-11', 'Autonomous Tugger Fleet', 'Procurement', 'High', 'Kenji Sato', 1650000, 1100000, 420000, '2024-02-01', '2025-01-31', 0.35, 'Amber'],
    ['PRJ-12', 'Effluent Treatment Zero Discharge', 'Design', 'Critical', 'Hannah Schmidt', 4200000, 650000, 290000, '2024-04-15', '2025-11-30', 0.18, 'Green'],
    ['PRJ-13', 'High-Bay Automated Storage', 'Execution', 'High', 'Zoe Kowalski', 7500000, 6900000, 5200000, '2023-05-01', '2025-02-28', 0.65, 'Amber'],
    ['PRJ-14', 'Air Separation Unit Booster', 'Commissioning', 'Medium', 'Amara Okafor', 1900000, 1880000, 1850000, '2023-07-15', '2024-07-31', 0.96, 'Green'],
    ['PRJ-15', 'Cryogenic Tank Farm Expansion', 'Design', 'Critical', 'Gabriel Silva', 8200000, 1200000, 450000, '2024-06-01', '2026-06-30', 0.1, 'Green'],
    ['PRJ-16', 'Paint Shop VOC Emission Scrubber', 'Execution', 'High', 'David Kim', 2300000, 2150000, 1920000, '2023-12-01', '2024-10-15', 0.82, 'Green'],
    ['PRJ-17', 'Vibration Monitoring Retrofit', 'Testing', 'Standard', 'Alice Vance', 780000, 750000, 710000, '2024-01-10', '2024-08-15', 0.88, 'Green'],
    ['PRJ-18', 'Emergency Diesel Gen Paralleling', 'Procurement', 'High', 'Marcus Chen', 1350000, 950000, 380000, '2024-03-15', '2024-12-31', 0.4, 'Green'],
    ['PRJ-19', 'Laser Cutting Center Cell 4', 'Execution', 'Medium', 'Dr. Elena Rostova', 2600000, 2400000, 1850000, '2023-10-15', '2024-11-30', 0.74, 'Green'],
    ['PRJ-20', 'Raw Material Silo Level Radar', 'Commissioning', 'Standard', 'Tariq Al-Mansoor', 420000, 415000, 410000, '2024-02-01', '2024-06-30', 0.99, 'Green'],
    ['PRJ-21', 'Foundry Core Blower Upgrade', 'Design', 'High', 'Hans Becker', 1750000, 250000, 95000, '2024-05-01', '2025-05-31', 0.12, 'Amber'],
    ['PRJ-22', 'Distribution Center Conveyor Sorter', 'Execution', 'Critical', 'Yuki Tanaka', 5100000, 4700000, 3600000, '2023-09-15', '2025-01-15', 0.69, 'Red'],
    ['PRJ-23', 'Wastewater Reverse Osmosis Skid', 'Procurement', 'Medium', 'Carlos Mendoza', 1250000, 890000, 310000, '2024-04-01', '2024-12-15', 0.32, 'Green'],
    ['PRJ-24', 'Plant 3 Compressed Air Loop', 'Execution', 'Standard', 'Chloe Dubois', 890000, 820000, 740000, '2024-01-05', '2024-09-30', 0.86, 'Green'],
    ['PRJ-25', 'Digital Twin Predictive Analytics', 'Testing', 'High', 'Marcus Vance', 3400000, 3250000, 2980000, '2023-07-01', '2024-09-15', 0.91, 'Green'],
  ];

  for (const r of rawData) {
    const row = ws.addRow(r);
    row.getCell(6).numFmt = '$#,##0';
    row.getCell(7).numFmt = '$#,##0';
    row.getCell(8).numFmt = '$#,##0';
    row.getCell(9).numFmt = 'yyyy-mm-dd';
    row.getCell(10).numFmt = 'yyyy-mm-dd';
    row.getCell(11).numFmt = '0.0%';
  }

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys = disambiguateHeaders(headers);
  const rows = rawData.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: r[3],
    [sanitizedKeys[4]!]: r[4],
    [sanitizedKeys[5]!]: r[5],
    [sanitizedKeys[6]!]: r[6],
    [sanitizedKeys[7]!]: r[7],
    [sanitizedKeys[8]!]: r[8],
    [sanitizedKeys[9]!]: r[9],
    [sanitizedKeys[10]!]: r[10],
    [sanitizedKeys[11]!]: r[11],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '26_domain_project_pipeline',
    fixtureNumber: 26,
    filename: '26_domain_project_pipeline.xlsx',
    format: 'xlsx',
    description: 'Capital projects pipeline tracking budget spend, schedules, milestones, and project health',
    sheets: [
      {
        sheetName: 'Capital_Projects',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          project_code: 'id',
          project_name: 'text',
          stage: 'category',
          strategic_priority: 'category',
          project_owner: 'text',
          approved_budget: 'currency',
          committed_cost: 'currency',
          actual_spend: 'currency',
          start_date: 'date',
          target_completion: 'date',
          completion_pct: 'percent',
          health_status: 'category',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'project_code',
        },
      },
    ],
  };

  return {
    id: '26_domain_project_pipeline',
    number: 26,
    filename: '26_domain_project_pipeline.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 27: Domain Demo 2: BOQ & Quotes
 * Bill of quantities for commercial construction & procurement.
 */
export async function generate27DomainBoqQuotes(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Bill_of_Quantities');

  const headers = [
    'Item Ref',
    'Trade Section',
    'Description',
    'Unit of Measure',
    'Tender Qty',
    'Unit Rate USD',
    'Total Cost USD',
    'Lead Time Weeks',
    'Preferred Vendor',
  ];

  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow, '375623');

  const rawData: Array<[string, string, string, string, number, number, number, number, string]> = [
    ['BOQ-01.01', 'Earthworks', 'Site clearance and bulk soil excavation', 'm3', 4500, 32.5, 146250.0, 3, 'Titan Terraforming'],
    ['BOQ-01.02', 'Earthworks', 'Compacted granular structural fill (300mm layers)', 'm3', 2800, 48.0, 134400.0, 2, 'Titan Terraforming'],
    ['BOQ-01.03', 'Earthworks', 'Deep foundation drilling and soil stabilization', 'm', 640, 115.0, 73600.0, 4, 'Apex Groundworks'],
    ['BOQ-02.01', 'Concrete', 'Reinforced concrete foundation pad C35/45', 'm3', 1200, 285.0, 342000.0, 3, 'Holcim Premix Corp'],
    ['BOQ-02.02', 'Concrete', 'High-tensile deformed rebar steel (Grade 500)', 'tonnes', 165, 1250.0, 206250.0, 5, 'ArcelorMittal Distribution'],
    ['BOQ-02.03', 'Concrete', 'Post-tensioned suspended floor slabs (250mm)', 'm2', 3200, 95.0, 304000.0, 4, 'Holcim Premix Corp'],
    ['BOQ-02.04', 'Concrete', 'Architectural exposed aggregate precast panels', 'm2', 850, 165.0, 140250.0, 8, 'Permasteelisa Group'],
    ['BOQ-03.01', 'Structural Steel', 'Hot-rolled wide flange steel columns W14x90', 'tonnes', 110, 2400.0, 264000.0, 6, 'Vulcan Steelworks'],
    ['BOQ-03.02', 'Structural Steel', 'Heavy structural roof trusses span 24m', 'nr', 18, 14500.0, 261000.0, 8, 'Vulcan Steelworks'],
    ['BOQ-03.03', 'Structural Steel', 'Galvanized cold-formed Z-purlins 200mm', 'm', 3400, 22.0, 74800.0, 3, 'Lindab Building Systems'],
    ['BOQ-03.04', 'Structural Steel', 'Exterior perimeter seismic brace assemblies', 'sets', 24, 6200.0, 148800.0, 7, 'Nippon Steel Fabrication'],
    ['BOQ-04.01', 'Thermal Envelope', 'Mineral wool core insulated composite sandwich panel', 'm2', 4800, 72.0, 345600.0, 6, 'Kingspan Insulated Panels'],
    ['BOQ-04.02', 'Thermal Envelope', 'Double-glazed argon-filled curtain wall glazing', 'm2', 1250, 420.0, 525000.0, 10, 'Schüco International'],
    ['BOQ-04.03', 'Thermal Envelope', 'TPO single-ply reflective commercial roof membrane', 'm2', 4200, 45.0, 189000.0, 4, 'Carlisle SynTec Systems'],
    ['BOQ-05.01', 'HVAC Mechanical', 'Variable refrigerant flow (VRF) rooftop condenser units', 'nr', 6, 38500.0, 231000.0, 12, 'Daikin Applied'],
    ['BOQ-05.02', 'HVAC Mechanical', 'Double-wall galvanized spiral ventilation ducting', 'm', 1850, 65.0, 120250.0, 5, 'Lindab Building Systems'],
    ['BOQ-05.03', 'HVAC Mechanical', 'High-efficiency energy recovery ventilation wheels', 'nr', 4, 18200.0, 72800.0, 8, 'Systemair Global'],
    ['BOQ-06.01', 'Electrical & Low Voltage', '1500kVA cast resin step-down power transformer', 'nr', 2, 62000.0, 124000.0, 16, 'Schneider Electric'],
    ['BOQ-06.02', 'Electrical & Low Voltage', 'Main low voltage distribution switchboard 3200A', 'nr', 1, 145000.0, 145000.0, 14, 'ABB Power Solutions'],
    ['BOQ-06.03', 'Electrical & Low Voltage', 'Continuous perforated aluminum cable tray 300mm', 'm', 2200, 38.0, 83600.0, 3, 'OBO Bettermann'],
    ['BOQ-06.04', 'Electrical & Low Voltage', 'Category 6A shielded structured data cabling', 'm', 14500, 4.2, 60900.0, 2, 'Belden Cable Solutions'],
    ['BOQ-07.01', 'Fire Protection', 'Pre-action dry pipe automatic fire sprinkler grid', 'points', 850, 95.0, 80750.0, 6, 'Viking Sprinkler Corp'],
    ['BOQ-07.02', 'Fire Protection', 'Diesel-driven centrifugal multistage fire pump skid', 'nr', 1, 88000.0, 88000.0, 14, 'Grundfos Industrial'],
    ['BOQ-08.01', 'Interior Architecture', 'Heavy-duty chemical resistant self-leveling epoxy flooring', 'm2', 3600, 55.0, 198000.0, 3, 'Sika Building Systems'],
    ['BOQ-08.02', 'Interior Architecture', 'Demountable acoustic glazed modular office partitions', 'm', 320, 380.0, 121600.0, 5, 'Maars Living Walls'],
    ['BOQ-08.03', 'Interior Architecture', 'Suspended micro-perforated acoustic ceiling baffle tiles', 'm2', 2800, 48.0, 134400.0, 4, 'Armstrong World Industries'],
    ['BOQ-09.01', 'Civil & Paving', 'Heavy-duty asphalt paving for articulated logistics apron', 'm2', 5200, 42.0, 218400.0, 3, 'Hanson Paving Group'],
    ['BOQ-09.02', 'Civil & Paving', 'Stormwater attenuation detention modular tank 400m3', 'nr', 1, 95000.0, 95000.0, 6, 'Wavin Water Management'],
    ['BOQ-09.03', 'Civil & Paving', 'High-security anti-climb welded wire perimeter fence', 'm', 1400, 75.0, 105000.0, 4, 'Betafence Systems'],
    ['BOQ-10.01', 'Specialist Equipment', 'Electric overhead bridge crane capacity 15 tonnes', 'nr', 2, 78000.0, 156000.0, 18, 'Konecranes Heavy Logistics'],
  ];

  for (const r of rawData) {
    const row = ws.addRow(r);
    row.getCell(5).numFmt = '#,##0.00';
    row.getCell(6).numFmt = '$#,##0.00';
    row.getCell(7).numFmt = '$#,##0.00';
    row.getCell(8).numFmt = '0';
  }

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys = disambiguateHeaders(headers);
  const rows = rawData.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: r[3],
    [sanitizedKeys[4]!]: r[4],
    [sanitizedKeys[5]!]: r[5],
    [sanitizedKeys[6]!]: r[6],
    [sanitizedKeys[7]!]: r[7],
    [sanitizedKeys[8]!]: r[8],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '27_domain_boq_quotes',
    fixtureNumber: 27,
    filename: '27_domain_boq_quotes.xlsx',
    format: 'xlsx',
    description: 'Detailed Bill of Quantities (BOQ) with construction trades, line-item rates, quantities, and vendor specs',
    sheets: [
      {
        sheetName: 'Bill_of_Quantities',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          item_ref: 'id',
          trade_section: 'category',
          description: 'text',
          unit_of_measure: 'category',
          tender_qty: 'number',
          unit_rate_usd: 'currency',
          total_cost_usd: 'currency',
          lead_time_weeks: 'number',
          preferred_vendor: 'text',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'item_ref',
        },
      },
    ],
  };

  return {
    id: '27_domain_boq_quotes',
    number: 27,
    filename: '27_domain_boq_quotes.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}

/**
 * Fixture 28: Domain Demo 3: Supplier Lead Times
 * Operational logistics and component delivery tracking spreadsheet.
 */
export async function generate28DomainSupplierLeadTimes(): Promise<GeneratedFixture> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Supplier_Delivery_Log');

  const headers = [
    'PO Number',
    'Supplier Code',
    'Supplier Name',
    'Component Code',
    'Component Description',
    'Order Date',
    'Promised Date',
    'Actual Delivery Date',
    'Promised Lead Days',
    'Actual Lead Days',
    'Delivery Status',
    'On Time Flag',
  ];

  const headerRow = ws.addRow(headers);
  styleHeaderRow(headerRow, '7B3F00');

  const rawData: Array<[string, string, string, string, string, string, string, string, number, number, string, boolean]> = [
    ['PO-9001', 'SUP-DE-01', 'Krupp Präzision AG', 'CMP-BRG-88', 'Heavy spherical roller bearing 180mm', '2024-01-10', '2024-02-15', '2024-02-14', 36, 35, 'Delivered', true],
    ['PO-9002', 'SUP-JP-02', 'Kyoto Micro-Sensors', 'CMP-SNS-01', 'Piezoelectric vibration transmitter 4-20mA', '2024-01-12', '2024-02-28', '2024-03-05', 47, 53, 'Delivered', false],
    ['PO-9003', 'SUP-US-03', 'Midwest Alloy Forging', 'CMP-SHF-44', 'Precision ground drive shaft 2.5m 4140 steel', '2024-01-18', '2024-03-15', '2024-03-12', 57, 54, 'Delivered', true],
    ['PO-9004', 'SUP-TW-04', 'Hsinchu Silicon Foundry', 'CMP-DSP-12', 'Dual-core industrial DSP microcontroller', '2024-01-20', '2024-04-10', '2024-04-18', 81, 89, 'Delivered', false],
    ['PO-9005', 'SUP-UK-05', 'Vanguard Hydraulics Ltd', 'CMP-VLV-99', 'High-pressure directional proportional valve', '2024-01-25', '2024-03-01', '2024-02-28', 36, 34, 'Delivered', true],
    ['PO-9006', 'SUP-CH-06', 'Alpine Swiss Instruments', 'CMP-ENC-33', 'Optical absolute rotary encoder 24-bit', '2024-02-01', '2024-03-15', '2024-03-14', 43, 42, 'Delivered', true],
    ['PO-9007', 'SUP-KR-07', 'Busan Marine Castings', 'CMP-IMP-05', 'Bronze closed impeller 350mm diameter', '2024-02-05', '2024-04-05', '2024-04-12', 60, 67, 'Delivered', false],
    ['PO-9008', 'SUP-DE-01', 'Krupp Präzision AG', 'CMP-GRB-14', 'Helical bevel gearbox ratio 25:1', '2024-02-08', '2024-04-15', '2024-04-10', 67, 62, 'Delivered', true],
    ['PO-9009', 'SUP-SE-08', 'Nordic Polymer Seals', 'CMP-SLS-22', 'PTFE spring-energized lip seal pack', '2024-02-12', '2024-03-05', '2024-03-04', 22, 21, 'Delivered', true],
    ['PO-9010', 'SUP-IT-09', 'Modena Precision Gears', 'CMP-PIN-77', 'Carburized spur gear pinion m=6 z=22', '2024-02-15', '2024-04-01', '2024-04-08', 46, 53, 'Delivered', false],
    ['PO-9011', 'SUP-US-03', 'Midwest Alloy Forging', 'CMP-FLG-10', 'Weld neck ANSI Class 600 flange 8-inch', '2024-02-20', '2024-03-25', '2024-03-22', 34, 31, 'Delivered', true],
    ['PO-9012', 'SUP-JP-02', 'Kyoto Micro-Sensors', 'CMP-OPT-08', 'Infrared optical pyrometer 0-1200C', '2024-02-22', '2024-04-12', '2024-04-11', 50, 49, 'Delivered', true],
    ['PO-9013', 'SUP-FR-10', 'Rhone Carbon Composites', 'CMP-ROD-55', 'Carbon fiber drive linkage rod 1.8m', '2024-02-26', '2024-04-20', '2024-04-29', 54, 63, 'Delivered', false],
    ['PO-9014', 'SUP-TW-04', 'Hsinchu Silicon Foundry', 'CMP-FPGA-9', 'Field programmable gate array 250k LE', '2024-03-01', '2024-05-15', '2024-05-14', 75, 74, 'Delivered', true],
    ['PO-9015', 'SUP-UK-05', 'Vanguard Hydraulics Ltd', 'CMP-CYL-18', 'Double-acting tie rod hydraulic cylinder', '2024-03-05', '2024-04-15', '2024-04-12', 41, 38, 'Delivered', true],
    ['PO-9016', 'SUP-CH-06', 'Alpine Swiss Instruments', 'CMP-TC-44', 'Type K mineral-insulated thermocouple', '2024-03-08', '2024-04-05', '2024-04-03', 28, 26, 'Delivered', true],
    ['PO-9017', 'SUP-DE-01', 'Krupp Präzision AG', 'CMP-CPL-80', 'Flexible disc coupling rated 4500 Nm', '2024-03-10', '2024-04-25', '2024-04-23', 46, 44, 'Delivered', true],
    ['PO-9018', 'SUP-KR-07', 'Busan Marine Castings', 'CMP-PMP-12', 'Submersible slurry pump casing ductile iron', '2024-03-12', '2024-05-20', '2024-06-02', 69, 82, 'Delivered', false],
    ['PO-9019', 'SUP-SE-08', 'Nordic Polymer Seals', 'CMP-GAS-66', 'Spiral wound gasket 316SS with graphite filler', '2024-03-15', '2024-04-08', '2024-04-05', 24, 21, 'Delivered', true],
    ['PO-9020', 'SUP-IT-09', 'Modena Precision Gears', 'CMP-WRM-03', 'Hardened bronze worm drive set ratio 40:1', '2024-03-18', '2024-05-02', '2024-05-09', 45, 52, 'Delivered', false],
    ['PO-9021', 'SUP-US-03', 'Midwest Alloy Forging', 'CMP-HUB-29', 'Heavy spline hub connector 12-tooth', '2024-03-20', '2024-05-10', '2024-05-08', 51, 49, 'Delivered', true],
    ['PO-9022', 'SUP-JP-02', 'Kyoto Micro-Sensors', 'CMP-ACC-16', 'Triaxial digital accelerometer CANbus', '2024-03-22', '2024-05-15', '2024-05-22', 54, 61, 'Delivered', false],
    ['PO-9023', 'SUP-FR-10', 'Rhone Carbon Composites', 'CMP-VNE-88', 'Composite aerodynamic stator vane set', '2024-03-25', '2024-05-30', '2024-05-27', 66, 63, 'Delivered', true],
    ['PO-9024', 'SUP-TW-04', 'Hsinchu Silicon Foundry', 'CMP-MCU-04', 'Ultra-low-power ARM Cortex-M4 microcontroller', '2024-03-28', '2024-06-15', '2024-06-14', 79, 78, 'Delivered', true],
    ['PO-9025', 'SUP-UK-05', 'Vanguard Hydraulics Ltd', 'CMP-MNF-11', 'Custom machined hydraulic manifold block', '2024-04-01', '2024-05-20', '2024-05-17', 49, 46, 'Delivered', true],
    ['PO-9026', 'SUP-CH-06', 'Alpine Swiss Instruments', 'CMP-LVDT-02', 'Linear displacement sensor stroke 50mm', '2024-04-03', '2024-05-10', '2024-05-08', 37, 35, 'Delivered', true],
    ['PO-9027', 'SUP-DE-01', 'Krupp Präzision AG', 'CMP-TOR-91', 'Dynamic strain gauge torque sensor 10kNm', '2024-04-05', '2024-06-01', '2024-05-30', 57, 55, 'Delivered', true],
    ['PO-9028', 'SUP-KR-07', 'Busan Marine Castings', 'CMP-NOZ-06', 'Hastelloy spray nozzle assembly', '2024-04-08', '2024-06-15', '2024-06-25', 68, 78, 'Delivered', false],
    ['PO-9029', 'SUP-SE-08', 'Nordic Polymer Seals', 'CMP-RING-44', 'Fluoroelastomer O-ring kit high chemical res', '2024-04-10', '2024-04-30', '2024-04-28', 20, 18, 'Delivered', true],
    ['PO-9030', 'SUP-IT-09', 'Modena Precision Gears', 'CMP-RND-17', 'Planetary sun gear precision AGMA 12', '2024-04-12', '2024-06-05', '2024-06-12', 54, 61, 'Delivered', false],
    ['PO-9031', 'SUP-US-03', 'Midwest Alloy Forging', 'CMP-ARM-73', 'Forged articulated robot pivot arm', '2024-04-15', '2024-06-20', '2024-06-17', 66, 63, 'Delivered', true],
    ['PO-9032', 'SUP-JP-02', 'Kyoto Micro-Sensors', 'CMP-MAG-09', 'Magnetic inductive flow meter sensor tube', '2024-04-18', '2024-06-25', '2024-06-24', 68, 67, 'Delivered', true],
    ['PO-9033', 'SUP-FR-10', 'Rhone Carbon Composites', 'CMP-BRK-21', 'Carbon ceramic high-friction brake disc', '2024-04-20', '2024-07-01', '2024-07-09', 72, 80, 'Delivered', false],
    ['PO-9034', 'SUP-TW-04', 'Hsinchu Silicon Foundry', 'CMP-PWR-88', 'Silicon Carbide (SiC) MOSFET power module', '2024-04-22', '2024-07-15', '2024-07-11', 84, 80, 'Delivered', true],
    ['PO-9035', 'SUP-UK-05', 'Vanguard Hydraulics Ltd', 'CMP-ACC-50', 'Bladder-type nitrogen hydraulic accumulator', '2024-04-25', '2024-06-15', '2024-06-12', 51, 48, 'Delivered', true],
  ];

  for (const r of rawData) {
    const row = ws.addRow(r);
    row.getCell(6).numFmt = 'yyyy-mm-dd';
    row.getCell(7).numFmt = 'yyyy-mm-dd';
    row.getCell(8).numFmt = 'yyyy-mm-dd';
    row.getCell(9).numFmt = '0';
    row.getCell(10).numFmt = '0';
  }

  autoFitColumns(ws);

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());

  const sanitizedKeys = disambiguateHeaders(headers);
  const rows = rawData.map((r) => ({
    [sanitizedKeys[0]!]: r[0],
    [sanitizedKeys[1]!]: r[1],
    [sanitizedKeys[2]!]: r[2],
    [sanitizedKeys[3]!]: r[3],
    [sanitizedKeys[4]!]: r[4],
    [sanitizedKeys[5]!]: r[5],
    [sanitizedKeys[6]!]: r[6],
    [sanitizedKeys[7]!]: r[7],
    [sanitizedKeys[8]!]: r[8],
    [sanitizedKeys[9]!]: r[9],
    [sanitizedKeys[10]!]: r[10],
    [sanitizedKeys[11]!]: r[11],
  }));

  const golden: GoldenWorkbook = {
    fixtureId: '28_domain_supplier_lead_times',
    fixtureNumber: 28,
    filename: '28_domain_supplier_lead_times.xlsx',
    format: 'xlsx',
    description: 'Component purchase orders and supplier lead time operational performance tracking log',
    sheets: [
      {
        sheetName: 'Supplier_Delivery_Log',
        headers: {
          detectedRowIndex: 0,
          confidence: 1.0,
          originalHeaders: headers,
          sanitizedKeys,
        },
        inferredTypes: {
          po_number: 'id',
          supplier_code: 'id',
          supplier_name: 'text',
          component_code: 'id',
          component_description: 'text',
          order_date: 'date',
          promised_date: 'date',
          actual_delivery_date: 'date',
          promised_lead_days: 'number',
          actual_lead_days: 'number',
          delivery_status: 'category',
          on_time_flag: 'boolean',
        },
        rowCount: rows.length,
        columnCount: headers.length,
        rows,
        metadata: {
          primaryKey: 'po_number',
        },
      },
    ],
  };

  return {
    id: '28_domain_supplier_lead_times',
    number: 28,
    filename: '28_domain_supplier_lead_times.xlsx',
    format: 'xlsx',
    description: golden.description,
    buffer,
    golden,
  };
}
