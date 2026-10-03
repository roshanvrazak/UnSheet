import { z } from 'zod';
import { SafeIdentifierSchema, TitleSchema, DescriptionSchema } from './common.js';

/**
 * Grid position and dimensions for responsive 12-column layout.
 */
export const WidgetGridPositionSchema = z.object({
  x: z.number().int().min(0).max(11),
  y: z.number().int().nonnegative(),
  w: z.number().int().min(1).max(12),
  h: z.number().int().min(1).max(24),
});

export type WidgetGridPosition = z.infer<typeof WidgetGridPositionSchema>;

/**
 * Filter control types for dashboard interactions.
 */
export const FilterTypeSchema = z.enum([
  'select',
  'multi-select',
  'date-range',
  'numeric-range',
  'search',
]);

export type FilterType = z.infer<typeof FilterTypeSchema>;

/**
 * Filter selection option.
 */
export const FilterOptionSchema = z.object({
  label: z.string().min(1).max(128),
  value: z.union([z.string(), z.number(), z.boolean()]),
});

export type FilterOption = z.infer<typeof FilterOptionSchema>;

/**
 * Dashboard global filter specification.
 */
export const FilterSpecSchema = z.object({
  id: SafeIdentifierSchema,
  columnKey: SafeIdentifierSchema,
  label: z.string().min(1).max(64),
  type: FilterTypeSchema,
  defaultValue: z.unknown().optional(),
  options: z.array(FilterOptionSchema).optional(),
});

export type FilterSpec = z.infer<typeof FilterSpecSchema>;

/**
 * Standard aggregation functions supported across widgets and DuckDB queries.
 */
export const AggregationFunctionSchema = z.enum([
  'sum',
  'avg',
  'count',
  'min',
  'max',
  'distinctCount',
]);

export type AggregationFunction = z.infer<typeof AggregationFunctionSchema>;

/**
 * Number and currency display formatting options.
 */
export const DisplayFormatSchema = z.object({
  prefix: z.string().max(16).optional(),
  suffix: z.string().max(16).optional(),
  precision: z.number().int().min(0).max(10).optional(),
  notation: z.enum(['standard', 'compact', 'scientific']).optional(),
  currency: z.string().max(8).optional(),
});

export type DisplayFormat = z.infer<typeof DisplayFormatSchema>;

/**
 * 1. KPI Widget Specification
 */
export const KPIWidgetSpecSchema = z.object({
  id: SafeIdentifierSchema,
  type: z.literal('kpi'),
  title: TitleSchema,
  description: DescriptionSchema,
  grid: WidgetGridPositionSchema,
  filterBindings: z.array(SafeIdentifierSchema).optional(),
  measure: SafeIdentifierSchema,
  aggregation: AggregationFunctionSchema,
  comparison: z.object({
    targetValue: z.number().optional(),
    previousValue: z.number().optional(),
    periodLabel: z.string().max(64).optional(),
    changeType: z.enum(['percent', 'absolute']).optional(),
  }).optional(),
  format: DisplayFormatSchema.optional(),
});

export type KPIWidgetSpec = z.infer<typeof KPIWidgetSpecSchema>;

/**
 * Time granularity for line and trend charts.
 */
export const TimeGranularitySchema = z.enum([
  'day',
  'week',
  'month',
  'quarter',
  'year',
]);

export type TimeGranularity = z.infer<typeof TimeGranularitySchema>;

/**
 * Series styling for line charts.
 */
export const LineChartSeriesSchema = z.object({
  measureKey: SafeIdentifierSchema,
  label: z.string().min(1).max(64),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a valid hex color code').optional(),
  strokeStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
});

export type LineChartSeries = z.infer<typeof LineChartSeriesSchema>;

/**
 * 2. Line Chart Widget Specification
 */
export const LineChartWidgetSpecSchema = z.object({
  id: SafeIdentifierSchema,
  type: z.literal('line'),
  title: TitleSchema,
  description: DescriptionSchema,
  grid: WidgetGridPositionSchema,
  filterBindings: z.array(SafeIdentifierSchema).optional(),
  timeDimension: SafeIdentifierSchema,
  measures: z.array(SafeIdentifierSchema).min(1, 'Line chart requires at least one measure'),
  aggregation: AggregationFunctionSchema,
  timeGranularity: TimeGranularitySchema.optional(),
  series: z.array(LineChartSeriesSchema).optional(),
  showLegend: z.boolean().optional(),
  showGrid: z.boolean().optional(),
  areaFill: z.boolean().optional(),
});

export type LineChartWidgetSpec = z.infer<typeof LineChartWidgetSpecSchema>;

/**
 * Sort configuration for chart categories and dimensions.
 */
export const ChartSortSchema = z.object({
  by: z.enum(['value', 'label']),
  direction: z.enum(['asc', 'desc']),
});

export type ChartSort = z.infer<typeof ChartSortSchema>;

/**
 * 3. Bar Chart Widget Specification
 */
export const BarChartWidgetSpecSchema = z.object({
  id: SafeIdentifierSchema,
  type: z.literal('bar'),
  title: TitleSchema,
  description: DescriptionSchema,
  grid: WidgetGridPositionSchema,
  filterBindings: z.array(SafeIdentifierSchema).optional(),
  dimension: SafeIdentifierSchema,
  measures: z.array(SafeIdentifierSchema).min(1, 'Bar chart requires at least one measure'),
  aggregation: AggregationFunctionSchema,
  orientation: z.enum(['vertical', 'horizontal']).optional(),
  stacked: z.boolean().optional(),
  showLegend: z.boolean().optional(),
  showGrid: z.boolean().optional(),
  sort: ChartSortSchema.optional(),
  limit: z.number().int().positive().max(100).optional(),
});

export type BarChartWidgetSpec = z.infer<typeof BarChartWidgetSpecSchema>;

/**
 * 4. Donut Chart Widget Specification
 */
export const DonutChartWidgetSpecSchema = z.object({
  id: SafeIdentifierSchema,
  type: z.literal('donut'),
  title: TitleSchema,
  description: DescriptionSchema,
  grid: WidgetGridPositionSchema,
  filterBindings: z.array(SafeIdentifierSchema).optional(),
  dimension: SafeIdentifierSchema,
  measure: SafeIdentifierSchema,
  aggregation: AggregationFunctionSchema,
  innerRadius: z.number().min(0).max(0.9).optional(),
  showLegend: z.boolean().optional(),
  maxSlices: z.number().int().min(2).max(20).optional(),
});

export type DonutChartWidgetSpec = z.infer<typeof DonutChartWidgetSpecSchema>;

/**
 * Column definition for tabular widgets.
 */
export const TableColumnSpecSchema = z.object({
  columnKey: SafeIdentifierSchema,
  header: z.string().min(1).max(64),
  width: z.number().int().positive().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  format: DisplayFormatSchema.optional(),
});

export type TableColumnSpec = z.infer<typeof TableColumnSpecSchema>;

/**
 * 5. Table Widget Specification
 */
export const TableWidgetSpecSchema = z.object({
  id: SafeIdentifierSchema,
  type: z.literal('table'),
  title: TitleSchema,
  description: DescriptionSchema,
  grid: WidgetGridPositionSchema,
  filterBindings: z.array(SafeIdentifierSchema).optional(),
  columns: z.array(TableColumnSpecSchema).min(1, 'Table requires at least one column'),
  pageSize: z.number().int().min(5).max(100).optional(),
  sortable: z.boolean().optional(),
  searchable: z.boolean().optional(),
  defaultSort: z.object({
    columnKey: SafeIdentifierSchema,
    direction: z.enum(['asc', 'desc']),
  }).optional(),
});

export type TableWidgetSpec = z.infer<typeof TableWidgetSpecSchema>;

/**
 * Pivot table measure specification.
 */
export const PivotMeasureSchema = z.object({
  columnKey: SafeIdentifierSchema,
  aggregation: AggregationFunctionSchema,
  label: z.string().max(64).optional(),
  format: DisplayFormatSchema.optional(),
});

export type PivotMeasure = z.infer<typeof PivotMeasureSchema>;

/**
 * 6. Pivot Table Widget Specification
 */
export const PivotTableWidgetSpecSchema = z.object({
  id: SafeIdentifierSchema,
  type: z.literal('pivot'),
  title: TitleSchema,
  description: DescriptionSchema,
  grid: WidgetGridPositionSchema,
  filterBindings: z.array(SafeIdentifierSchema).optional(),
  rowDimensions: z.array(SafeIdentifierSchema).min(1, 'Pivot table requires at least one row dimension'),
  colDimensions: z.array(SafeIdentifierSchema).optional(),
  measures: z.array(PivotMeasureSchema).min(1, 'Pivot table requires at least one measure'),
  showTotals: z.boolean().optional(),
  showSubtotals: z.boolean().optional(),
});

export type PivotTableWidgetSpec = z.infer<typeof PivotTableWidgetSpecSchema>;

/**
 * Discriminated union of all supported dashboard widgets based on the `type` discriminator.
 */
export const WidgetSpecSchema = z.discriminatedUnion('type', [
  KPIWidgetSpecSchema,
  LineChartWidgetSpecSchema,
  BarChartWidgetSpecSchema,
  DonutChartWidgetSpecSchema,
  TableWidgetSpecSchema,
  PivotTableWidgetSpecSchema,
]);

export type WidgetSpec = z.infer<typeof WidgetSpecSchema>;

/**
 * Dashboard grid layout configuration.
 */
export const DashboardLayoutSchema = z.object({
  columns: z.number().int().min(1).max(24).default(12),
  gap: z.number().int().nonnegative().default(16),
  padding: z.number().int().nonnegative().default(16),
});

export type DashboardLayout = z.infer<typeof DashboardLayoutSchema>;

/**
 * Complete versioned Dashboard Specification.
 */
export const DashboardSpecSchema = z.object({
  version: z.literal('1.0'),
  id: z.string().min(1).max(64),
  title: TitleSchema,
  description: DescriptionSchema,
  sheetBinding: z.string().min(1).max(128),
  layout: DashboardLayoutSchema.default({ columns: 12, gap: 16, padding: 16 }),
  filters: z.array(FilterSpecSchema).default([]),
  widgets: z.array(WidgetSpecSchema).min(1, 'Dashboard must have at least one widget'),
  theme: z.enum(['light', 'dark', 'system']).optional(),
});

export type DashboardSpec = z.infer<typeof DashboardSpecSchema>;
