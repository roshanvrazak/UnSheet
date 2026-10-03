import type { SafeIdentifier, SheetModel, WorkbookModel } from '@unsheet/contracts';
import { inferColumnType } from './inference.js';

export interface JoinCandidate {
  fromSheet: string;
  fromColumn: SafeIdentifier;
  toSheet: string;
  toColumn: SafeIdentifier;
  overlapRatio: number;
  confidence: number;
}

/**
 * Extracts the base semantic stem of an identifier by stripping common key/ID suffixes.
 * E.g., "customer_id" -> "customer", "order_ref" -> "order".
 */
export function extractStem(key: string): string {
  const stem = key
    .toLowerCase()
    .replace(/(_id|_code|_key|_sku|_ref|_no|_number)$/, '')
    .replace(/^id_/, '')
    .replace(/^_|_$/, '');
  return stem;
}

/**
 * Checks whether two column names share a naming stem or common entity relationship.
 */
export function areNamesCompatible(keyA: string, keyB: string): boolean {
  const lowerA = keyA.toLowerCase();
  const lowerB = keyB.toLowerCase();

  if (lowerA === lowerB) {
    return true;
  }

  const stemA = extractStem(lowerA);
  const stemB = extractStem(lowerB);

  if (stemA.length >= 3 && stemB.length >= 3 && stemA === stemB) {
    return true;
  }

  if (stemA.length >= 3 && lowerB.includes(stemA)) {
    return true;
  }

  if (stemB.length >= 3 && lowerA.includes(stemB)) {
    return true;
  }

  // Common ID naming combinations like "id" and "customer_id"
  if (lowerA === 'id' && (lowerB.endsWith('_id') || lowerB.startsWith('id_'))) {
    return true;
  }
  if (lowerB === 'id' && (lowerA.endsWith('_id') || lowerA.startsWith('id_'))) {
    return true;
  }

  return false;
}

/**
 * Detects foreign key and join candidate pairs across sheets in a workbook model
 * based on naming stem, type compatibility, and value set overlap > 50%.
 */
export function findJoinCandidates(
  sheets: SheetModel[] | WorkbookModel
): JoinCandidate[] {
  const sheetList = Array.isArray(sheets) ? sheets : sheets.sheets;
  if (sheetList.length < 2) {
    return [];
  }

  const candidates: JoinCandidate[] = [];

  for (let i = 0; i < sheetList.length; i++) {
    for (let j = 0; j < sheetList.length; j++) {
      if (i === j) continue;

      const sheetA = sheetList[i]!;
      const sheetB = sheetList[j]!;

      for (const colA of sheetA.columns) {
        const valuesA = sheetA.rows.map((r) => r[colA.key]);
        const setA = new Set(
          valuesA
            .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
            .map((v) => String(v).trim())
        );

        if (setA.size === 0) continue;

        const typeA = inferColumnType(valuesA, { key: colA.key, originalName: colA.originalName }).inferredType;

        for (const colB of sheetB.columns) {
          const valuesB = sheetB.rows.map((r) => r[colB.key]);
          const setB = new Set(
            valuesB
              .filter((v) => v !== null && v !== undefined && String(v).trim() !== '')
              .map((v) => String(v).trim())
          );

          if (setB.size === 0) continue;

          // Check naming compatibility
          if (!areNamesCompatible(colA.key, colB.key)) {
            continue;
          }

          const typeB = inferColumnType(valuesB, { key: colB.key, originalName: colB.originalName }).inferredType;

          // Check type compatibility
          const typesCompatible =
            typeA === typeB ||
            ((typeA === 'id' || typeA === 'text') && (typeB === 'id' || typeB === 'text')) ||
            (typeA === 'number' && typeB === 'number');

          if (!typesCompatible) {
            continue;
          }

          // Compute set overlap
          let intersectCount = 0;
          for (const item of setA) {
            if (setB.has(item)) {
              intersectCount++;
            }
          }

          const minSize = Math.min(setA.size, setB.size);
          const overlapRatio = Number((intersectCount / minSize).toFixed(4));

          if (intersectCount >= 1 && overlapRatio > 0.5) {
            const isExactName = colA.key === colB.key;
            const confidence = Math.min(
              1.0,
              Number((0.5 + 0.3 * overlapRatio + (isExactName ? 0.2 : 0.1)).toFixed(2))
            );

            candidates.push({
              fromSheet: sheetA.name,
              fromColumn: colA.key,
              toSheet: sheetB.name,
              toColumn: colB.key,
              overlapRatio,
              confidence,
            });
          }
        }
      }
    }
  }

  return candidates;
}
