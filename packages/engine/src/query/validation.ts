import type {
  QueryPlan,
  SheetModel,
  SheetProfile,
} from '@unsheet/contracts';
import { SafeIdentifierSchema } from '@unsheet/contracts';
import { getSheetTableName } from './planner.js';
import { sanitiseHeaderToken } from '../normalise/sanitise.js';

const FORBIDDEN_SQL_KEYWORDS = new Set([
  'DROP',
  'INSERT',
  'UPDATE',
  'DELETE',
  'ALTER',
  'CREATE',
  'COPY',
  'ATTACH',
  'DETACH',
  'INSTALL',
  'LOAD',
  'PRAGMA',
]);

export interface QueryPlanValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validates a QueryPlan against a SheetModel or SheetProfile.
 * Strictly verifies table and column allowlists, rejects forbidden SQL keywords,
 * and asserts identifier safety.
 */
export function validateQueryPlanAgainstSheet(
  plan: QueryPlan,
  sheet: SheetModel | SheetProfile
): QueryPlanValidationResult {
  const errors: string[] = [];

  // 1. Resolve allowlisted table names
  const allowedTables = new Set<string>();
  allowedTables.add(getSheetTableName(sheet));

  const rawName = 'name' in sheet ? sheet.name : sheet.sheetName;
  if (SafeIdentifierSchema.safeParse(rawName).success) {
    allowedTables.add(rawName);
  }
  allowedTables.add(sanitiseHeaderToken(rawName, 0));

  const rawId = 'id' in sheet ? sheet.id : sheet.sheetId;
  if (SafeIdentifierSchema.safeParse(rawId).success) {
    allowedTables.add(rawId);
  }
  allowedTables.add(sanitiseHeaderToken(rawId, 0));

  if (!allowedTables.has(plan.table)) {
    errors.push(
      `Table "${plan.table}" is not allowlisted for the specified sheet. Allowed tables: ${Array.from(
        allowedTables
      ).join(', ')}`
    );
  }

  // 2. Resolve allowlisted column keys
  const sheetColumns =
    'columns' in sheet
      ? sheet.columns.map((c) => c.key)
      : sheet.columnProfiles.map((c) => c.columnKey);
  const allowedColumns = new Set<string>(sheetColumns);

  // Helper to validate identifier safety & forbidden keywords
  const checkIdentifier = (ident: string, label: string): void => {
    const parse = SafeIdentifierSchema.safeParse(ident);
    if (!parse.success) {
      errors.push(`${label} identifier "${ident}" is invalid: ${parse.error.issues[0]?.message}`);
    }
    if (FORBIDDEN_SQL_KEYWORDS.has(ident.toUpperCase())) {
      errors.push(`${label} identifier "${ident}" matches forbidden SQL keyword`);
    }
  };

  // Check table identifier
  checkIdentifier(plan.table, 'Table');

  // 3. Collect allowed aliases from aggregations for orderBy
  const aggAliases = new Set<string>();
  if (plan.aggregations) {
    for (const agg of plan.aggregations) {
      checkIdentifier(agg.alias, 'Aggregation alias');
      checkIdentifier(agg.columnKey, 'Aggregation column');
      aggAliases.add(agg.alias);

      if (!allowedColumns.has(agg.columnKey)) {
        errors.push(
          `Aggregation column "${agg.columnKey}" is not allowlisted in sheet columns`
        );
      }
    }
  }

  // 4. Validate dimensions
  if (plan.dimensions) {
    for (const dim of plan.dimensions) {
      checkIdentifier(dim, 'Dimension');
      if (!allowedColumns.has(dim)) {
        errors.push(`Dimension column "${dim}" is not allowlisted in sheet columns`);
      }
    }
  }

  // 5. Validate select columns
  if (plan.select) {
    for (const col of plan.select) {
      checkIdentifier(col, 'Select');
      if (!allowedColumns.has(col)) {
        errors.push(`Select column "${col}" is not allowlisted in sheet columns`);
      }
    }
  }

  // 6. Validate filters
  if (plan.filters) {
    for (const filter of plan.filters) {
      checkIdentifier(filter.columnKey, 'Filter column');
      if (!allowedColumns.has(filter.columnKey)) {
        errors.push(
          `Filter column "${filter.columnKey}" is not allowlisted in sheet columns`
        );
      }
    }
  }

  // 7. Validate orderBy
  if (plan.orderBy) {
    for (const order of plan.orderBy) {
      checkIdentifier(order.columnKey, 'OrderBy column');
      if (!allowedColumns.has(order.columnKey) && !aggAliases.has(order.columnKey)) {
        errors.push(
          `OrderBy column "${order.columnKey}" is not allowlisted in sheet columns or aggregation aliases`
        );
      }
    }
  }

  // 8. Validate limit / offset bounds
  if (plan.limit !== undefined && (plan.limit <= 0 || plan.limit > 50000)) {
    errors.push('Limit must be a positive integer and <= 50000');
  }
  if (plan.offset !== undefined && plan.offset < 0) {
    errors.push('Offset must be a non-negative integer');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
