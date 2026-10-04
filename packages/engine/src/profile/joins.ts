import type {
  JoinCandidate,
  SheetModel,
  WorkbookModel,
} from '@unsheet/contracts';
import { JoinCandidateSchema } from '@unsheet/contracts';
import { safeToString } from '../normalise/cell.js';
import { inferColumnType } from './inference.js';

export { type JoinCandidate } from '@unsheet/contracts';

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
  if (lowerA === 'id' && (lowerB.endsWith('_id') || lowerB.startsWith('id_') || lowerB.endsWith('_code'))) {
    return true;
  }
  if (lowerB === 'id' && (lowerA.endsWith('_id') || lowerA.startsWith('id_') || lowerA.endsWith('_code'))) {
    return true;
  }

  return false;
}

interface ColumnCache {
  key: string;
  originalName: string;
  inferredType: string;
  uniqueSet: Set<string>;
  valuesSample: unknown[];
}

interface SheetCache {
  name: string;
  columns: ColumnCache[];
}

/**
 * Detects foreign key and join candidate pairs across sheets in a workbook model
 * based on naming stem, type compatibility, and value set overlap > 50%.
 *
 * Optimizations (SEC-P2-01, REV-P2-04, REV-P2-06):
 * - Samples up to 2,000 rows per sheet to bound combinatorial runtime
 * - Pre-computes unique value sets once per sheet column
 * - Pre-filters candidate pairs by naming compatibility and type matching before set operations
 * - Canonical deduplication prevents reciprocal duplicate pairs
 */
export function findJoinCandidates(
  sheets: SheetModel[] | WorkbookModel
): JoinCandidate[] {
  const sheetList = Array.isArray(sheets) ? sheets : sheets.sheets;
  if (sheetList.length < 2) {
    return [];
  }

  const MAX_SAMPLE_ROWS = 2000;

  // 1. Pre-compute Column Caches upfront once per sheet column
  const sheetCaches: SheetCache[] = sheetList.map((sheet) => {
    const rowSample =
      sheet.rows.length > MAX_SAMPLE_ROWS
        ? sheet.rows.slice(0, MAX_SAMPLE_ROWS)
        : sheet.rows;

    const columnCaches: ColumnCache[] = sheet.columns.map((col) => {
      const values = rowSample.map((r) => r[col.key]);
      const uniqueSet = new Set<string>();

      for (const v of values) {
        if (v !== null && v !== undefined) {
          const str = safeToString(v).trim();
          if (str !== '') {
            uniqueSet.add(str);
          }
        }
      }

      const inference = inferColumnType(values, {
        key: col.key,
        originalName: col.originalName,
      });

      return {
        key: col.key,
        originalName: col.originalName,
        inferredType: inference.inferredType,
        uniqueSet,
        valuesSample: values,
      };
    });

    return {
      name: sheet.name,
      columns: columnCaches,
    };
  });

  const candidates: JoinCandidate[] = [];
  const seenPairs = new Set<string>();

  // 2. Pairwise Sheet Comparison (i < j ensures no reciprocal duplicates)
  for (let i = 0; i < sheetCaches.length; i++) {
    for (let j = i + 1; j < sheetCaches.length; j++) {
      const sheetA = sheetCaches[i]!;
      const sheetB = sheetCaches[j]!;

      for (const colA of sheetA.columns) {
        if (colA.uniqueSet.size === 0) continue;

        for (const colB of sheetB.columns) {
          if (colB.uniqueSet.size === 0) continue;

          // Pre-filter: Check naming compatibility first
          if (!areNamesCompatible(colA.key, colB.key)) {
            continue;
          }

          // Pre-filter: Check type compatibility
          const typeA = colA.inferredType;
          const typeB = colB.inferredType;
          const typesCompatible =
            typeA === typeB ||
            ((typeA === 'id' || typeA === 'text') && (typeB === 'id' || typeB === 'text')) ||
            (typeA === 'number' && typeB === 'number');

          if (!typesCompatible) {
            continue;
          }

          // Fast Set Intersection using smaller set
          const [smaller, larger] =
            colA.uniqueSet.size <= colB.uniqueSet.size
              ? [colA.uniqueSet, colB.uniqueSet]
              : [colB.uniqueSet, colA.uniqueSet];

          let intersectCount = 0;
          const sampleMatches: string[] = [];

          for (const item of smaller) {
            if (larger.has(item)) {
              intersectCount++;
              if (sampleMatches.length < 10) {
                sampleMatches.push(item.slice(0, 64));
              }
            }
          }

          const minSize = Math.min(colA.uniqueSet.size, colB.uniqueSet.size);
          const overlapRatio = Number((intersectCount / minSize).toFixed(4));

          if (intersectCount >= 1 && overlapRatio > 0.5) {
            const isExactName = colA.key === colB.key;
            const confidence = Math.min(
              1.0,
              Number((0.5 + 0.3 * overlapRatio + (isExactName ? 0.2 : 0.1)).toFixed(2))
            );

            // Determine canonical direction: child (more specific / referencing) -> parent
            const ratioAtoB = intersectCount / colA.uniqueSet.size;
            const ratioBtoA = intersectCount / colB.uniqueSet.size;

            const isAChild = ratioAtoB >= ratioBtoA;
            const sourceSheet = isAChild ? sheetA.name : sheetB.name;
            const sourceColumn = isAChild ? colA.key : colB.key;
            const targetSheet = isAChild ? sheetB.name : sheetA.name;
            const targetColumn = isAChild ? colB.key : colA.key;

            const pairKey = `${sourceSheet}.${sourceColumn}->${targetSheet}.${targetColumn}`;
            if (seenPairs.has(pairKey)) continue;
            seenPairs.add(pairKey);

            const candidate: JoinCandidate = {
              sourceSheet,
              sourceColumn,
              targetSheet,
              targetColumn,
              confidence,
              overlapRatio,
              sampleMatches,
            };

            const parsed = JoinCandidateSchema.parse(candidate);
            Object.defineProperties(parsed, {
              fromSheet: { get() { return this.sourceSheet; }, enumerable: true },
              toSheet: { get() { return this.targetSheet; }, enumerable: true },
              fromColumn: { get() { return this.sourceColumn; }, enumerable: true },
              toColumn: { get() { return this.targetColumn; }, enumerable: true },
            });

            candidates.push(parsed as JoinCandidate);
          }
        }
      }
    }
  }

  return candidates;
}
