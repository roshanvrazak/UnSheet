import type {
  BarChartWidgetSpec,
  DashboardSpec,
  DonutChartWidgetSpec,
  FilterSpec,
  KPIWidgetSpec,
  LineChartWidgetSpec,
  PivotTableWidgetSpec,
  SafeIdentifier,
  SheetProfile,
  TableColumnSpec,
  TableWidgetSpec,
  WidgetSpec,
} from '@unsheet/contracts';
import { DashboardSpecSchema } from '@unsheet/contracts';

export interface SpecGenOptions {
  title?: string;
  description?: string;
  theme?: 'light' | 'dark' | 'system';
}

/**
 * Capitalises and cleans an identifier for user-facing widget titles and labels.
 * E.g., "customer_id" -> "Customer Id", "gross_revenue" -> "Gross Revenue".
 */
export function formatTitle(key: string, maxLen = 64): string {
  if (!key || key.trim() === '') {
    return 'Item';
  }
  const words = key
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

  const formatted = words.join(' ').trim();
  return (formatted.slice(0, maxLen) || 'Item').trim();
}

/**
 * Deterministic rules engine that generates a complete, valid DashboardSpec from a SheetProfile.
 * Guarantees a non-overlapping 12-column grid layout, widget bounds x + w <= 12,
 * auto-populated global filters, and strict validation via DashboardSpecSchema.
 */
export function generateDashboardSpec(
  profile: SheetProfile,
  options?: SpecGenOptions
): DashboardSpec {
  const widgets: WidgetSpec[] = [];
  const filters: FilterSpec[] = [];

  const rawDashId = `dash_${profile.sheetId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const dashboardId = rawDashId.slice(0, 64);
  const title = (
    options?.title?.trim() ||
    `${formatTitle(profile.sheetName, 100)} Dashboard`
  ).slice(0, 120);
  const description = (
    options?.description?.trim() ||
    `Auto-generated analytical dashboard for ${profile.sheetName}`
  ).slice(0, 500);

  // 1. Resolve Columns & Roles
  const timeCol =
    profile.recommendedTimeColumn ||
    profile.columnProfiles.find((c) => c.semanticRole === 'time')?.columnKey;

  const rawMeasures =
    profile.recommendedMeasures.length > 0
      ? profile.recommendedMeasures
      : profile.columnProfiles
          .filter((c) => c.semanticRole === 'measure')
          .map((c) => c.columnKey);
  const measures = Array.from(new Set(rawMeasures)).filter((mKey) => {
    const colProf = profile.columnProfiles.find((c) => c.columnKey === mKey);
    if (!colProf) return false;
    if (colProf.semanticRole === 'time' || colProf.inferredType === 'date') return false;
    const name = `${colProf.originalName || ''} ${colProf.columnKey}`.toLowerCase();
    const isTemporal = [
      'date', 'time', 'timestamp', 'year', 'quarter', 'month', 'day',
      'created', 'updated', 'closed', 'opened', 'completed', 'due'
    ].some((k) => name.includes(k) || colProf.columnKey.endsWith(k));
    const isDuration = ['duration', 'lead_days', 'days_to', 'elapsed', 'latency', 'hours_spent'].some((k) => name.includes(k));
    return !isTemporal || isDuration;
  });

  const rawDimensions =
    profile.recommendedDimensions.length > 0
      ? profile.recommendedDimensions
      : profile.columnProfiles
          .filter((c) => c.semanticRole === 'dimension')
          .map((c) => c.columnKey);
  const dimensions = Array.from(new Set(rawDimensions));

  // 2. Global Filters Generation
  if (timeCol) {
    const timeColProfile = profile.columnProfiles.find((c) => c.columnKey === timeCol);
    filters.push({
      id: `filter_${timeCol}`.slice(0, 128) as SafeIdentifier,
      columnKey: timeCol,
      label: formatTitle(timeColProfile?.originalName || timeCol, 40),
      type: 'date-range',
    });
  }

  // Top 1-3 dimensions for categorical filters
  const filterDims = dimensions.slice(0, 3);
  for (const dimKey of filterDims) {
    const dimProfile = profile.columnProfiles.find((c) => c.columnKey === dimKey);
    const filterOptions = dimProfile?.topValues
      ?.filter((tv) => tv.value !== '')
      .slice(0, 20)
      .map((tv) => ({
        label: formatTitle(tv.value, 40),
        value: tv.value,
      }));

    filters.push({
      id: `filter_${dimKey}`.slice(0, 128) as SafeIdentifier,
      columnKey: dimKey,
      label: formatTitle(dimProfile?.originalName || dimKey, 40),
      type: 'select',
      options: filterOptions && filterOptions.length > 0 ? filterOptions : undefined,
    });
  }

  const allFilterIds = filters.map((f) => f.id);

  let currentY = 0;

  // 3. KPI Cards (Row 0)
  if (measures.length > 0) {
    const topMeasures = measures.slice(0, 4);
    const kpiCount = topMeasures.length;
    const width = kpiCount === 4 ? 3 : kpiCount === 3 ? 4 : kpiCount === 2 ? 6 : 4;

    for (let i = 0; i < topMeasures.length; i++) {
      const mKey = topMeasures[i]!;
      const colProf = profile.columnProfiles.find((c) => c.columnKey === mKey);
      const isPercent = colProf?.inferredType === 'percent';
      const isCurrency = colProf?.inferredType === 'currency';
      const aggregation = isPercent ? 'avg' : 'sum';

      const kpi: KPIWidgetSpec = {
        id: `kpi_${mKey}`.slice(0, 128) as SafeIdentifier,
        type: 'kpi',
        title: `${isPercent ? 'Avg' : 'Total'} ${formatTitle(colProf?.originalName || mKey, 40)}`,
        description: `${aggregation.toUpperCase()} of ${colProf?.originalName || mKey}`,
        grid: {
          x: i * width,
          y: currentY,
          w: width,
          h: 2,
        },
        filterBindings: allFilterIds.length > 0 ? allFilterIds : undefined,
        measure: mKey,
        aggregation,
        format: isCurrency
          ? {
              currency: colProf?.currencyCode || 'USD',
              notation: 'standard',
            }
          : isPercent
          ? {
              suffix: '%',
              precision: 1,
            }
          : undefined,
      };

      widgets.push(kpi);
    }
    currentY += 2;
  } else {
    // Fallback: 1 KPI card for total record count
    const countCol =
      profile.primaryKeyCandidate ||
      profile.columnProfiles[0]?.columnKey ||
      ('id' as SafeIdentifier);

    const kpi: KPIWidgetSpec = {
      id: 'kpi_total_records',
      type: 'kpi',
      title: 'Total Records',
      description: 'Total number of rows in sheet',
      grid: {
        x: 0,
        y: currentY,
        w: 4,
        h: 2,
      },
      filterBindings: allFilterIds.length > 0 ? allFilterIds : undefined,
      measure: countCol,
      aggregation: 'count',
    };
    widgets.push(kpi);
    currentY += 2;
  }

  // 4. Trend Chart (Line) & Composition (Donut)
  const canHaveLine = timeCol !== undefined && measures.length > 0;
  const donutDimCol = profile.columnProfiles.find(
    (c) =>
      c.semanticRole === 'dimension' &&
      c.distinctCount >= 2 &&
      c.distinctCount <= 6
  );
  const canHaveDonut = donutDimCol !== undefined;

  let barPlacedInRow1 = false;

  if (canHaveLine && canHaveDonut) {
    // Both Line (w: 8) and Donut (w: 4) fit side-by-side on 12-column grid
    const lineMeasure = measures[0]!;
    const line: LineChartWidgetSpec = {
      id: `line_trend_${lineMeasure}`.slice(0, 128) as SafeIdentifier,
      type: 'line',
      title: `${formatTitle(lineMeasure, 30)} Over Time`,
      description: `Trend of ${lineMeasure} across ${timeCol}`,
      grid: {
        x: 0,
        y: currentY,
        w: 8,
        h: 5,
      },
      filterBindings: allFilterIds.length > 0 ? allFilterIds : undefined,
      timeDimension: timeCol!,
      measures: [lineMeasure],
      aggregation: 'sum',
      timeGranularity: 'month',
      showGrid: true,
      showLegend: true,
    };
    widgets.push(line);

    const donutMeasure = measures[1] || measures[0]!;
    const donut: DonutChartWidgetSpec = {
      id: `donut_breakdown_${donutDimCol.columnKey}`.slice(0, 128) as SafeIdentifier,
      type: 'donut',
      title: `By ${formatTitle(donutDimCol.originalName || donutDimCol.columnKey, 30)}`,
      description: `Distribution of ${donutMeasure} by ${donutDimCol.columnKey}`,
      grid: {
        x: 8,
        y: currentY,
        w: 4,
        h: 5,
      },
      filterBindings: allFilterIds.length > 0 ? allFilterIds : undefined,
      dimension: donutDimCol.columnKey,
      measure: donutMeasure,
      aggregation: 'sum',
      innerRadius: 0.6,
      showLegend: true,
    };
    widgets.push(donut);
    currentY += 5;
  } else if (canHaveLine) {
    // Only Line chart: full width 12
    const lineMeasure = measures[0]!;
    const line: LineChartWidgetSpec = {
      id: `line_trend_${lineMeasure}`.slice(0, 128) as SafeIdentifier,
      type: 'line',
      title: `${formatTitle(lineMeasure, 40)} Over Time`,
      description: `Trend of ${lineMeasure} across ${timeCol}`,
      grid: {
        x: 0,
        y: currentY,
        w: 12,
        h: 5,
      },
      filterBindings: allFilterIds.length > 0 ? allFilterIds : undefined,
      timeDimension: timeCol!,
      measures: [lineMeasure],
      aggregation: 'sum',
      timeGranularity: 'month',
      showGrid: true,
      showLegend: true,
    };
    widgets.push(line);
    currentY += 5;
  } else if (canHaveDonut) {
    // Donut alone (w: 6) paired with Bar (w: 6) if a bar dimension exists
    const donutMeasure = measures[0] || (profile.primaryKeyCandidate || profile.columnProfiles[0]?.columnKey || 'id');
    const donut: DonutChartWidgetSpec = {
      id: `donut_breakdown_${donutDimCol.columnKey}`.slice(0, 128) as SafeIdentifier,
      type: 'donut',
      title: `By ${formatTitle(donutDimCol.originalName || donutDimCol.columnKey, 30)}`,
      description: `Distribution of ${donutMeasure} by ${donutDimCol.columnKey}`,
      grid: {
        x: 0,
        y: currentY,
        w: 6,
        h: 5,
      },
      filterBindings: allFilterIds.length > 0 ? allFilterIds : undefined,
      dimension: donutDimCol.columnKey,
      measure: donutMeasure,
      aggregation: measures.length > 0 ? 'sum' : 'count',
      innerRadius: 0.6,
      showLegend: true,
    };
    widgets.push(donut);

    // Look for another dimension for the side-by-side bar chart
    const otherDim = dimensions.find((d) => d !== donutDimCol.columnKey);
    if (otherDim && measures.length > 0) {
      const barMeasure = measures[0]!;
      const bar: BarChartWidgetSpec = {
        id: `bar_breakdown_${otherDim}`.slice(0, 128) as SafeIdentifier,
        type: 'bar',
        title: `${formatTitle(barMeasure, 25)} by ${formatTitle(otherDim, 25)}`,
        description: `Breakdown of ${barMeasure} across ${otherDim}`,
        grid: {
          x: 6,
          y: currentY,
          w: 6,
          h: 5,
        },
        filterBindings: allFilterIds.length > 0 ? allFilterIds : undefined,
        dimension: otherDim,
        measures: [barMeasure],
        aggregation: 'sum',
        orientation: 'vertical',
        showGrid: true,
        limit: 15,
      };
      widgets.push(bar);
      barPlacedInRow1 = true;
    }
    currentY += 5;
  }

  // 5. Categorical Breakdown (Bar Chart)
  if (!barPlacedInRow1 && dimensions.length > 0 && measures.length > 0) {
    const barDim = dimensions[0]!;
    const barMeasure = measures[0]!;
    const bar: BarChartWidgetSpec = {
      id: `bar_breakdown_${barDim}`.slice(0, 128) as SafeIdentifier,
      type: 'bar',
      title: `${formatTitle(barMeasure, 30)} by ${formatTitle(barDim, 30)}`,
      description: `Categorical breakdown of ${barMeasure} by ${barDim}`,
      grid: {
        x: 0,
        y: currentY,
        w: 12,
        h: 5,
      },
      filterBindings: allFilterIds.length > 0 ? allFilterIds : undefined,
      dimension: barDim,
      measures: [barMeasure],
      aggregation: 'sum',
      orientation: 'vertical',
      showGrid: true,
      limit: 20,
    };
    widgets.push(bar);
    currentY += 5;
  }

  // 6. Pivot Table Widget (if >= 2 dimensions and >= 1 measure exist)
  if (dimensions.length >= 2 && measures.length >= 1) {
    const rowDim = dimensions[0]!;
    const colDim = dimensions[1]!;
    const pMeasure = measures[0]!;

    const pivot: PivotTableWidgetSpec = {
      id: 'pivot_matrix',
      type: 'pivot',
      title: `${formatTitle(pMeasure, 25)} Matrix (${formatTitle(rowDim, 20)} x ${formatTitle(colDim, 20)})`,
      description: `Cross-tabulation pivot matrix`,
      grid: {
        x: 0,
        y: currentY,
        w: 12,
        h: 6,
      },
      filterBindings: allFilterIds.length > 0 ? allFilterIds : undefined,
      rowDimensions: [rowDim],
      colDimensions: [colDim],
      measures: [
        {
          columnKey: pMeasure,
          aggregation: 'sum',
          label: formatTitle(pMeasure, 30),
        },
      ],
      showTotals: true,
      showSubtotals: true,
    };
    widgets.push(pivot);
    currentY += 6;
  }

  // 7. Tabular View (Record Table)
  const candidateTableCols: SafeIdentifier[] = [];
  if (profile.primaryKeyCandidate) {
    candidateTableCols.push(profile.primaryKeyCandidate);
  }
  for (const d of dimensions.slice(0, 4)) {
    if (!candidateTableCols.includes(d)) candidateTableCols.push(d);
  }
  for (const m of measures.slice(0, 4)) {
    if (!candidateTableCols.includes(m)) candidateTableCols.push(m);
  }
  // If still fewer than 3 columns, fill with other columns
  for (const c of profile.columnProfiles) {
    if (candidateTableCols.length >= 8) break;
    if (!candidateTableCols.includes(c.columnKey)) {
      candidateTableCols.push(c.columnKey);
    }
  }

  const tableColumnSpecs: TableColumnSpec[] = candidateTableCols.map((colKey) => {
    const colProf = profile.columnProfiles.find((c) => c.columnKey === colKey);
    const isNum = colProf?.semanticRole === 'measure';
    return {
      columnKey: colKey,
      header: formatTitle(colProf?.originalName || colKey, 30),
      align: isNum ? 'right' : 'left',
    };
  });

  const table: TableWidgetSpec = {
    id: 'table_records',
    type: 'table',
    title: 'Raw Records',
    description: 'Detailed tabular records from sheet',
    grid: {
      x: 0,
      y: currentY,
      w: 12,
      h: 6,
    },
    filterBindings: allFilterIds.length > 0 ? allFilterIds : undefined,
    columns: tableColumnSpecs,
    pageSize: 10,
    sortable: true,
    searchable: true,
  };
  widgets.push(table);

  // Cap widgets at 50 if exceeded
  const boundedWidgets = widgets.slice(0, 50);

  const spec: DashboardSpec = {
    version: '1.0',
    id: dashboardId,
    title,
    description,
    sheetBinding: profile.sheetId,
    layout: {
      columns: 12,
      gap: 16,
      padding: 16,
    },
    filters,
    widgets: boundedWidgets,
    theme: options?.theme || 'light',
  };

  return DashboardSpecSchema.parse(spec);
}
