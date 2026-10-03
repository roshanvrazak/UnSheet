import type {
  AddedColumn,
  DashboardSpec,
  DriftReport,
  InferredDataType,
  RemappingSuggestion,
  SafeIdentifier,
  SheetProfile,
  TypeMismatch,
} from '@unsheet/contracts';
import { DriftReportSchema } from '@unsheet/contracts';
import { isCoercible } from './coercion.js';
import { calculateColumnSimilarity } from './similarity.js';

export interface DriftDetectOptions {
  templateProfile?: SheetProfile;
}

interface ExpectedColumn {
  key: SafeIdentifier;
  expectedType: InferredDataType;
}

/**
 * Extracts expected column keys and inferred types referenced across filters and widgets
 * in a template DashboardSpec.
 */
export function extractExpectedColumns(spec: DashboardSpec): ExpectedColumn[] {
  const colMap = new Map<SafeIdentifier, InferredDataType>();

  // 1. Global Filters
  for (const filter of spec.filters) {
    const type: InferredDataType =
      filter.type === 'date-range'
        ? 'date'
        : filter.type === 'numeric-range'
        ? 'number'
        : 'category';
    if (!colMap.has(filter.columnKey)) {
      colMap.set(filter.columnKey, type);
    }
  }

  // 2. Widgets
  for (const widget of spec.widgets) {
    switch (widget.type) {
      case 'kpi': {
        const type: InferredDataType = widget.format?.currency
          ? 'currency'
          : widget.format?.suffix === '%'
          ? 'percent'
          : 'number';
        if (!colMap.has(widget.measure)) colMap.set(widget.measure, type);
        break;
      }
      case 'line': {
        if (!colMap.has(widget.timeDimension)) colMap.set(widget.timeDimension, 'date');
        for (const m of widget.measures) {
          if (!colMap.has(m)) colMap.set(m, 'number');
        }
        break;
      }
      case 'bar': {
        if (!colMap.has(widget.dimension)) colMap.set(widget.dimension, 'category');
        for (const m of widget.measures) {
          if (!colMap.has(m)) colMap.set(m, 'number');
        }
        break;
      }
      case 'donut': {
        if (!colMap.has(widget.dimension)) colMap.set(widget.dimension, 'category');
        if (!colMap.has(widget.measure)) colMap.set(widget.measure, 'number');
        break;
      }
      case 'table': {
        for (const col of widget.columns) {
          const key = col.columnKey.toLowerCase();
          const type: InferredDataType = col.format?.currency
            ? 'currency'
            : col.format?.suffix === '%'
            ? 'percent'
            : key.endsWith('_id') || key === 'id' || key.endsWith('_code') || key.endsWith('_sku')
            ? 'id'
            : key.includes('date') || key.includes('time')
            ? 'date'
            : 'text';
          if (!colMap.has(col.columnKey)) colMap.set(col.columnKey, type);
        }
        break;
      }
      case 'pivot': {
        for (const r of widget.rowDimensions) {
          if (!colMap.has(r)) colMap.set(r, 'category');
        }
        if (widget.colDimensions) {
          for (const c of widget.colDimensions) {
            if (!colMap.has(c)) colMap.set(c, 'category');
          }
        }
        for (const m of widget.measures) {
          const type: InferredDataType = m.format?.currency ? 'currency' : 'number';
          if (!colMap.has(m.columnKey)) colMap.set(m.columnKey, type);
        }
        break;
      }
    }
  }

  return Array.from(colMap.entries()).map(([key, expectedType]) => ({
    key,
    expectedType,
  }));
}

/**
 * Compares an expected template DashboardSpec against a newly uploaded SheetProfile,
 * discovering matched columns, missing columns, added columns, type mismatches,
 * and high-confidence column remapping recommendations.
 */
export function detectDrift(
  templateSpec: DashboardSpec,
  newSheetProfile: SheetProfile,
  options?: DriftDetectOptions
): DriftReport {
  // 1. Build Expected Columns Map
  const expectedCols: ExpectedColumn[] = options?.templateProfile
    ? options.templateProfile.columnProfiles.map((c) => ({
        key: c.columnKey,
        expectedType: c.inferredType,
      }))
    : extractExpectedColumns(templateSpec);

  const newColMap = new Map(
    newSheetProfile.columnProfiles.map((c) => [c.columnKey, c])
  );
  const expectedKeySet = new Set(expectedCols.map((c) => c.key));

  const matchedColumns: Array<{
    expectedKey: SafeIdentifier;
    actualKey: SafeIdentifier;
    confidence: number;
  }> = [];
  const missingColumns: SafeIdentifier[] = [];
  const typeMismatches: TypeMismatch[] = [];
  const addedColumns: AddedColumn[] = [];
  const suggestedRemappings: RemappingSuggestion[] = [];

  // 2. Evaluate Expected Columns against New Sheet
  for (const exp of expectedCols) {
    const actual = newColMap.get(exp.key);
    if (actual) {
      if (actual.inferredType === exp.expectedType) {
        matchedColumns.push({
          expectedKey: exp.key,
          actualKey: exp.key,
          confidence: 1.0,
        });
      } else {
        const coercible = isCoercible(exp.expectedType, actual.inferredType);
        typeMismatches.push({
          columnKey: exp.key,
          expectedType: exp.expectedType,
          actualType: actual.inferredType,
          isCoercible: coercible,
        });

        if (coercible) {
          matchedColumns.push({
            expectedKey: exp.key,
            actualKey: exp.key,
            confidence: 0.85,
          });
        }
      }
    } else {
      missingColumns.push(exp.key);
    }
  }

  // 3. Discover Added Columns
  for (const col of newSheetProfile.columnProfiles) {
    if (!expectedKeySet.has(col.columnKey)) {
      addedColumns.push({
        columnKey: col.columnKey,
        originalName: col.originalName,
        inferredType: col.inferredType,
        sampleValues: col.sampleValues,
      });
    }
  }

  // 4. Compute Suggested Remappings for Missing Columns
  const usedAddedCols = new Set<string>();

  for (const mKey of missingColumns) {
    const expInfo = expectedCols.find((c) => c.key === mKey);
    const expType = expInfo?.expectedType || 'text';

    let bestScore = 0;
    let bestAddedCol: AddedColumn | undefined;

    for (const added of addedColumns) {
      if (usedAddedCols.has(added.columnKey)) continue;

      const simKey = calculateColumnSimilarity(mKey, added.columnKey);
      const simName = calculateColumnSimilarity(mKey, added.originalName);
      let sim = Math.max(simKey, simName);

      // Type compatibility adjustment
      if (added.inferredType === expType) {
        sim += 0.2;
      } else if (isCoercible(expType, added.inferredType)) {
        sim += 0.05;
      } else {
        sim -= 0.25;
      }

      const score = Math.min(1.0, Math.max(0.0, Number(sim.toFixed(3))));

      if (score > bestScore) {
        bestScore = score;
        bestAddedCol = added;
      }
    }

    if (bestAddedCol && bestScore >= 0.6) {
      usedAddedCols.add(bestAddedCol.columnKey);
      suggestedRemappings.push({
        missingKey: mKey,
        suggestedKey: bestAddedCol.columnKey,
        confidence: bestScore,
        rationale: `String similarity match (${bestScore.toFixed(2)}) with compatible type ${bestAddedCol.inferredType}`,
      });
    }
  }

  // 5. Evaluate Breaking Changes
  const remappedMissingKeys = new Set(
    suggestedRemappings.filter((r) => r.confidence >= 0.8).map((r) => r.missingKey)
  );
  const unmappedMissing = missingColumns.some((m) => !remappedMissingKeys.has(m));
  const hasIncompatibleType = typeMismatches.some((tm) => !tm.isCoercible);
  const hasBreakingChanges = unmappedMissing || hasIncompatibleType;

  // 6. Compute Overall Confidence Score
  const totalExpected = Math.max(1, expectedCols.length);
  const matchedScore = matchedColumns.reduce((sum, m) => sum + m.confidence, 0);
  const remappedScore = suggestedRemappings
    .filter((r) => r.confidence >= 0.7)
    .reduce((sum, r) => sum + r.confidence * 0.9, 0);

  const overallConfidence = Math.min(
    1.0,
    Math.max(0.0, Number(((matchedScore + remappedScore) / totalExpected).toFixed(3)))
  );

  const report: DriftReport = {
    templateId: templateSpec.id,
    sourceSheetName: newSheetProfile.sheetName,
    overallConfidence,
    hasBreakingChanges,
    matchedColumns,
    missingColumns,
    addedColumns,
    typeMismatches,
    suggestedRemappings,
  };

  return DriftReportSchema.parse(report);
}
