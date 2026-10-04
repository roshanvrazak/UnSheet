import { DashboardSpec, LLMColumnProfile } from '@unsheet/contracts';

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
    const fallbackMeasure = profiles.find((p) => p.semanticRole === 'measure')?.columnKey || profiles[0]?.columnKey || 'revenue';
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
  queryPlan: any;
  suggestedWidget: any;
  explanation: string;
} {
  const lower = question.toLowerCase();

  const measures = profiles.filter((p) => p.semanticRole === 'measure' || p.inferredType === 'number' || p.inferredType === 'currency');
  const dimensions = profiles.filter((p) => p.semanticRole === 'dimension' || p.inferredType === 'category' || p.inferredType === 'text');

  const defaultMeasure = measures[0]?.columnKey || profiles[0]?.columnKey || 'revenue';
  const defaultDim = dimensions[0]?.columnKey || profiles[1]?.columnKey || profiles[0]?.columnKey || 'category';

  let sql = '';
  let intent = '';
  let widget: any = null;

  if (lower.includes('top') || lower.includes('best') || lower.includes('highest')) {
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
  } else if (lower.includes('average') || lower.includes('avg')) {
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
  } else if (lower.includes('total') || lower.includes('sum')) {
    intent = `Total sum of ${defaultMeasure} grouped by ${defaultDim}`;
    sql = `SELECT "${defaultDim}", SUM("${defaultMeasure}") AS "total_${defaultMeasure}" FROM "${sheetName}" GROUP BY "${defaultDim}" LIMIT 20;`;
    widget = {
      id: `kpi_${Date.now()}`,
      type: 'kpi',
      title: `Total ${defaultMeasure}`,
      grid: { x: 0, y: 0, w: 4, h: 4 },
      measure: defaultMeasure,
      aggregation: 'sum',
    };
  } else {
    intent = `Select all columns from ${sheetName}`;
    const cols = profiles.slice(0, 5).map((p) => `"${p.columnKey}"`).join(', ');
    sql = `SELECT ${cols} FROM "${sheetName}" LIMIT 50;`;
    widget = {
      id: `table_${Date.now()}`,
      type: 'table',
      title: `Data Table for ${sheetName}`,
      grid: { x: 0, y: 0, w: 12, h: 8 },
      columns: profiles.slice(0, 5).map((p) => ({ columnKey: p.columnKey, header: p.columnKey })),
      pageSize: 10,
    };
  }

  const queryPlan = {
    id: `plan_${Date.now()}`,
    table: sheetName,
    dimensions: [defaultDim],
    aggregations: [{ columnKey: defaultMeasure, function: 'sum', alias: `sum_${defaultMeasure}` }],
    limit: 50,
  };

  return {
    interpretedIntent: intent,
    sql,
    queryPlan,
    suggestedWidget: widget,
    explanation: `Generated rule-based SQL query and widget suggestion for question: "${question}".`,
  };
}
