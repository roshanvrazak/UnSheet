import { DashboardSpec, LLMColumnProfile, WidgetSpec, QueryPlan } from '@unsheet/contracts';

export function deterministicRefineSpec(
  prompt: string,
  currentSpec: DashboardSpec,
  profiles: LLMColumnProfile[]
): { updatedSpec: DashboardSpec; explanation: string; appliedChanges: string[] } {
  const lower = prompt.toLowerCase();
  const spec: DashboardSpec = JSON.parse(JSON.stringify(currentSpec));
  const appliedChanges: string[] = [];

  const titleMatch = prompt.match(/(?:change|set)\s+title\s+to\s+["']?([^"']+)["']?/i);
  if (titleMatch && titleMatch[1]) {
    const newTitle = titleMatch[1].trim();
    spec.title = newTitle;
    appliedChanges.push(`Changed dashboard title to "${newTitle}"`);
  }

  const kpiMatch = prompt.match(/add\s+kpi\s+(?:for|column|metric)?\s*["']?([a-zA-Z0-9_]+)["']?/i);
  if (kpiMatch && kpiMatch[1]) {
    const colKey = kpiMatch[1].trim();
    const matchingProfile = profiles.find((p) => p.columnKey.toLowerCase() === colKey.toLowerCase());
    const fallbackMeasure = profiles.find((p) => p.semanticRole === 'measure')?.columnKey || profiles[0]?.columnKey || 'id';
    const targetCol = matchingProfile ? matchingProfile.columnKey : fallbackMeasure;

    const maxY = spec.widgets.reduce((max, w) => Math.max(max, w.grid.y + w.grid.h), 0);
    const newWidget = {
      id: `kpi_${Date.now()}`,
      type: 'kpi' as const,
      title: `${targetCol.replace(/_/g, ' ')} KPI`,
      description: `Automated KPI for ${targetCol}`,
      grid: { x: 0, y: maxY, w: 4, h: 4 },
      measure: targetCol,
      aggregation: 'sum' as const,
    };
    spec.widgets.push(newWidget);
    appliedChanges.push(`Added KPI widget for column "${targetCol}"`);
  }

  // Convert chart types (e.g. "change bar chart to donut", "make it a donut", "convert to line chart")
  if (lower.includes('donut') || lower.includes('pie')) {
    const targetIdx = spec.widgets.findIndex((w) => w.type === 'bar' || w.type === 'line');
    if (targetIdx !== -1) {
      const oldW = spec.widgets[targetIdx] as unknown as Record<string, unknown>;
      const dim = (typeof oldW.dimension === 'string' ? oldW.dimension : undefined) || profiles.find((p) => p.semanticRole === 'dimension')?.columnKey || profiles[0]?.columnKey || 'category';
      const meas = (Array.isArray(oldW.measures) && typeof oldW.measures[0] === 'string' ? oldW.measures[0] : undefined) || (typeof oldW.measure === 'string' ? oldW.measure : undefined) || profiles.find((p) => p.semanticRole === 'measure')?.columnKey || 'id';
      spec.widgets[targetIdx] = {
        id: typeof oldW.id === 'string' ? oldW.id : `donut_${Date.now()}`,
        type: 'donut',
        title: typeof oldW.title === 'string' ? oldW.title.replace(/chart|bar|line/gi, 'Breakdown') : 'Category Breakdown',
        description: typeof oldW.description === 'string' ? oldW.description : undefined,
        grid: (oldW.grid as { x: number; y: number; w: number; h: number }) || { x: 0, y: 0, w: 6, h: 6 },
        dimension: dim,
        measure: meas,
        aggregation: (typeof oldW.aggregation === 'string' ? oldW.aggregation : 'sum') as 'sum' | 'avg' | 'count' | 'min' | 'max',
        innerRadius: 0.6,
        showLegend: true,
      };
      appliedChanges.push(`Converted widget to donut chart for "${dim}" by "${meas}"`);
    }
  } else if (lower.includes('bar')) {
    const targetIdx = spec.widgets.findIndex((w) => w.type === 'donut' || w.type === 'line');
    if (targetIdx !== -1) {
      const oldW = spec.widgets[targetIdx] as unknown as Record<string, unknown>;
      const dim = (typeof oldW.dimension === 'string' ? oldW.dimension : undefined) || profiles.find((p) => p.semanticRole === 'dimension')?.columnKey || profiles[0]?.columnKey || 'category';
      const meas = (typeof oldW.measure === 'string' ? oldW.measure : undefined) || (Array.isArray(oldW.measures) && typeof oldW.measures[0] === 'string' ? oldW.measures[0] : undefined) || profiles.find((p) => p.semanticRole === 'measure')?.columnKey || 'id';
      spec.widgets[targetIdx] = {
        id: typeof oldW.id === 'string' ? oldW.id : `bar_${Date.now()}`,
        type: 'bar',
        title: typeof oldW.title === 'string' ? oldW.title.replace(/donut|pie|line/gi, 'Bar Chart') : 'Metric Bar Chart',
        description: typeof oldW.description === 'string' ? oldW.description : undefined,
        grid: (oldW.grid as { x: number; y: number; w: number; h: number }) || { x: 0, y: 0, w: 6, h: 6 },
        dimension: dim,
        measures: [meas],
        aggregation: (typeof oldW.aggregation === 'string' ? oldW.aggregation : 'sum') as 'sum' | 'avg' | 'count' | 'min' | 'max',
        orientation: 'vertical',
      };
      appliedChanges.push(`Converted widget to bar chart for "${dim}" by "${meas}"`);
    }
  } else if (lower.includes('line') || lower.includes('trend')) {
    const targetIdx = spec.widgets.findIndex((w) => w.type === 'bar' || w.type === 'donut');
    if (targetIdx !== -1) {
      const oldW = spec.widgets[targetIdx] as unknown as Record<string, unknown>;
      const timeCol = profiles.find((p) => p.semanticRole === 'time' || p.inferredType === 'date')?.columnKey || (typeof oldW.dimension === 'string' ? oldW.dimension : undefined) || profiles[0]?.columnKey || 'date';
      const meas = (Array.isArray(oldW.measures) && typeof oldW.measures[0] === 'string' ? oldW.measures[0] : undefined) || (typeof oldW.measure === 'string' ? oldW.measure : undefined) || profiles.find((p) => p.semanticRole === 'measure')?.columnKey || 'id';
      spec.widgets[targetIdx] = {
        id: typeof oldW.id === 'string' ? oldW.id : `line_${Date.now()}`,
        type: 'line',
        title: typeof oldW.title === 'string' ? oldW.title.replace(/bar|donut/gi, 'Trend') : 'Metric Trend',
        description: typeof oldW.description === 'string' ? oldW.description : undefined,
        grid: (oldW.grid as { x: number; y: number; w: number; h: number }) || { x: 0, y: 0, w: 8, h: 6 },
        timeDimension: timeCol,
        measures: [meas],
        aggregation: (typeof oldW.aggregation === 'string' ? oldW.aggregation : 'sum') as 'sum' | 'avg' | 'count' | 'min' | 'max',
        showGrid: true,
        showLegend: true,
      };
      appliedChanges.push(`Converted widget to line trend chart for "${meas}" across "${timeCol}"`);
    }
  }

  if (appliedChanges.length === 0) {
    if (lower.includes('dark') || lower.includes('night')) {
      spec.theme = 'dark';
      appliedChanges.push('Switched dashboard theme to dark');
    } else if (lower.includes('light')) {
      spec.theme = 'light';
      appliedChanges.push('Switched dashboard theme to light');
    } else {
      spec.description = (spec.description ? spec.description + ' ' : '') + `(Refined: ${prompt})`;
      appliedChanges.push(`Updated dashboard description with refinement request`);
    }
  }

  return {
    updatedSpec: spec,
    explanation: `Successfully applied refinement rule-based fallback for prompt: "${prompt}".`,
    appliedChanges,
  };
}

export function deterministicAskQuery(
  question: string,
  sheetName: string,
  profiles: LLMColumnProfile[]
): {
  interpretedIntent: string;
  sql: string;
  queryPlan: QueryPlan | undefined;
  suggestedWidget: WidgetSpec | undefined;
  explanation: string;
} {
  const lower = question.toLowerCase();

  // Find if user specifically mentioned any column in their question
  const mentionedCols = profiles.filter((p) => {
    const key = p.columnKey.toLowerCase().replace(/_/g, ' ');
    const orig = (p.originalName || '').toLowerCase();
    return (
      lower.includes(key) ||
      (orig.length > 2 && lower.includes(orig)) ||
      (p.columnKey.length > 2 && lower.includes(p.columnKey.toLowerCase()))
    );
  });

  const measures = profiles.filter(
    (p) => p.semanticRole === 'measure' || p.inferredType === 'number' || p.inferredType === 'currency'
  );
  const dimensions = profiles.filter(
    (p) => p.semanticRole === 'dimension' || p.inferredType === 'category' || p.inferredType === 'text'
  );

  // Preferred measure: mentioned measure, or first measure in schema
  const mentionedMeasure = mentionedCols.find((p) =>
    measures.some((m) => m.columnKey === p.columnKey)
  );
  const defaultMeasure = mentionedMeasure?.columnKey || measures[0]?.columnKey;

  // Preferred dimension: mentioned dimension, or first dimension in schema
  const mentionedDim = mentionedCols.find((p) =>
    dimensions.some((d) => d.columnKey === p.columnKey)
  );
  const defaultDim =
    mentionedDim?.columnKey ||
    dimensions[0]?.columnKey ||
    profiles.find((p) => p.columnKey !== defaultMeasure)?.columnKey ||
    profiles[0]?.columnKey;

  let sql = '';
  let intent = '';
  let widget: WidgetSpec | null = null;
  const isTop = lower.includes('top') || lower.includes('best') || lower.includes('highest');
  const isAvg = lower.includes('average') || lower.includes('avg') || lower.includes('mean');
  const isTotal = lower.includes('total') || lower.includes('sum');

  if (isTop && defaultMeasure && defaultDim && defaultMeasure !== defaultDim) {
    const limitMatch = lower.match(/(?:top|first)\s+(\d+)/);
    const limit = limitMatch && limitMatch[1] ? parseInt(limitMatch[1], 10) : 5;
    intent = `Top ${limit} records grouped by ${defaultDim} ordered by ${defaultMeasure} descending`;
    sql = `SELECT "${defaultDim}", SUM("${defaultMeasure}") AS "total_${defaultMeasure}" FROM "${sheetName}" GROUP BY "${defaultDim}" ORDER BY "total_${defaultMeasure}" DESC LIMIT ${limit};`;
    widget = {
      id: `bar_${Date.now()}`,
      type: 'bar',
      title: `Top ${limit} ${defaultDim} by ${defaultMeasure}`,
      grid: { x: 0, y: 0, w: 6, h: 6 },
      dimension: defaultDim,
      measures: [defaultMeasure],
      aggregation: 'sum',
      orientation: 'vertical',
    };
  } else if (isAvg && defaultMeasure) {
    if (defaultDim && defaultDim !== defaultMeasure) {
      intent = `Average of ${defaultMeasure} grouped by ${defaultDim}`;
      sql = `SELECT "${defaultDim}", AVG("${defaultMeasure}") AS "avg_${defaultMeasure}" FROM "${sheetName}" GROUP BY "${defaultDim}" LIMIT 20;`;
      widget = {
        id: `bar_${Date.now()}`,
        type: 'bar',
        title: `Average ${defaultMeasure} by ${defaultDim}`,
        grid: { x: 0, y: 0, w: 6, h: 6 },
        dimension: defaultDim,
        measures: [defaultMeasure],
        aggregation: 'avg',
        orientation: 'vertical',
      };
    } else {
      intent = `Average of ${defaultMeasure}`;
      sql = `SELECT AVG("${defaultMeasure}") AS "avg_${defaultMeasure}" FROM "${sheetName}";`;
      widget = {
        id: `kpi_${Date.now()}`,
        type: 'kpi',
        title: `Average ${defaultMeasure}`,
        grid: { x: 0, y: 0, w: 4, h: 4 },
        measure: defaultMeasure,
        aggregation: 'avg',
      };
    }
  } else if (isTotal && defaultMeasure) {
    if (defaultDim && defaultDim !== defaultMeasure && (lower.includes('by') || lower.includes('per') || mentionedDim)) {
      intent = `Total sum of ${defaultMeasure} grouped by ${defaultDim}`;
      sql = `SELECT "${defaultDim}", SUM("${defaultMeasure}") AS "total_${defaultMeasure}" FROM "${sheetName}" GROUP BY "${defaultDim}" LIMIT 20;`;
      widget = {
        id: `bar_${Date.now()}`,
        type: 'bar',
        title: `Total ${defaultMeasure} by ${defaultDim}`,
        grid: { x: 0, y: 0, w: 6, h: 6 },
        dimension: defaultDim,
        measures: [defaultMeasure],
        aggregation: 'sum',
        orientation: 'vertical',
      };
    } else {
      intent = `Total sum of ${defaultMeasure}`;
      sql = `SELECT SUM("${defaultMeasure}") AS "total_${defaultMeasure}" FROM "${sheetName}";`;
      widget = {
        id: `kpi_${Date.now()}`,
        type: 'kpi',
        title: `Total ${defaultMeasure}`,
        grid: { x: 0, y: 0, w: 4, h: 4 },
        measure: defaultMeasure,
        aggregation: 'sum',
      };
    }
  } else if ((lower.includes('count') || lower.includes('how many')) && defaultDim) {
    intent = `Count of records grouped by ${defaultDim}`;
    sql = `SELECT "${defaultDim}", COUNT("${defaultDim}") AS "count_records" FROM "${sheetName}" GROUP BY "${defaultDim}" LIMIT 20;`;
    widget = {
      id: `bar_${Date.now()}`,
      type: 'bar',
      title: `Count by ${defaultDim}`,
      grid: { x: 0, y: 0, w: 6, h: 6 },
      dimension: defaultDim,
      measures: [defaultDim],
      aggregation: 'count',
      orientation: 'vertical',
    };
  } else {
    intent = `Select records from ${sheetName}`;
    const selectedProfiles = profiles.slice(0, 6);
    const cols = selectedProfiles.map((p) => `"${p.columnKey}"`).join(', ');
    sql = `SELECT ${cols || '*'} FROM "${sheetName}" LIMIT 50;`;
    widget = {
      id: `table_${Date.now()}`,
      type: 'table',
      title: `Data Table (${sheetName})`,
      grid: { x: 0, y: 0, w: 12, h: 8 },
      columns: selectedProfiles.map((p) => ({ columnKey: p.columnKey, header: p.originalName || p.columnKey })),
      pageSize: 10,
    };
  }

  const queryPlan: QueryPlan | undefined = defaultMeasure && defaultDim ? {
    id: `plan_${Date.now()}`,
    table: sheetName,
    dimensions: [defaultDim],
    aggregations: [{ columnKey: defaultMeasure, function: 'sum' as const, alias: `sum_${defaultMeasure}` }],
    limit: 50,
  } : undefined;

  return {
    interpretedIntent: intent,
    sql,
    queryPlan,
    suggestedWidget: widget || undefined,
    explanation: `Generated query and visualization for: "${question}".`,
  };
}
