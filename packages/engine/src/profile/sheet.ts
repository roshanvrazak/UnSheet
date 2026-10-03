import type {
  ColumnProfile,
  SafeIdentifier,
  SheetModel,
  SheetProfile,
} from '@unsheet/contracts';
import { ColumnProfileSchema, SheetProfileSchema } from '@unsheet/contracts';
import { inferColumnType } from './inference.js';
import { assignSemanticRole } from './roles.js';
import { computeColumnStats } from './stats.js';

/**
 * Profiles an individual SheetModel, computing column data types, statistical metrics,
 * semantic roles, and heuristic dashboard recommendations.
 */
export function profileSheet(sheet: SheetModel): SheetProfile {
  const columnProfiles: ColumnProfile[] = [];
  const recommendedDimensions: SafeIdentifier[] = [];
  const recommendedMeasures: SafeIdentifier[] = [];
  let recommendedTimeColumn: SafeIdentifier | undefined;
  let primaryKeyCandidate: SafeIdentifier | undefined;

  for (const col of sheet.columns) {
    const rawValues = sheet.rows.map((row) => row[col.key]);

    // 1. Infer Data Type
    const inference = inferColumnType(rawValues, {
      key: col.key,
      originalName: col.originalName,
    });

    // 2. Compute Statistics & Samples
    const statsResult = computeColumnStats(rawValues, inference.inferredType);

    // 3. Assign Semantic Role
    const semanticRole = assignSemanticRole({
      key: col.key,
      originalName: col.originalName,
      inferredType: inference.inferredType,
      uniquenessRatio: statsResult.uniquenessRatio,
      distinctCount: statsResult.distinctCount,
      totalCount: statsResult.totalCount,
    });

    const columnProfile: ColumnProfile = {
      columnKey: col.key,
      originalName: col.originalName,
      inferredType: inference.inferredType,
      semanticRole,
      nullable: statsResult.nullable,
      nullCount: statsResult.nullCount,
      totalCount: statsResult.totalCount,
      distinctCount: statsResult.distinctCount,
      uniquenessRatio: statsResult.uniquenessRatio,
      ...(statsResult.stats !== undefined ? { stats: statsResult.stats } : {}),
      ...(statsResult.topValues !== undefined ? { topValues: statsResult.topValues } : {}),
      sampleValues: statsResult.sampleValues,
      ...(inference.currencyCode !== undefined ? { currencyCode: inference.currencyCode } : {}),
      ...(inference.formatPattern !== undefined ? { formatPattern: inference.formatPattern } : {}),
    };

    // Ensure strictly valid ColumnProfile
    const validatedCol = ColumnProfileSchema.parse(columnProfile);
    columnProfiles.push(validatedCol);

    // 4. Populate Recommendations
    if (semanticRole === 'time' && !recommendedTimeColumn) {
      recommendedTimeColumn = col.key;
    } else if (semanticRole === 'measure') {
      recommendedMeasures.push(col.key);
    } else if (semanticRole === 'dimension') {
      recommendedDimensions.push(col.key);
    }

    // 5. Primary Key Detection
    // Must be unique, non-null, and have identifier role or id/code/sku name
    if (
      !primaryKeyCandidate &&
      statsResult.nullCount === 0 &&
      statsResult.distinctCount === statsResult.totalCount &&
      statsResult.totalCount > 0 &&
      (semanticRole === 'identifier' ||
        inference.inferredType === 'id' ||
        col.key.endsWith('_id') ||
        col.key.endsWith('_code') ||
        col.key.endsWith('_sku') ||
        col.key === 'id')
    ) {
      primaryKeyCandidate = col.key;
    }
  }

  // Fallback for primaryKeyCandidate if no identifier keyword matched but a unique column exists
  if (!primaryKeyCandidate) {
    const uniqueCol = columnProfiles.find(
      (c) => c.nullCount === 0 && c.distinctCount === c.totalCount && c.totalCount > 0
    );
    if (uniqueCol && uniqueCol.semanticRole === 'identifier') {
      primaryKeyCandidate = uniqueCol.columnKey;
    }
  }

  const profile: SheetProfile = {
    sheetId: sheet.id,
    sheetName: sheet.name,
    rowCount: sheet.rowCount,
    columnProfiles,
    ...(primaryKeyCandidate !== undefined ? { primaryKeyCandidate } : {}),
    recommendedDimensions,
    recommendedMeasures,
    ...(recommendedTimeColumn !== undefined ? { recommendedTimeColumn } : {}),
  };

  return SheetProfileSchema.parse(profile);
}
